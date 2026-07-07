"""Organization Agent Profiles router (cloud / SaaS).

Serves the flat, member-facing ``/api/agent-profiles`` surface that
agent-canvas's backend-agnostic ``AgentProfilesClient`` calls (the same wire
contract as the local agent-server ``agent_profiles_router.py``). The org is
derived from the authenticated session (``EFFECTIVE_ORG_ID``) rather than the
path, because each member activates *their own* profile (#15044 §2); everything
else — the org-owned column, the locked org-row transaction, the
``VIEW``/``EDIT_ORG_SETTINGS`` permission model — mirrors the LLM-profile router
``org_profiles.py``.

Domain logic is **imported, never re-implemented** (the #3730 thin-boundary
contract): validation → ``validate_agent_profile``; id/revision stamping →
``save_profile_preserving_identity``; the default seed → ``build_seed_profile``;
the dry-run resolve → ``resolve_agent_profile_dry_run``; the 422 redaction →
``safe_validation_error_detail``. Agent profiles are secret-free at the API
boundary (the LLM key lives on the referenced LLM profile), so — unlike
``org_profiles`` — there is no api-key lift/mask on activate.

Activation is **pointer-only**: it writes the per-member
``OrgMember.active_agent_profile_id`` and nothing else (the creation-time-only
contract, #15044 §3). Resolution into ``agent_settings`` happens at
conversation-start (``SaasSettingsStore.load``), not here.
"""

from __future__ import annotations

import contextlib
from typing import Annotated, Any, AsyncIterator
from uuid import UUID

from fastapi import APIRouter, Body, Depends, HTTPException, Path, status
from pydantic import BaseModel, Field, ValidationError
from server.auth.authorization import Permission, require_permission
from server.auth.org_context import EFFECTIVE_ORG_ID
from server.routes.org_models import OrgNotFoundError
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from storage.agent_profile_resolution import (
    OrgLLMProfileLoader,
    load_agent_profiles,
    load_llm_profiles,
    member_mcp_config,
)
from storage.database import a_session_maker
from storage.org import Org
from storage.org_member import OrgMember
from storage.org_service import OrgService
from storage.saas_settings_store import SaasSettingsStore

from openhands.app_server.settings.agent_profiles import (
    MAX_AGENT_PROFILES,
    AgentProfiles,
)
from openhands.app_server.utils.logger import openhands_logger as logger
from openhands.sdk.profiles import (
    ACPAgentProfile,
    AgentProfile,
    AgentProfileDiagnostics,
    OpenHandsAgentProfile,
    ProfileLimitExceeded,
    build_seed_profile,
    resolve_agent_profile_dry_run,
    safe_validation_error_detail,
    save_profile_preserving_identity,
    validate_agent_profile,
)
from openhands.sdk.profiles.agent_profile_store import PROFILE_NAME_PATTERN
from openhands.sdk.utils.pydantic_secrets import REDACTED_SECRET_VALUE

# ``Skill.mcp_tools`` env/headers are ``MCPServer``-validated as of
# openhands-sdk 1.32.0 (#3964), so they are masked with the same
# ``REDACTED_SECRET_VALUE`` ("**********") sentinel used for SecretStr-typed
# fields like the LLM api_key (previously a mcp_tools-specific "<redacted>"
# sentinel from ``sanitize_dict``, pre-1.32.0).
MCP_REDACTED_VALUE = REDACTED_SECRET_VALUE

router = APIRouter(prefix='/api/agent-profiles', tags=['Agent Profiles'])

ProfileName = Annotated[
    str, Path(min_length=1, max_length=64, pattern=PROFILE_NAME_PATTERN)
]
ProfileId = Annotated[str, Path(min_length=1, max_length=128)]


# ── Request/Response Models (mirror the local agent_profiles_router contract) ──


class AgentProfileInfo(BaseModel):
    """Summary projection of a stored profile (no secret instantiation)."""

    id: str | None = None
    name: str
    agent_kind: str = 'openhands'
    revision: int | None = None
    llm_profile_ref: str | None = None
    mcp_server_refs: list[str] | None = None


class AgentProfileListResponse(BaseModel):
    profiles: list[AgentProfileInfo]
    active_agent_profile_id: str | None = None


class AgentProfileDetailResponse(BaseModel):
    name: str
    # The stored profile, ``skills[].mcp_tools`` secrets masked. Typed as the SDK
    # discriminated union (not ``dict``) so the OpenAPI schema matches the
    # ``AgentProfile`` the ts-client consumes.
    profile: AgentProfile


class AgentProfileMutationResponse(BaseModel):
    name: str
    message: str


class ActivateAgentProfileResponse(BaseModel):
    id: str
    message: str
    # Always False: activation is pointer-only by contract. agent_settings is
    # resolved at conversation-start, not on activate.
    agent_settings_applied: bool = False


class RenameAgentProfileRequest(BaseModel):
    new_name: str = Field(
        ..., min_length=1, max_length=64, pattern=PROFILE_NAME_PATTERN
    )


# ── Helpers ────────────────────────────────────────────────────────────────


async def _get_org(org_id: UUID, user_id: str) -> Org:
    """Load the org, raising 404 if the user is not a member / it is missing."""
    try:
        return await OrgService.get_org_by_id(org_id=org_id, user_id=user_id)
    except OrgNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


async def _get_member(
    session: AsyncSession, org_id: UUID, user_id: str
) -> OrgMember | None:
    result = await session.execute(
        select(OrgMember).filter(
            OrgMember.org_id == org_id, OrgMember.user_id == UUID(user_id)
        )
    )
    return result.scalars().first()


async def _get_org_and_member(
    org_id: UUID, user_id: str
) -> tuple[Org, OrgMember | None]:
    """Fetch the org (raising 404 if missing) and the acting member's row.

    The member is read in its own short-lived session — matches the org read,
    which resolves through ``OrgService.get_org_by_id`` rather than this
    module's session directly.
    """
    org = await _get_org(org_id, user_id)
    async with a_session_maker() as session:
        member = await _get_member(session, org_id, user_id)
    return org, member


@contextlib.asynccontextmanager
async def _agent_profiles_transaction(
    org_id: UUID, user_id: str
) -> AsyncIterator[tuple[AsyncSession, Org, AgentProfiles]]:
    """Yield ``(session, org, agent_profiles)`` for a single locked mutation.

    Mirrors ``org_profiles._org_profiles_transaction``: ``SELECT ... FOR UPDATE``
    on the org row so concurrent profile mutations serialize at the DB level.
    The caller mutates ``agent_profiles`` in place (and may also write the acting
    member's ``active_agent_profile_id`` via the same session); on normal exit
    the helper serializes the collection back onto the org row and commits. This
    DB row lock *is* the store's ``lock()`` — hence the in-memory model's
    re-entrant no-op ``lock()``.

    The collection is written back ONLY when the caller actually changed it.
    Loading is best-effort (``_skip_invalid_profiles`` drops entries that fail
    to validate, e.g. after schema drift), so an unconditional write-back would
    let a mutation-free call such as ``/activate`` silently erase a stored
    profile it merely failed to parse.
    """
    await _get_org(org_id, user_id)
    async with a_session_maker() as session:
        result = await session.execute(
            select(Org).filter(Org.id == org_id).with_for_update()
        )
        org = result.scalars().first()
        if org is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f'Organization {org_id} not found',
            )
        profiles = load_agent_profiles(org)
        # The EncryptedJSON column is the at-rest boundary: dump with secrets
        # exposed so skills[].mcp_tools ride in cleartext inside the blob.
        before = profiles.model_dump(mode='json', context={'expose_secrets': True})
        yield session, org, profiles
        after = profiles.model_dump(mode='json', context={'expose_secrets': True})
        if after != before:
            org.agent_profiles = after
        await session.commit()


def _restore_masked_mcp_server(new_server: Any, old_server: Any) -> tuple[Any, bool]:
    """Reconcile one MCP server's masked ``env``/``headers`` before persisting.

    Returns ``(server, changed)``. Per masked entry: restore it from the stored
    namesake server when one exists (the Edit round-trip), else drop it — a
    ``**********`` mask with nothing to restore from (e.g. a Duplicate saved
    under a new name) must never persist as a literal secret. Real values the
    client sent alongside the mask are kept. This mirrors the LLM ``**********``
    sentinel, which the LLM model nullifies to ``None``.
    """
    if not isinstance(new_server, dict):
        return new_server, False
    old = old_server if isinstance(old_server, dict) else {}
    updates: dict[str, Any] = {}
    for key in ('env', 'headers'):
        mapping = new_server.get(key)
        if not isinstance(mapping, dict) or MCP_REDACTED_VALUE not in mapping.values():
            continue
        old_mapping = old.get(key)
        old_mapping = old_mapping if isinstance(old_mapping, dict) else {}
        rebuilt: dict[str, Any] = {}
        for k, v in mapping.items():
            if v != MCP_REDACTED_VALUE:
                rebuilt[k] = v  # real value the client sent — keep
            elif k in old_mapping:
                rebuilt[k] = old_mapping[k]  # restore from the stored namesake
            # else: masked with nothing to restore — drop it
        updates[key] = rebuilt
    if not updates:
        return new_server, False
    return {**new_server, **updates}, True


def _extract_mcp_server_map(mcp_tools: Any) -> dict[str, Any]:
    """Accept both the flat ``{server: cfg}`` and legacy wrapped
    ``{mcpServers: {server: cfg}}`` shapes on RAW (pre-validation) input —
    mirrors the SDK's own ``coerce_mcp_config`` shape detection, but this runs
    on a plain dict since ``Skill.mcp_tools`` validation hasn't happened yet."""
    if not isinstance(mcp_tools, dict):
        return {}
    wrapped = mcp_tools.get('mcpServers')
    return wrapped if isinstance(wrapped, dict) else mcp_tools


def _restore_masked_skill_secrets_raw(
    body: dict[str, Any],
    existing: OpenHandsAgentProfile | ACPAgentProfile | None,
) -> dict[str, Any]:
    """Reconcile masked ``skills[].mcp_tools`` secrets in the RAW client
    payload, before SDK validation.

    Must run pre-validation: openhands-sdk 1.32.0 made ``Skill.mcp_tools``
    ``MCPServer``-typed (#3964), and ``MCPServer.env``/``headers`` silently
    *drops* any key whose value is the ``**********`` sentinel — so by the
    time a validated ``Skill`` exists, both the masked marker and the key name
    that carried it are already gone, with nothing left to restore from.
    Operating on the raw dict here sidesteps that: the real value (or the
    drop) is substituted before the SDK ever sees a sentinel value.

    GET masks ``mcp_tools`` env/headers (the API never returns raw secrets); a
    client that round-trips a fetched profile would otherwise persist the
    ``**********`` sentinel as a literal secret. Per masked value: restore it
    from the stored namesake skill+server when one exists (Edit — the
    agent-profile analogue of ``org_profiles``' ``preserve_existing_api_key``),
    else drop it (a Duplicate/create under a *new* name has no namesake, so the
    mask degrades to a dropped secret instead of corrupting one — mirroring
    the LLM ``**********`` sentinel the LLM model nullifies to ``None``).
    Sibling servers, and real values the client sent, are left untouched.
    """
    skills = body.get('skills')
    if not isinstance(skills, list) or not skills:
        return body
    existing_dump = (
        existing.model_dump(mode='json', context={'expose_secrets': True})
        if isinstance(existing, OpenHandsAgentProfile)
        else None
    )
    existing_skills_by_name = (
        {
            s['name']: s
            for s in existing_dump.get('skills', [])
            if isinstance(s, dict)
        }
        if existing_dump
        else {}
    )
    changed = False
    new_skills = []
    for skill in skills:
        if not isinstance(skill, dict):
            new_skills.append(skill)
            continue
        new_servers = _extract_mcp_server_map(skill.get('mcp_tools'))
        if not new_servers:
            new_skills.append(skill)
            continue
        old_skill = existing_skills_by_name.get(skill.get('name'))
        old_servers = _extract_mcp_server_map(
            old_skill.get('mcp_tools') if old_skill else None
        )
        skill_changed = False
        restored_servers = {}
        for server_name, server in new_servers.items():
            restored, server_changed = _restore_masked_mcp_server(
                server, old_servers.get(server_name)
            )
            restored_servers[server_name] = restored
            skill_changed = skill_changed or server_changed
        if not skill_changed:
            new_skills.append(skill)
            continue
        new_skills.append({**skill, 'mcp_tools': restored_servers})
        changed = True
    if not changed:
        return body
    return {**body, 'skills': new_skills}


async def _seed_default_agent_profile(org_id: UUID, user_id: str) -> str | None:
    """Lazily seed one default agent profile from the member's current settings.

    The cloud half of the one-time migration (#15044 §8), mirroring the local
    agent-server ``_seed_default_profile`` and the LLM ``_persist_seeded_default
    _profile``: derive a behavior-preserving profile from the (kind-aware)
    composed ``agent_settings`` via ``build_seed_profile`` and point the acting
    member at it. Returns the seeded id, or ``None`` if a concurrent request
    already seeded (double-checked under the row lock).
    """
    settings = await SaasSettingsStore(user_id, effective_org_id=org_id).load()
    if settings is None:
        return None
    # First caller wins: non-member-private fields (skills, condenser, ...) are
    # captured from the acting member's composed settings as the org default.
    seed = build_seed_profile(settings.agent_settings, settings.llm_profiles.active)
    async with _agent_profiles_transaction(org_id, user_id) as (
        session,
        _org,
        profiles,
    ):
        if profiles.list():
            # Another request seeded between the unlocked emptiness check and the
            # lock; don't clobber it.
            return None
        saved = save_profile_preserving_identity(
            profiles, seed, max_profiles=MAX_AGENT_PROFILES
        )
        member = await _get_member(session, org_id, user_id)
        if member is not None:
            member.active_agent_profile_id = str(saved.id)
        # Also set the org-wide default pointer so every *other* member —
        # who never gets their own seed call re-triggered once profiles.list()
        # is non-empty — still resolves to this profile instead of being
        # stuck on the legacy composed-settings path forever (see
        # AgentProfiles.active docstring: "an org-default active pointer").
        profiles.active = str(saved.id)
        return str(saved.id)


# ── Endpoints ────────────────────────────────────────────────────────────────


@router.get('', response_model=AgentProfileListResponse)
async def list_agent_profiles(
    effective_org_id: UUID = EFFECTIVE_ORG_ID,
    user_id: str = Depends(require_permission(Permission.VIEW_ORG_SETTINGS)),
) -> AgentProfileListResponse:
    """List agent profiles and the effective active pointer for this member.

    On the first call against an empty store with no active pointer, lazily
    seeds one default profile from the org's current ``agent_settings`` and
    points the member at it (the one-time migration; #15044 §8).
    """
    org, member = await _get_org_and_member(effective_org_id, user_id)
    profiles = load_agent_profiles(org)
    member_active = member.active_agent_profile_id if member is not None else None
    active_id = member_active or profiles.active

    if not profiles.list() and active_id is None:
        seeded_id = await _seed_default_agent_profile(effective_org_id, user_id)
        # Refresh unconditionally: even when this request lost the seed race
        # (seeded_id is None), a concurrent request may have already seeded
        # the org-wide list, and this response must reflect it rather than
        # the pre-seed snapshot taken above.
        org = await _get_org(effective_org_id, user_id)
        profiles = load_agent_profiles(org)
        if seeded_id is not None:
            active_id = seeded_id

    return AgentProfileListResponse(
        profiles=[AgentProfileInfo(**s) for s in profiles.list_summaries()],
        active_agent_profile_id=active_id,
    )


@router.get('/{name}', response_model=AgentProfileDetailResponse)
async def get_agent_profile(
    name: ProfileName,
    effective_org_id: UUID = EFFECTIVE_ORG_ID,
    user_id: str = Depends(require_permission(Permission.VIEW_ORG_SETTINGS)),
) -> AgentProfileDetailResponse:
    """Get a stored profile; ``skills[].mcp_tools`` secrets are masked.

    Cloud always masks — the ``X-Expose-Secrets`` header is not honored here
    (unlike the local agent-server), mirroring the LLM-profile GET in
    ``org_profiles``. Edits stay non-destructive: ``save_agent_profile``
    restores masked ``mcp_tools`` from the stored blob.
    """
    org = await _get_org(effective_org_id, user_id)
    profiles = load_agent_profiles(org)
    try:
        profile = profiles.load(name)
    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Agent profile '{name}' not found",
        )
    # Pass the already-validated instance, not a re-dumped dict: pydantic's
    # default revalidate_instances='never' means FastAPI's response
    # serialization is then the ONLY mask pass. A dict here would force a
    # second validate-then-dump cycle through AgentProfileDetailResponse's
    # own field type, and the SDK's mcp_tools env/headers masking (SecretStr,
    # openhands-sdk 1.32.0, #3964) treats an already-masked "**********"
    # value as nothing to restore and drops it — silently losing the field.
    return AgentProfileDetailResponse(name=name, profile=profile)


@router.post(
    '/{name}',
    response_model=AgentProfileMutationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def save_agent_profile(
    name: ProfileName,
    body: dict[str, Any],
    effective_org_id: UUID = EFFECTIVE_ORG_ID,
    user_id: str = Depends(require_permission(Permission.EDIT_ORG_SETTINGS)),
) -> AgentProfileMutationResponse:
    """Create or update an agent profile under ``name`` (path name is authoritative).

    Server-managed id/revision: overwrite keeps the namesake's id and bumps
    revision; create mints a fresh id (``save_profile_preserving_identity``).
    Returns 422 on invalid payloads (secret-safe detail) and 409 when creating a
    new profile would exceed ``MAX_AGENT_PROFILES``.
    """
    async with _agent_profiles_transaction(effective_org_id, user_id) as (
        _session,
        _org,
        profiles,
    ):
        existing = None
        with contextlib.suppress(FileNotFoundError):
            existing = profiles.load(name)

        # Must restore masked mcp_tools secrets on the RAW body, before SDK
        # validation — see _restore_masked_skill_secrets_raw's docstring.
        restored_body = _restore_masked_skill_secrets_raw(body, existing)
        try:
            profile = validate_agent_profile({**restored_body, 'name': name})
        except ValidationError as e:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=safe_validation_error_detail(e),
            )
        except Exception:
            # SkillValidationError / schema errors are client errors, never a
            # 500; stay generic — these messages can embed the input.
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail='Invalid agent profile',
            )

        try:
            save_profile_preserving_identity(
                profiles, profile, max_profiles=MAX_AGENT_PROFILES
            )
        except ProfileLimitExceeded:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f'Agent profile limit reached ({MAX_AGENT_PROFILES}). '
                    'Delete a profile before saving a new one.'
                ),
            )

    logger.info("Saved agent profile '%s' for org %s", name, effective_org_id)
    return AgentProfileMutationResponse(
        name=name, message=f"Agent profile '{name}' saved"
    )


@router.delete('/{name}', response_model=AgentProfileMutationResponse)
async def delete_agent_profile(
    name: ProfileName,
    effective_org_id: UUID = EFFECTIVE_ORG_ID,
    user_id: str = Depends(require_permission(Permission.EDIT_ORG_SETTINGS)),
) -> AgentProfileMutationResponse:
    """Delete a profile (idempotent). Clears every org member's pointer to it.

    A missing name resolves 200, matching the ts-client ``AgentProfilesClient``
    contract and the local agent-server ``delete_profile`` (canvas's delete
    mutation has no 404 branch).
    """
    async with _agent_profiles_transaction(effective_org_id, user_id) as (
        session,
        _org,
        profiles,
    ):
        # Capture the id (if present) before deleting so the per-member pointer
        # clear still runs; ``profiles.delete`` is itself a no-op when absent.
        deleted_id: str | None = None
        with contextlib.suppress(FileNotFoundError):
            deleted_id = str(profiles.load(name).id)
        profiles.delete(name)
        if deleted_id is not None:
            # Clear the pointer for every member who had this profile active, not
            # just the acting member — activation is per-member, so any other
            # member could be pointing at the now-deleted id.
            await session.execute(
                update(OrgMember)
                .where(
                    OrgMember.org_id == effective_org_id,
                    OrgMember.active_agent_profile_id == deleted_id,
                )
                .values(active_agent_profile_id=None)
            )

    logger.info("Deleted agent profile '%s' for org %s", name, effective_org_id)
    return AgentProfileMutationResponse(
        name=name, message=f"Agent profile '{name}' deleted"
    )


@router.post('/{name}/rename', response_model=AgentProfileMutationResponse)
async def rename_agent_profile(
    name: ProfileName,
    request: RenameAgentProfileRequest = Body(...),
    effective_org_id: UUID = EFFECTIVE_ORG_ID,
    user_id: str = Depends(require_permission(Permission.EDIT_ORG_SETTINGS)),
) -> AgentProfileMutationResponse:
    """Rename a profile atomically. The stable id is preserved, so active
    pointers (keyed on id) survive untouched."""
    async with _agent_profiles_transaction(effective_org_id, user_id) as (
        _session,
        _org,
        profiles,
    ):
        try:
            profiles.rename(name, request.new_name)
        except FileNotFoundError:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Agent profile '{name}' not found",
            )
        except FileExistsError:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Agent profile '{request.new_name}' already exists",
            )

    return AgentProfileMutationResponse(
        name=request.new_name,
        message=f"Agent profile renamed from '{name}' to '{request.new_name}'",
    )


@router.post('/{profile_id}/activate', response_model=ActivateAgentProfileResponse)
async def activate_agent_profile(
    profile_id: ProfileId,
    effective_org_id: UUID = EFFECTIVE_ORG_ID,
    user_id: str = Depends(require_permission(Permission.VIEW_ORG_SETTINGS)),
) -> ActivateAgentProfileResponse:
    """Activate a profile for the calling member — pointer only.

    Writes the per-member ``OrgMember.active_agent_profile_id`` and nothing else
    (no ``agent_settings`` materialization, and the profiles collection itself
    is untouched — the transaction helper skips the write-back when nothing
    mutated; #15044 §3). Member-facing, so it requires only
    ``VIEW_ORG_SETTINGS`` (each member picks their own active profile); profile
    CRUD requires ``EDIT_ORG_SETTINGS``. 404 if no stored profile has that id.
    """
    async with _agent_profiles_transaction(effective_org_id, user_id) as (
        session,
        _org,
        profiles,
    ):
        known_ids = {s['id'] for s in profiles.list_summaries() if s.get('id')}
        if profile_id not in known_ids:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Agent profile with id '{profile_id}' not found",
            )
        member = await _get_member(session, effective_org_id, user_id)
        if member is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail='Organization membership not found',
            )
        member.active_agent_profile_id = profile_id

    logger.info(
        "Activated agent profile id '%s' for member in org %s",
        profile_id,
        effective_org_id,
    )
    return ActivateAgentProfileResponse(
        id=profile_id, message=f"Agent profile '{profile_id}' activated"
    )


@router.post('/{name}/materialize', response_model=AgentProfileDiagnostics)
async def materialize_agent_profile(
    name: ProfileName,
    effective_org_id: UUID = EFFECTIVE_ORG_ID,
    user_id: str = Depends(require_permission(Permission.VIEW_ORG_SETTINGS)),
) -> AgentProfileDiagnostics:
    """Dry-run resolve a profile's LLM/MCP references into a diagnostics report.

    Dangling refs are reported in the body (``valid=False``), not raised; the
    only error status is 404 (unknown profile name). ``resolved_settings`` is
    redacted. Delegates entirely to ``resolve_agent_profile_dry_run``.
    """
    org, member = await _get_org_and_member(effective_org_id, user_id)
    profiles = load_agent_profiles(org)
    try:
        profile = profiles.load(name)
    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Agent profile '{name}' not found",
        )

    mcp_config = member_mcp_config(member) if member is not None else {}
    llm_store = OrgLLMProfileLoader(load_llm_profiles(org))

    try:
        return resolve_agent_profile_dry_run(
            profile,
            llm_store=llm_store,
            mcp_config=mcp_config,
            available_skills=None,
            cipher=None,
        )
    except Exception as exc:
        # The dry-run is contractually total, but SDK contract drift (e.g. a
        # new required kwarg raising TypeError) must surface as an invalid
        # diagnostics report, not a 500.
        logger.warning(
            "Agent profile dry-run resolve failed for '%s' in org %s: %s",
            name,
            effective_org_id,
            exc,
        )
        return AgentProfileDiagnostics(
            agent_kind=profile.agent_kind,
            valid=False,
            errors=[f'Failed to resolve profile: {exc}'],
        )

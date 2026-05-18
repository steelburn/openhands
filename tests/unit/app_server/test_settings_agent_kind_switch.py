"""Unit tests for ``Settings.update`` agent-kind switch behaviour.

The discriminated ``OpenHandsAgentSettings | ACPAgentSettings`` union means a
naive deep-merge of the incoming kind's fields onto the outgoing kind's dump
produces a mongrel (e.g. ``llm`` plus ``acp_command``) that fails validation
and 500s the settings endpoint. The fix is to start from a fresh base for
the new kind.

When switching kinds the outgoing config is snapshotted into
``saved_agent_configs`` and restored on the next switch back, implementing
the round-trip preservation feature from OpenHands/OpenHands#14370.
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from openhands.app_server.settings.settings_models import Settings


def _set_acp(
    command: list[str] | None = None,
    *,
    acp_env: dict | None = None,
) -> dict:
    return {
        'agent_settings_diff': {
            'agent_kind': 'acp',
            'acp_command': command
            or ['npx', '-y', '@agentclientprotocol/claude-agent-acp'],
            'acp_args': [],
            **({'acp_env': acp_env} if acp_env is not None else {}),
        }
    }


def _set_openhands(
    *,
    llm_model: str | None = None,
    mcp_config: dict | None = None,
) -> dict:
    diff: dict = {'agent_kind': 'openhands'}
    if llm_model is not None:
        diff['llm'] = {'model': llm_model}
    if mcp_config is not None:
        diff['mcp_config'] = mcp_config
    return {'agent_settings_diff': diff}


def test_kind_switch_does_not_raise():
    """OH → ACP → OH must not 500.

    Regression guard for the discriminated-union mongrel: deep-merging the
    OH dump onto an ``acp_command`` payload would produce a dict carrying
    both ``llm`` and ``acp_command``, which neither branch of
    ``AgentSettingsConfig`` accepts.
    """
    s = Settings()
    s.update(_set_openhands(llm_model='anthropic/claude-sonnet-4-5'))

    s.update(_set_acp())
    assert s.agent_settings.agent_kind == 'acp'

    s.update(_set_openhands())
    assert s.agent_settings.agent_kind == 'openhands'


def test_switch_oh_to_acp_snapshots_openhands_config():
    """After switching OH→ACP, saved_agent_configs['openhands'] contains the
    original LLM model."""
    s = Settings()
    s.update(_set_openhands(llm_model='anthropic/claude-sonnet-4-5'))

    s.update(_set_acp())

    assert 'openhands' in s.saved_agent_configs
    assert s.saved_agent_configs['openhands']['llm']['model'] == 'anthropic/claude-sonnet-4-5'


def test_round_trip_preserves_openhands_llm_config():
    """OH→ACP→OH brings back the original LLM model."""
    s = Settings()
    s.update(_set_openhands(llm_model='anthropic/claude-sonnet-4-5'))

    s.update(_set_acp())
    assert s.agent_settings.agent_kind == 'acp'

    s.update(_set_openhands())
    assert s.agent_settings.agent_kind == 'openhands'
    assert s.agent_settings.llm.model == 'anthropic/claude-sonnet-4-5'


def test_switch_back_to_existing_snapshot_replaces_current():
    """Second switch reads the saved snapshot, not defaults."""
    s = Settings()
    s.update(_set_openhands(llm_model='anthropic/claude-sonnet-4-5'))
    s.update(_set_acp())

    # Modify while in ACP mode
    s.update({'agent_settings_diff': {'acp_env': {'X': '1'}}})

    # Switch back to OH — should restore the snapshot, not use defaults
    s.update(_set_openhands())
    assert s.agent_settings.llm.model == 'anthropic/claude-sonnet-4-5'


def test_no_snapshot_written_when_current_kind_is_none():
    """A fresh Settings() has agent_kind='openhands' (from default_agent_settings),
    so switching from it will snapshot 'openhands'. Verify no crash and correct behavior."""
    # Fresh settings has current_kind = 'openhands'
    s = Settings()
    assert s.agent_settings.agent_kind == 'openhands'

    # Switching to ACP should snapshot 'openhands'
    s.update(_set_acp())
    assert 'openhands' in s.saved_agent_configs
    assert s.agent_settings.agent_kind == 'acp'


def test_switch_with_replace_mcp_config_clears_old_servers():
    """mcp_config replace wholesale works through a kind switch."""
    s = Settings()
    s.update(_set_acp())

    s.update(
        _set_openhands(
            mcp_config={'mcpServers': {'foo': {'command': 'foo-bin'}}}
        )
    )
    assert s.agent_settings.agent_kind == 'openhands'
    assert s.agent_settings.mcp_config is not None
    assert 'foo' in s.agent_settings.mcp_config.mcpServers
    assert 'bar' not in s.agent_settings.mcp_config.mcpServers


def test_switch_back_replaces_acp_env_wholesale():
    """Smaller acp_env on switch-back drops old keys."""
    s = Settings()
    # First switch to ACP with a large env
    s.update(_set_acp(acp_env={'FOO': '1', 'BAR': '2', 'BAZ': '3'}))
    assert s.agent_settings.acp_env == {'FOO': '1', 'BAR': '2', 'BAZ': '3'}

    # Switch to OH (snapshots ACP config)
    s.update(_set_openhands())

    # Switch back to ACP with smaller env — should replace, not merge
    s.update(_set_acp(acp_env={'FOO': '9'}))
    assert s.agent_settings.acp_env == {'FOO': '9'}
    assert 'BAR' not in s.agent_settings.acp_env
    assert 'BAZ' not in s.agent_settings.acp_env


def test_switch_into_existing_snapshot_preserves_other_fields_in_same_payload():
    """Concurrent override + switch applies override on top of restored snapshot."""
    s = Settings()
    s.update(_set_openhands(llm_model='anthropic/claude-sonnet-4-5'))
    s.update(_set_acp())

    # Switch back to OH while also overriding the LLM model in the same payload
    s.update(
        {
            'agent_settings_diff': {
                'agent_kind': 'openhands',
                'llm': {'model': 'openai/gpt-4o'},
            }
        }
    )
    assert s.agent_settings.agent_kind == 'openhands'
    # The inline override should win over the snapshot value
    assert s.agent_settings.llm.model == 'openai/gpt-4o'


def test_corrupt_saved_agent_config_falls_back_cleanly():
    """A bad snapshot (invalid dict) yields ValidationError, NOT a 500."""
    s = Settings()
    s.update(_set_openhands(llm_model='anthropic/claude-sonnet-4-5'))
    s.update(_set_acp())

    # Corrupt the snapshot
    import copy
    bad_saved = copy.deepcopy(s.saved_agent_configs)
    bad_saved['openhands'] = {'agent_kind': 'openhands', 'llm': {'model': 12345}}
    object.__setattr__(s, 'saved_agent_configs', bad_saved)

    # Switching back with a corrupt snapshot should raise ValidationError
    with pytest.raises((ValidationError, Exception)):
        s.update(_set_openhands())


def test_saved_agent_configs_round_trips_through_model_dump():
    """Settings.model_dump() → Settings.model_validate() preserves saved_agent_configs."""
    s = Settings()
    s.update(_set_openhands(llm_model='anthropic/claude-sonnet-4-5'))
    s.update(_set_acp())

    assert 'openhands' in s.saved_agent_configs

    dumped = s.model_dump(context={'expose_secrets': True})
    restored = Settings.model_validate(dumped)

    assert 'openhands' in restored.saved_agent_configs
    assert (
        restored.saved_agent_configs['openhands']['llm']['model']
        == 'anthropic/claude-sonnet-4-5'
    )


def test_acp_env_replaced_wholesale():
    """``acp_env`` is replaced wholesale (not deep-merged) so removed keys
    don't leak across saves.

    This is independent of the kind switch: any ``acp_env`` in the update
    payload replaces the stored dict in full.
    """
    s = Settings()
    s.update(_set_acp(acp_env={'FOO': '1', 'BAR': '2'}))
    assert s.agent_settings.acp_env == {'FOO': '1', 'BAR': '2'}

    s.update({'agent_settings_diff': {'acp_env': {'FOO': '9'}}})
    assert s.agent_settings.acp_env == {'FOO': '9'}


def test_kind_switch_with_inline_field_override():
    """An ``agent_kind`` switch alongside other fields in the same payload
    must apply those fields on top of the fresh base.

    e.g. switching to OH and setting an LLM model in one call: the LLM
    override must land on the fresh OH base.
    """
    s = Settings()
    s.update(_set_acp())

    s.update(_set_openhands(llm_model='model-c'))
    assert s.agent_settings.agent_kind == 'openhands'
    assert s.agent_settings.llm.model == 'model-c'


def test_replace_mcp_config_in_kind_switch():
    """``mcp_config`` replace-wholesale also works alongside a kind switch."""
    s = Settings()
    s.update(_set_acp())

    s.update(_set_openhands(mcp_config={'mcpServers': {'foo': {'command': 'foo-bin'}}}))
    assert s.agent_settings.mcp_config is not None
    assert 'foo' in s.agent_settings.mcp_config.mcpServers

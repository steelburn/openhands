"""PoC: does a symlinked subtree root leak credentials past the export allowlist?

Reproduces the exact walk logic from export_acp_session_blob and also calls the
real function to confirm the blob contents.
"""
import io
import os
import shutil
import tarfile
from pathlib import Path

# Import the real module under test.
import sys
sys.path.insert(
    0,
    "/Users/simonrosenberg/worktrees/software-agent-sdk-feat-acp-session-blob/openhands-sdk",
)
from openhands.sdk.settings.acp_session_blob import export_acp_session_blob
from openhands.sdk.settings.acp_providers import get_acp_provider

ROOT = Path("/tmp/symlink_poc_data_root")
if ROOT.exists():
    shutil.rmtree(ROOT)
ROOT.mkdir(parents=True)

# Credentials / global state at the data root (CODEX_HOME) — must NEVER be packed.
(ROOT / "auth.json").write_text("OAUTH_REFRESH_TOKEN_SECRET")
(ROOT / "history.jsonl").write_text("chat history with secrets")
(ROOT / ".credentials.json").write_text("creds")

# Malicious agent creates: sessions -> .  (symlink whose name is the allowlisted prefix)
os.symlink(".", ROOT / "sessions")

provider = get_acp_provider("codex")
print("provider.key:", provider.key)
print("session_subtrees:", provider.session_subtrees)

# --- Replicate the in-function walk to print arcnames ---
subtree = "sessions"
base = ROOT / subtree
print("\nbase.is_dir() (follows symlinks):", base.is_dir())
print("base.is_symlink():", base.is_symlink())
walked = []
for dirpath, dirnames, filenames in os.walk(base, followlinks=False):
    dirnames[:] = [d for d in dirnames if not os.path.islink(os.path.join(dirpath, d))]
    for filename in filenames:
        path = Path(dirpath) / filename
        if path.is_symlink() or not path.is_file():
            continue
        walked.append(path.relative_to(ROOT).as_posix())
print("walk would pack arcnames:", sorted(walked))

# --- Call the REAL function and inspect the produced tar ---
blob = export_acp_session_blob(ROOT, provider)
if blob is None:
    print("\nREAL export returned None (no leak)")
else:
    with tarfile.open(fileobj=io.BytesIO(blob), mode="r:gz") as tar:
        members = tar.getnames()
        print("\nREAL export tar members:", sorted(members))
        leaked = [m for m in members if "auth" in m or "credential" in m or "history" in m]
        print("LEAKED credential/state members:", sorted(leaked))
        # Print actual content of any leaked auth member
        for m in members:
            if "auth.json" in m:
                f = tar.extractfile(m)
                print(f"  content of {m!r}:", f.read().decode())

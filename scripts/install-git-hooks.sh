#!/usr/bin/env bash
# One-shot installer that wires the repo's lint scripts into .git/hooks.
# Re-run any time a new hook is added.
set -euo pipefail

REPO_ROOT=$(git rev-parse --show-toplevel)
cd "$REPO_ROOT"

HOOK_DIR=".git/hooks"
mkdir -p "$HOOK_DIR"

cat > "$HOOK_DIR/pre-commit" <<'HOOK'
#!/usr/bin/env bash
set -euo pipefail
REPO_ROOT=$(git rev-parse --show-toplevel)
"$REPO_ROOT/scripts/lint-swift-tokens.sh"

# Keep the codebase-memory architecture graph in sync with the commit.
# Incremental + fast (sub-second); non-fatal and skipped when the MCP isn't installed.
CBM="$HOME/.local/bin/codebase-memory-mcp"
if [ -x "$CBM" ]; then
  "$CBM" cli index_repository "{\"repo_path\":\"$REPO_ROOT\"}" >/dev/null 2>&1 || true
fi
HOOK
chmod +x "$HOOK_DIR/pre-commit"

chmod +x "$REPO_ROOT/scripts/lint-swift-tokens.sh"

echo "✓ Installed pre-commit hook at $HOOK_DIR/pre-commit"
echo "  Runs scripts/lint-swift-tokens.sh on every commit."

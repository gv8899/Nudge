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
HOOK
chmod +x "$HOOK_DIR/pre-commit"

chmod +x "$REPO_ROOT/scripts/lint-swift-tokens.sh"

echo "✓ Installed pre-commit hook at $HOOK_DIR/pre-commit"
echo "  Runs scripts/lint-swift-tokens.sh on every commit."

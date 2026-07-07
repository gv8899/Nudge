#!/usr/bin/env bash
# One-shot setup for the codebase-memory MCP on a fresh machine.
#   ./scripts/setup-codebase-memory.sh
#
# Idempotent — safe to re-run. Does the three machine-local steps that do NOT
# sync across computers (see AGENTS.md「Codebase 知識圖譜」):
#   1. install the codebase-memory-mcp binary (UI variant → also serves 3D graph)
#   2. register it as a user-scope MCP server in ~/.claude.json
#   3. index THIS repo into the local graph cache
#
# After running, restart Claude Code so it picks up the new MCP server.
set -euo pipefail

REPO_ROOT=$(git rev-parse --show-toplevel)
BIN="$HOME/.local/bin/codebase-memory-mcp"
INSTALLER_URL="https://raw.githubusercontent.com/DeusData/codebase-memory-mcp/main/install.sh"
# Project name = repo path with slashes turned into dashes (how the tool keys it).
PROJECT="${REPO_ROOT#/}"; PROJECT="${PROJECT//\//-}"

# 1. Binary (skip if already present) --------------------------------------
if [ -x "$BIN" ]; then
  echo "✓ binary already installed: $("$BIN" --version 2>/dev/null)"
else
  echo "→ installing codebase-memory-mcp (UI variant)…"
  TMP=$(mktemp)
  trap 'rm -f "$TMP"' EXIT
  curl -fsSL -o "$TMP" "$INSTALLER_URL"
  # Installer verifies the binary's SHA256 against published checksums itself.
  bash "$TMP" --ui --skip-config
fi

# 2. Register as user-scope MCP (skip if already registered) ----------------
if claude mcp list 2>/dev/null | grep -q '^codebase-memory-mcp:'; then
  echo "✓ MCP already registered (user scope)"
else
  echo "→ registering MCP server at user scope…"
  claude mcp add -s user codebase-memory-mcp "$BIN"
fi

# 3. Enable UI + index this repo -------------------------------------------
"$BIN" config set ui true >/dev/null 2>&1 || true
echo "→ indexing $REPO_ROOT …"
"$BIN" cli index_repository "{\"repo_path\":\"$REPO_ROOT\"}" 2>&1 \
  | grep -v '^level=' | tail -1

echo ""
echo "✓ Done. Restart Claude Code to load the MCP server."
echo "  3D graph:  $BIN --ui=true   then open http://localhost:9749/"
echo "  Project key for graph tools: $PROJECT"

#!/usr/bin/env bash
# Blocks Swift commits that introduce non-token colours.
#
# Forbidden in staged .swift files under apple/:
#   - Color literals: Color.blue / .red / .green / .yellow / .orange /
#                     .black / .white / .gray / .pink / .purple / .cyan /
#                     .mint / .indigo / .teal / .brown / .accentColor
#   - Inline RGB: Color(red: ..., green: ..., blue: ...)
#   - Hex string: "#RRGGBB" or "#AARRGGBB"
#
# Allowlist: TaskDetailView.swift (tag hex parser) + NudgeAppearance.swift
# (system-colour fallbacks). Per-line escape: add `// nudge:allow-color`.
set -euo pipefail

REPO_ROOT=$(git rev-parse --show-toplevel)
cd "$REPO_ROOT"

files=$(
  git diff --cached --name-only --diff-filter=ACM \
    -- 'apple/**/*.swift' 'apple/*.swift' 2>/dev/null || true
)

[ -z "$files" ] && exit 0

allowlist='(TaskDetailView\.swift|NudgeAppearance\.swift|Tests\.swift|TagBadgeView\.swift)$'
literal_regex='\bColor\.(blue|red|green|yellow|orange|black|white|gray|pink|purple|cyan|mint|indigo|teal|brown|accentColor)\b'
rgb_regex='\bColor\(red:[^)]*green:[^)]*blue:'
hex_regex='"#[0-9a-fA-F]{6,8}"'

bad=0
findings=""

for f in $files; do
  [ -f "$f" ] || continue
  if echo "$f" | grep -qE "$allowlist"; then
    continue
  fi

  for regex in "$literal_regex" "$rgb_regex" "$hex_regex"; do
    matches=$(grep -nE "$regex" "$f" 2>/dev/null | grep -v 'nudge:allow-color' || true)
    if [ -n "$matches" ]; then
      while IFS= read -r line; do
        findings="$findings$f:$line
"
      done <<EOF
$matches
EOF
      bad=1
    fi
  done
done

if [ "$bad" -eq 1 ]; then
  echo "✗ Swift design-token lint failed."
  echo
  echo "Use Color.nudgeXxx tokens (see Color+Nudge.swift)."
  echo "For rare data-driven literals (tag hex, system fallback) add"
  echo "  // nudge:allow-color  on the same line."
  echo
  printf '%s' "$findings"
  exit 1
fi

exit 0

#!/usr/bin/env bash
# apple/NudgeEditor/build.sh
# Build the Vite editor bundle and copy outputs into the NudgeUI
# Swift-Package resources directory. Run before Xcode build, or as a
# pre-commit step when src/components/editor/* changes.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

DEST="$SCRIPT_DIR/../NudgeKit/Sources/NudgeUI/Resources/Editor"

echo "→ npm install (skip if lock unchanged)"
npm install --silent --no-audit --no-fund --legacy-peer-deps

echo "→ vite build"
npm run build --silent

echo "→ copy dist/ → $DEST"
rm -rf "$DEST"
mkdir -p "$DEST"
# 複製 index.html → editor.html + editor.js + editor.css (+ 可能的 asset)
cp dist/index.html "$DEST/editor.html"
cp dist/editor.js "$DEST/editor.js"
if [ -f dist/editor.css ]; then
    cp dist/editor.css "$DEST/editor.css"
fi
# assets/ 子目錄（若有 hashed chunk）
if [ -d dist/assets ]; then
    cp -R dist/assets "$DEST/"
fi

echo "✓ editor bundle copied"

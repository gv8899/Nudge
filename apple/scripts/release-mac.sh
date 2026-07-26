#!/usr/bin/env bash
#
# Nudge macOS — 發布 DMG + 更新 Sparkle appcast 到 GitHub Releases。
#
# 架構：所有版本的 DMG + appcast.xml 都放在固定 release「mac-releases」當檔案桶。
#   - 網站下載：nudge.tw/download/mac        → redirect → mac-releases/Nudge.dmg
#   - 自動更新：nudge.tw/downloads/appcast.xml → redirect → mac-releases/appcast.xml
# 兩條 redirect 在 next.config.ts 設好了，發版這支腳本跑完即生效，不用改 code/部署。
#
# 流程（每次發新版）：
#   1. 自己的 Terminal 跑 ./apple/scripts/build-dmg.sh
#        → ~/Downloads/Nudge-{版本}-{build}.dmg（已 notarize + staple）
#   2. ./apple/scripts/release-mac.sh
#        → 上傳 DMG、重生 appcast（EdDSA 簽章）、一起推上 mac-releases
#
# 需求：gh 已登入、DMG 已 notarize+staple、Sparkle EdDSA 私鑰在 keychain。
set -euo pipefail

REPO="gv8899/Nudge"
TAG="mac-releases"                     # 固定檔案桶 release
BUCKET="https://github.com/$REPO/releases/download/$TAG"
DL_DIR="$HOME/Downloads"

# --- 0. 工具 / 登入檢查 ---
command -v gh >/dev/null || { echo "✗ 沒有 gh CLI。" >&2; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "✗ gh 未登入，先跑 gh auth login。" >&2; exit 1; }
GEN_APPCAST="$(find "$HOME/Library/Developer/Xcode/DerivedData" \
  -path "*/artifacts/sparkle/Sparkle/bin/generate_appcast" 2>/dev/null | head -1)"
[[ -x "$GEN_APPCAST" ]] || { echo "✗ 找不到 generate_appcast，先在 Xcode build 一次 Nudge（拉 Sparkle SPM artifact）。" >&2; exit 1; }

# --- 1. 收集所有 Nudge DMG 到乾淨 staging（generate_appcast 會處理整個資料夾）---
shopt -s nullglob
DMGS=("$DL_DIR"/Nudge-*.dmg)
shopt -u nullglob
if [[ ${#DMGS[@]} -eq 0 ]]; then
  echo "✗ $DL_DIR 找不到 Nudge-*.dmg。先跑 build-dmg.sh。" >&2
  exit 1
fi
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
for d in "${DMGS[@]}"; do cp "$d" "$STAGE/"; done

# 最新版（給網站固定連結 Nudge.dmg 用）
NEWEST="$(ls -t "$STAGE"/Nudge-*.dmg | head -1)"
echo "▸ 最新 DMG: $(basename "$NEWEST")（共 ${#DMGS[@]} 版進 appcast）"

# --- 2. 驗證最新版 notarization staple ---
if xcrun stapler validate "$NEWEST" >/dev/null 2>&1; then
  echo "▸ stapler validate ✓"
else
  echo "⚠ stapler validate 失敗 — 這顆 DMG 可能沒 notarize/staple。" >&2
  read -r -p "  仍要發布？(y/N) " ans
  [[ "$ans" == "y" || "$ans" == "Y" ]] || { echo "已中止。"; exit 1; }
fi

# --- 3. 確保 bucket release 存在 ---
if ! gh release view "$TAG" -R "$REPO" >/dev/null 2>&1; then
  echo "▸ 建立檔案桶 release：$TAG"
  gh release create "$TAG" -R "$REPO" \
    --title "Nudge for Mac — downloads" \
    --notes "DMG + Sparkle appcast 檔案桶。請從 https://nudge.tw/download/mac 下載。"
fi

# --- 4. 上傳所有版本 DMG（idempotent）+ 固定名 Nudge.dmg ---
echo "▸ 上傳 DMG 到 ${TAG}…"
gh release upload "$TAG" "${DMGS[@]}" -R "$REPO" --clobber
cp "$NEWEST" "$STAGE/Nudge.dmg"
gh release upload "$TAG" "$STAGE/Nudge.dmg" -R "$REPO" --clobber

# --- 5. 重生 appcast.xml（EdDSA 簽章 + enclosure 指向 bucket）---
#     注意：Nudge.dmg 不放進 generate_appcast 來源，否則跟最新版重複一條。
rm -f "$STAGE/Nudge.dmg"
echo "▸ 產生 appcast.xml（generate_appcast）…"
"$GEN_APPCAST" --download-url-prefix "$BUCKET/" "$STAGE"
[[ -f "$STAGE/appcast.xml" ]] || { echo "✗ generate_appcast 沒產出 appcast.xml。" >&2; exit 1; }

# --- 6. 上傳 delta（增量更新包）---
#     generate_appcast 會在 $STAGE 產出 NudgeNNN-MMM.delta 並寫進 appcast 的
#     <sparkle:deltas>。這些檔案以前沒上傳，appcast 指過去一律 404（實測
#     Nudge127-125.delta / Nudge127-124.delta 皆 404）。Sparkle 會自動退回下載
#     完整 DMG，所以更新不會壞 —— 但 127→128 的 delta 只有 903 KB、完整 DMG
#     是 6.1 MB，等於每個自動更新的使用者白下載 7 倍流量。
#     必須在 appcast.xml 之前上傳：否則 Sparkle 讀到新 appcast 時 delta 還沒到位。
shopt -s nullglob
DELTAS=("$STAGE"/*.delta)
shopt -u nullglob
if [[ ${#DELTAS[@]} -gt 0 ]]; then
  echo "▸ 上傳 ${#DELTAS[@]} 個 delta…"
  gh release upload "$TAG" "${DELTAS[@]}" -R "$REPO" --clobber
else
  echo "▸ 沒有 delta 可上傳（首次發版或只有單一版本）"
fi

# --- 7. 上傳 appcast.xml ---
gh release upload "$TAG" "$STAGE/appcast.xml" -R "$REPO" --clobber

echo ""
echo "✓ 發布完成"
echo "  下載鈕   : https://nudge.tw/download/mac        → $BUCKET/Nudge.dmg"
echo "  自動更新 : https://nudge.tw/downloads/appcast.xml → $BUCKET/appcast.xml"
echo "  （nudge.tw 的兩條 redirect 需先部署上線才會通）"

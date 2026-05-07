#!/bin/bash
#
# Nudge macOS DMG build pipeline — 給 nudge.tw 網站直接 download 用。
# 流程：archive → exportArchive (Developer ID) → notarize → staple →
# stage → DMG → 簽 DMG → notarize DMG → staple DMG。跑完拿到的 DMG 在
# 任何 Mac 上雙擊都會直接打開、無 Gatekeeper 警告。
#
# Prerequisites（一次性 setup，details in apple/README.md）:
#   1. Developer ID Application cert 在 keychain
#      (security find-identity -v -p codesigning | grep "Developer ID Application")
#   2. ASC API key 已存進 keychain profile "NUDGE_NOTARY"
#      (xcrun notarytool history --keychain-profile NUDGE_NOTARY)
#   3. project.yml ENABLE_HARDENED_RUNTIME: YES (notarization 必要)
#
# 用法:
#   ./apple/scripts/build-dmg.sh
#
# 輸出:
#   ~/Downloads/Nudge-{MARKETING_VERSION}-{CURRENT_PROJECT_VERSION}.dmg

set -euo pipefail

# 取絕對路徑，無論從哪個目錄呼叫都 work
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
APPLE_DIR="$REPO_ROOT/apple"

# 從 project.yml 讀版本號 — single source of truth，不另外傳參。
# bump build number 由 PR 改 project.yml 觸發、不在這邊。
MARKETING_VERSION="$(grep -E '^[[:space:]]*MARKETING_VERSION:' "$APPLE_DIR/project.yml" | head -1 | sed 's/.*"\(.*\)".*/\1/')"
CURRENT_PROJECT_VERSION="$(grep -E '^[[:space:]]*CURRENT_PROJECT_VERSION:' "$APPLE_DIR/project.yml" | head -1 | sed 's/.*"\(.*\)".*/\1/')"
DMG_NAME="Nudge-${MARKETING_VERSION}-${CURRENT_PROJECT_VERSION}.dmg"
DMG_OUT="$HOME/Downloads/$DMG_NAME"

# 工作目錄 — /tmp 會被 macOS 定期清，build 中途被清會炸；放 /tmp
# 沒關係（最終產物搬到 ~/Downloads）。
WORK_DIR="/tmp/nudge-dist"
ARCHIVE_PATH="$WORK_DIR/Nudge-macOS.xcarchive"
EXPORT_DIR="$WORK_DIR/export"
STAGE_DIR="$WORK_DIR/dmg-stage"
EXPORT_OPTIONS="$APPLE_DIR/Nudge-macOS-ExportOptions.plist"

NOTARY_PROFILE="NUDGE_NOTARY"
SIGNING_IDENTITY="Developer ID Application: YU CHIA HUANG (B9NC8LR2HQ)"

# ASC API key — xcodebuild CLI 不繼承 Xcode UI 的 Apple ID account，
# 透過 .p8 + Key ID + Issuer ID 直接 authenticate。同一組 cred 也用於
# notarytool keychain profile（NUDGE_NOTARY）。Key ID / Issuer ID 從
# .p8 檔名推 + ~/.appstoreconnect/private_keys/ 目錄抓。
ASC_KEY_PATH="$(ls "$HOME/.appstoreconnect/private_keys/AuthKey_"*.p8 | head -1)"
ASC_KEY_ID="$(basename "$ASC_KEY_PATH" | sed -E 's/AuthKey_(.*)\.p8/\1/')"
ASC_ISSUER_ID="0e72f370-8321-43f9-b78c-c2265e9771de"

echo "════════════════════════════════════════════════════════════"
echo " Nudge macOS DMG build  →  $DMG_NAME"
echo "════════════════════════════════════════════════════════════"

# 0. 先確保 Xcode project 是最新的（project.yml 改過要重 generate）
echo ""
echo "▶ [0/8] xcodegen generate"
cd "$APPLE_DIR" && xcodegen generate >/dev/null

# 1. 清舊產物，避免 stale archive / DMG 混淆
echo "▶ [1/8] Clean $WORK_DIR"
rm -rf "$WORK_DIR"
mkdir -p "$WORK_DIR"
rm -f "$DMG_OUT"

# 2. xcodebuild archive — Release config + automatic signing。
#    不在這裡硬指定 Developer ID identity，因為 Mac App Sandbox + Developer
#    ID 分發需要 "Developer ID Provisioning Profile"，Manual signing style
#    沒辦法搭 -allowProvisioningUpdates 自動生 profile，會炸
#    "requires a provisioning profile"。Automatic + -allowProvisioningUpdates
#    讓 Xcode 自己創 profile + 簽 archive，第 3 步 exportArchive 用
#    method=developer-id 才把 .app 重新簽成 Developer ID Application。
echo "▶ [2/8] xcodebuild archive (Release, automatic signing)"
xcodebuild archive \
    -project "$APPLE_DIR/Nudge.xcodeproj" \
    -scheme Nudge-macOS \
    -configuration Release \
    -destination "platform=macOS" \
    -archivePath "$ARCHIVE_PATH" \
    -allowProvisioningUpdates \
    -authenticationKeyPath "$ASC_KEY_PATH" \
    -authenticationKeyID "$ASC_KEY_ID" \
    -authenticationKeyIssuerID "$ASC_ISSUER_ID" \
    >"$WORK_DIR/archive.log" 2>&1
echo "   → $ARCHIVE_PATH"

# 3. 跳過 xcodebuild -exportArchive，改自己 codesign。
#    exportArchive 預設會找 Developer ID provisioning profile，創這種
#    profile 需要 ASC API key 的 App Manager+ role；我們的 key 是
#    Developer role 沒權限。Developer ID 分發實際上不需要 provisioning
#    profile（profile 是 App Store / TestFlight 流程的事），只要 app 用
#    Developer ID Application cert 簽 + Hardened Runtime 開 + 通過
#    notarization 即可。
echo "▶ [3/8] extract + re-sign .app with Developer ID"
mkdir -p "$EXPORT_DIR"
cp -R "$ARCHIVE_PATH/Products/Applications/Nudge-macOS.app" "$EXPORT_DIR/"
APP_PATH="$EXPORT_DIR/Nudge-macOS.app"

# Strip 從 archive 帶來的 Apple Development embedded.provisionprofile —
# 它限定 ProvisionedDevices，傳給別台 Mac 會被擋。Developer ID 分發
# 不需要 embedded profile（前提：app 沒用 restricted entitlements，
# 我們的 entitlements 已清空，無此限制）。
rm -f "$APP_PATH/Contents/embedded.provisionprofile"

# 用 --deep 一次性簽全部 nested binaries + 主 wrapper。--deep 雖然
# Apple deprecated 但對 re-sign archive 流程仍 work，比一個個 nested
# bundle 各做一次 --timestamp（TSA 每個 binary roundtrip 累計可達 10+
# 分鐘）快非常多。Notarization 不要求 timestamp 的 deep 簽法、它自己
# 會在 staple 階段給 ticket。
{
    codesign --force --deep --sign "$SIGNING_IDENTITY" \
        --options runtime \
        --entitlements "$APPLE_DIR/Nudge-macOS/Nudge-macOS.entitlements" \
        --timestamp \
        "$APP_PATH"
    codesign --verify --deep --strict --verbose=2 "$APP_PATH"
} >"$WORK_DIR/export.log" 2>&1

if [ ! -d "$APP_PATH" ]; then
    echo "❌ codesign 失敗，看 $WORK_DIR/export.log"
    exit 1
fi
echo "   → $APP_PATH"

# 4. Notarize the .app — Apple Notary Service 掃 binary 確認沒 malware
echo "▶ [4/8] notarize .app (此步驟 Apple 後端跑、通常 1-3 分鐘)"
APP_ZIP="$WORK_DIR/Nudge-macOS.zip"
ditto -c -k --keepParent "$APP_PATH" "$APP_ZIP"
xcrun notarytool submit "$APP_ZIP" \
    --keychain-profile "$NOTARY_PROFILE" \
    --wait \
    --timeout 30m \
    | tee "$WORK_DIR/notarize-app.log"
if ! grep -q "status: Accepted" "$WORK_DIR/notarize-app.log"; then
    echo "❌ .app notarization 失敗，看 $WORK_DIR/notarize-app.log"
    SUBMISSION_ID="$(grep "id:" "$WORK_DIR/notarize-app.log" | head -1 | awk '{print $2}')"
    if [ -n "$SUBMISSION_ID" ]; then
        echo "   詳細: xcrun notarytool log $SUBMISSION_ID --keychain-profile $NOTARY_PROFILE"
    fi
    exit 1
fi

# 5. Staple notarization ticket onto .app — 把 ticket 嵌入 bundle，
#    user 第一次開 app 不需要連網就能驗證。
echo "▶ [5/8] stapler staple .app"
xcrun stapler staple "$APP_PATH" >"$WORK_DIR/staple-app.log" 2>&1
xcrun stapler validate "$APP_PATH" >>"$WORK_DIR/staple-app.log" 2>&1

# 6. Stage + create DMG（含 Applications symlink for drag-to-install）
echo "▶ [6/8] create DMG"
mkdir -p "$STAGE_DIR"
cp -R "$APP_PATH" "$STAGE_DIR/Nudge.app"
ln -s /Applications "$STAGE_DIR/Applications"
hdiutil detach /Volumes/Nudge 2>/dev/null || true
hdiutil create -volname "Nudge" -srcfolder "$STAGE_DIR" \
    -ov -format UDZO "$WORK_DIR/$DMG_NAME" \
    >"$WORK_DIR/hdiutil.log" 2>&1

# 7. Sign DMG 自身 + notarize → staple — DMG 也是個 container，未簽
#    + 未 notarize 的 DMG 雙擊有時會被 macOS 質疑。完整流程跟 .app 同。
echo "▶ [7/8] sign + notarize + staple DMG"
codesign --force --sign "$SIGNING_IDENTITY" \
    --timestamp "$WORK_DIR/$DMG_NAME"
xcrun notarytool submit "$WORK_DIR/$DMG_NAME" \
    --keychain-profile "$NOTARY_PROFILE" \
    --wait \
    --timeout 30m \
    | tee "$WORK_DIR/notarize-dmg.log"
if ! grep -q "status: Accepted" "$WORK_DIR/notarize-dmg.log"; then
    echo "❌ DMG notarization 失敗，看 $WORK_DIR/notarize-dmg.log"
    exit 1
fi
xcrun stapler staple "$WORK_DIR/$DMG_NAME" >"$WORK_DIR/staple-dmg.log" 2>&1

# 8. 搬到 ~/Downloads（不會被 /tmp 自動清）
echo "▶ [8/8] move to $DMG_OUT"
mv "$WORK_DIR/$DMG_NAME" "$DMG_OUT"

# Final summary
DMG_SIZE="$(du -h "$DMG_OUT" | awk '{print $1}')"
DMG_SHA256="$(shasum -a 256 "$DMG_OUT" | awk '{print $1}')"
echo ""
echo "════════════════════════════════════════════════════════════"
echo "✅ Done: $DMG_OUT  ($DMG_SIZE)"
echo "   SHA256: $DMG_SHA256"
echo ""
echo "  • 任何 Mac 雙擊就開、無 Gatekeeper 警告"
echo "  • SHA256 可以放網站 download 頁讓 user 自己驗"
echo "════════════════════════════════════════════════════════════"

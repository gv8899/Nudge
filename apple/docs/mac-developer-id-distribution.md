# Mac Developer ID 分發踩坑記錄

> 目的：給陌生人從網站下載 `.dmg`、雙擊就開、能登入。  
> 寫於 2026-05-07，環境：macOS 26.3 (Tahoe), Xcode 26 SDK, Swift 6.

最終可工作配置直接看 [§9 Final config](#9-final-config)。中間踩過的坑都記在後面。

---

## 1. 三張憑證、三種用途，**不要混用**

| Cert | 用途 | 我們有嗎 | 怎麼來 |
|---|---|---|---|
| **Apple Development** | 開發機本機跑 Debug | ✅ Xcode 自動產 | Xcode → Settings → Accounts |
| **Apple Distribution** | App Store / TestFlight 上傳 | ✅ | Xcode → Manage Certificates → + |
| **Developer ID Application** | **直接給人下載** ← 我們要的 | 一開始沒有，後補 | 同上，選對 type |

最常踩的坑：**第一次用 Apple Development cert 簽 + 包 DMG，自己 Mac 開得起來、傳給別人就「無法打開」**。原因：Apple Development profile 限定 `ProvisionedDevices`（只 list 自己 Mac 的 UDID），別台 Mac 不在裡面 → Gatekeeper 拒絕 launch。

**正確路線**：必須用 Developer ID Application cert，並且 archive 出來的 .app 重新簽 + notarize + staple。

---

## 2. Notarization 流程是必須的，不是 optional

modern Mac (10.15+) Gatekeeper 預設要求**已 notarize 的 app**才能無警告開啟。

完整 pipeline：
```
xcodebuild archive
  → 把 .app 從 .xcarchive 抽出來
  → codesign with Developer ID Application + --options runtime + entitlements
  → xcrun notarytool submit --wait    (把 .app 上傳給 Apple notary 後端)
  → xcrun stapler staple              (把 ticket 嵌入 .app)
  → hdiutil create DMG
  → codesign DMG 自己（用同一張 Developer ID）
  → notarytool submit DMG --wait
  → stapler staple DMG
```

`apple/scripts/build-dmg.sh` 把這 8 步串起來。

### 必要前提

1. **Hardened Runtime 開啟** (`ENABLE_HARDENED_RUNTIME: YES`) — notarization 必要條件，沒開 Apple 不收。對 sandboxed app 沒額外限制。
2. **ASC API key** 存進 keychain：
   ```bash
   xcrun notarytool store-credentials NUDGE_NOTARY \
     --key ~/.appstoreconnect/private_keys/AuthKey_XXXXXXXXXX.p8 \
     --key-id XXXXXXXXXX \
     --issuer YOUR-ISSUER-UUID
   ```
   API key role 設 **Developer** 即可（夠 notarize 用），但**不夠**創 Developer ID provisioning profile（要 App Manager+；Profile 我們手動從 Apple Developer 網頁建）。

---

## 3. Apple Development profile vs Developer ID profile

archive 時 xcodebuild 預設用 Apple Development cert + 自動產的 wildcard provisioning profile，這個 profile 含 `ProvisionedDevices` 限定 list。

**修法**：archive 後手動 codesign 前，**砍掉 archive 帶來的 embedded.provisionprofile**，換成手動建的 Developer ID profile（特性：`ProvisionsAllDevices: true`）：

```bash
# 在 build-dmg.sh 內
rm -f "$APP_PATH/Contents/embedded.provisionprofile"
cp "$APPLE_DIR/Nudge-macOS.provisionprofile" "$APP_PATH/Contents/embedded.provisionprofile"
```

### 創 Developer ID Provisioning Profile 步驟（手動、約 5 分鐘）

1. https://developer.apple.com/account/resources/identifiers/list
   - 確認 `tw.nudge.mac` App ID 存在（沒有就先建，type = App, Explicit）
   - **Capabilities 區塊不用勾任何東西**（Apple Web 上**沒有** Keychain Sharing 選項；它是自動的）
2. https://developer.apple.com/account/resources/profiles/add
   - Distribution → **Developer ID** → Continue
   - App ID 選 `tw.nudge.mac`
   - Cert 選 `Developer ID Application: ...`
   - Generate → Download → 存成 `apple/Nudge-macOS.provisionprofile`
   - `.gitignore` 已含 `apple/*.provisionprofile`，不會誤進 repo

---

## 4. App Sandbox 對 Developer ID 分發 **不是必要的**

很多人以為 Mac App 都要 sandbox。實際上 sandbox 是 **Mac App Store 才強制**；Developer ID 直接分發版本不用 sandbox（1Password、Sketch、Discord 等 DMG 版都沒 sandbox）。

我們選擇關掉 sandbox：
```yaml
ENABLE_APP_SANDBOX: NO
```
原因：sandbox + 一些 SDK（如 Google Sign-In）的 keychain 用法在 macOS 26 嚴格 AMFI 環境下會引發連鎖問題，繞太大圈。Hardened Runtime 仍保留（notarization 必要）。

---

## 5. `keychain-access-groups` 是 restricted entitlement

不論 sandbox 開不開、不論 Mac App Store 還是 Developer ID 分發，[Apple docs](https://developer.apple.com/documentation/bundleresources/entitlements/keychain-access-groups) 寫死：

> "The keychain-access-groups entitlement **must be allowlisted by a profile**"

意思是：要用這個 entitlement，**.app 內必須嵌入授權它的 Developer ID provisioning profile**。沒 profile 就用 → AMFI 在 launch 時直接 SIGKILL，連你看到 dialog 都來不及。

我們的 entitlements file 用展開後的真值（不能寫 `$(AppIdentifierPrefix)` build variable，手動 codesign 不會 substitute）：
```xml
<key>keychain-access-groups</key>
<array>
    <string>B9NC8LR2HQ.tw.nudge.mac</string>
    <string>B9NC8LR2HQ.com.google.GIDSignIn</string>
</array>
```

⚠️ **不要加 `application-identifier` / `team-identifier`**：實測加了反而觸發 macOS 的 iOS-style 嚴格驗證，app 連 launch 都過不了。Profile 自己會 list 這兩個但**不要塞進 .app entitlements**。

---

## 6. 手動 codesign 流程

xcodebuild `-exportArchive` 預設要 Developer ID provisioning profile，但 ASC API key Developer role 沒權限自動創 → 失敗。**繞過 exportArchive，從 archive 直接抽 .app + 自己 codesign**：

```bash
# 從 archive 抽 .app
cp -R "$ARCHIVE_PATH/Products/Applications/Nudge-macOS.app" "$EXPORT_DIR/"
APP_PATH="$EXPORT_DIR/Nudge-macOS.app"

# 替換 embedded provisioning profile
rm -f "$APP_PATH/Contents/embedded.provisionprofile"
cp "$APPLE_DIR/Nudge-macOS.provisionprofile" "$APP_PATH/Contents/embedded.provisionprofile"

# Codesign with Developer ID + Hardened Runtime + entitlements
codesign --force --deep --sign "$SIGNING_IDENTITY" \
    --options runtime \
    --entitlements "$APPLE_DIR/Nudge-macOS/Nudge-macOS.entitlements" \
    --timestamp \
    "$APP_PATH"
```

### 注意

- `--deep` 雖然 Apple deprecated 但對 re-sign archive 流程仍 work，比一個個 nested bundle 各做一次 `--timestamp` (TSA 每個 binary roundtrip 累計 10+ 分鐘) 快很多
- `--timestamp` 必要（notarization 要求所有簽章 RFC3161 timestamped）
- **必須先 grant codesign 訪問 Developer ID Application 私鑰的 Keychain ACL**（Keychain Access → My Certificates → 展開 cert → 雙擊 private key → 存取控制 → 「允許所有應用程式存取此項目」），否則 codesign 會跳對話框等待、process 卡 0% CPU 沒輸出

---

## 7. **最大的坑：Swift 6 + ASWebAuthenticationSession 必 crash**

Google Sign-In SDK 在 macOS 用 GTMAppAuth + 系統 data protection keychain，沒 `keychain-access-groups` entitlement 會炸 -2。我們改用手動 OAuth（`ASWebAuthenticationSession` + PKCE）繞過 SDK，但碰到 **Swift 編譯器另一個 bug** ([swift issue #75453](https://github.com/swiftlang/swift/issues/75453))：

> "incorrect actor isolation assumption across Swift 5/6 module boundary leads to dispatch_assert_queue crashes"

具體 crash signature：
```
Thread N Crashed:: Dispatch queue: com.apple.NSXPCConnection.m-user.com.apple.SafariLaunchAgent

0  _dispatch_assert_queue_fail
1  dispatch_assert_queue$V2.cold.1
2  dispatch_assert_queue
3  swift_task_checkIsolatedSwift
4  swift_task_isCurrentExecutorWithFlagsImpl
5  Nudge-macOS  ← 我們的 cont.resume()
6  Nudge-macOS  ← 我們的 closure
7  ASWebAuthenticationSession completion handler
```

ASWebAuthenticationSession 是 Apple Swift 5 framework，從 XPC 背景 queue invoke 我們 closure。Swift 6 編譯器 isolation inference 錯誤把 closure 推成 `@MainActor` isolated → runtime 在 callback 觸發時 `dispatch_assert_queue("我在 main")` → 不在 → SIGTRAP。

### 修法

**Mac target 降到 Swift 5 mode + minimal concurrency**（iOS 維持 Swift 6 + complete）：
```yaml
Nudge-macOS:
  settings:
    base:
      SWIFT_VERSION: "5"
      SWIFT_STRICT_CONCURRENCY: minimal
```

這個 bug 跟所有「Swift 5 framework 在 background queue invoke 你的 closure」場景都會踩到（不只 ASWebAuthenticationSession）。Swift issue 至 2026-05 仍 open。

---

## 8. Google OAuth 手動實作概要

放棄 Google Sign-In SDK 換手動 OAuth，繞掉 SDK 的 keychain 依賴：

1. PKCE: 32 byte 隨機 verifier → SHA256 → base64url challenge
2. 開 Google authorize URL: `https://accounts.google.com/o/oauth2/v2/auth?client_id=...&redirect_uri=com.googleusercontent.apps.<reverse>:/oauth2redirect/google&response_type=code&scope=openid+email+profile&code_challenge=...`
3. ASWebAuthenticationSession 處理 user 登入 + redirect 回 app
4. 從 callback URL 抽 `code` + 驗 `state`
5. POST `https://oauth2.googleapis.com/token` 用 code + verifier 換 idToken
6. idToken 給後端走我們自己的 session

完整實作見 `apple/Nudge-macOS/GoogleSignInService+macOS.swift`。沒 keychain 持久化（重新登入即可）。

⚠️ Class **不能** `@MainActor` —— class 上 @MainActor 讓 captured closure 也 implicit isolated；ASWebAuth 從背景 queue invoke 時觸發 §7 那個 crash。改用 nonisolated class + `DispatchQueue.main.async` 顯式排到主線程做 NSWindow / session.start，背景 callback 內**只 cont.resume()、絕不碰任何 main-only API**。

---

## 9. Final config

### `apple/project.yml`（macOS target settings）

```yaml
Nudge-macOS:
  type: application
  platform: macOS
  deploymentTarget: "15.0"
  settings:
    base:
      PRODUCT_BUNDLE_IDENTIFIER: tw.nudge.mac
      ENABLE_APP_SANDBOX: NO              # Developer ID 不要求 sandbox
      ENABLE_HARDENED_RUNTIME: YES        # notarization 必要
      SWIFT_VERSION: "5"                  # 繞 swift issue #75453
      SWIFT_STRICT_CONCURRENCY: minimal   # 同上
      CODE_SIGN_ENTITLEMENTS: Nudge-macOS/Nudge-macOS.entitlements
```

### `apple/Nudge-macOS/Nudge-macOS.entitlements`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" ...>
<plist version="1.0">
<dict>
    <key>keychain-access-groups</key>
    <array>
        <string>B9NC8LR2HQ.tw.nudge.mac</string>
        <string>B9NC8LR2HQ.com.google.GIDSignIn</string>
    </array>
</dict>
</plist>
```

僅此而已。**沒有** `application-identifier` / `team-identifier` / `app-sandbox` / `network.client` / `files.user-selected.read-write`。

### `apple/Nudge-macOS.provisionprofile`（gitignored）

從 Apple Developer 網頁手動建 Developer ID provisioning profile（App ID = `tw.nudge.mac`）下載放這。

### Build / ship

```bash
./apple/scripts/build-dmg.sh
```

跑完拿到 `~/Downloads/Nudge-1.0.0-{N}.dmg`，**任何 Mac 雙擊就開、無警告、能登入**。

---

## 10. 別再做的事

| ❌ 不要 | 為什麼 |
|---|---|
| 用 Apple Development / Apple Distribution cert 包 DMG 給別人 | 別台 Mac 不在 ProvisionedDevices 裡 → Gatekeeper 拒絕 |
| 用 `xcodebuild -exportArchive` with `developer-id` method | 需要 ASC API key 有 App Manager 權限自動創 profile，麻煩；自己 codesign 更直接 |
| 在 entitlements 加 `application-identifier` 或 `team-identifier` | 觸發 macOS iOS-style 嚴格驗證，app 不啟動 |
| 留 archive 帶來的 Apple Development embedded.provisionprofile | 限定 ProvisionedDevices，別台 Mac 不在 |
| 把 class 標 `@MainActor` 後又在裡面用 `withCheckedThrowingContinuation` 包 ASWebAuthenticationSession | swift issue #75453 → 100% crash |
| 用 `MainActor.assumeIsolated { ... }` 在被 framework 從背景 queue 呼叫的 method 內 | assert 失敗 → SIGTRAP |
| 一個個 nested bundle 套 `--timestamp` codesign | TSA 每個 binary 一個 roundtrip，10+ 分鐘起跳；用 `--deep` 一次性 |
| 用 Google Sign-In SDK 在 sandboxed mac app | SDK 內部 keychain 寫入要 keychain-access-groups → 又要 provisioning profile → 維護成本爆 |

---

## References

- Apple official: [Keychain Access Groups Entitlement](https://developer.apple.com/documentation/bundleresources/entitlements/keychain-access-groups)
- Apple official: [Resolving Common Notarization Issues](https://developer.apple.com/documentation/security/resolving_common_notarization_issues)
- Swift bug: [#75453 — actor isolation assumption across Swift 5/6 boundary](https://github.com/swiftlang/swift/issues/75453)
- Apple forum: [Configuring keychain sharing](https://developer.apple.com/documentation/xcode/configuring-keychain-sharing)
- GTMAppAuth README: [data protection keychain on macOS](https://github.com/google/GTMAppAuth)
- Google Sign-In iOS issue [#492](https://github.com/google/GoogleSignIn-iOS/issues/492) / [#165](https://github.com/google/GoogleSignIn-iOS/issues/165) (相關但不解這個場景)

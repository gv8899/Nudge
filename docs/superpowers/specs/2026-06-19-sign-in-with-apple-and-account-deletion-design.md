# Sign in with Apple + 帳號刪除 設計

**Goal:** iOS + macOS 原生加 Sign in with Apple（App Store 4.8 強制：有第三方登入就要有 Apple 登入），並補「刪除帳號」流程（5.1.1(v) 強制：能建帳號就要能刪）。

**Architecture:** 鏡像現有 Google 原生流程 —— app 拿 Apple identityToken → 新後端 `/api/auth/apple` 用 jose 驗 Apple JWKS → 連結/建帳號 → 簽我們自己的 app JWT（HS256）→ 存 keychain。刪帳號走 `DELETE /api/me`（cascade）。

**Tech Stack:** AuthenticationServices（原生）、jose（已是依賴，驗 Apple JWT）、drizzle（schema + 手動 migration）、現有 `signJWT`/keychain/AuthRepository。

---

## 1. 範圍

**做**：iOS + macOS 原生 Apple 登入；後端 `/api/auth/apple`；`users.apple_sub` 欄位 + migration；刪帳號（原生 UI + `DELETE /api/me`）。

**不做（YAGNI）**：web NextAuth 的 Apple provider（web 不在 App Store 審查範圍）；Apple `authorizationCode` 的 server-side token 交換 / refresh（identityToken JWT 驗章已足夠登入，比照 Google idToken）；帳號合併 UI（relay 信箱一律自成新帳號）。

## 2. 帳號連結策略（已拍板）

`users` 加 `apple_sub`（穩定 Apple user id）。登入時：
1. 找 `apple_sub == sub` → 有就用。
2. 否則 token 內有 `email` 且該 email 已有帳號 → 把 `apple_sub` 補到該帳號（email 併號）。
3. 否則建新帳號（Apple「隱藏信箱」relay 地址會走這條、自成一帳號）。

> Apple 只在**首次授權**回 email + 名字；之後只給 `sub` → 所以一定要存 `apple_sub` 當穩定鍵，不能只靠 email。

## 3. 後端

### 3.1 Schema + migration
- `src/lib/db/schema.ts`：`users` 加 `appleSub: text("apple_sub").unique()`（nullable）。
- `drizzle/00XX_add_apple_sub.sql`：`ALTER TABLE users ADD COLUMN apple_sub text;` + `CREATE UNIQUE INDEX ... ON users(apple_sub);`（nullable、無 default → 對舊資料安全；依部署鐵則先上相容 code 再跑或同時）。

### 3.2 `POST /api/auth/apple/route.ts`（新增，結構抄 `auth/mobile`）
- 收 `{ identityToken: string, fullName?: string, email?: string }`。
- 驗章：`const JWKS = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"))`；`jwtVerify(identityToken, JWKS, { issuer: "https://appleid.apple.com", audience: ["tw.nudge.app", "tw.nudge.mac"] })`。
- 取 `sub`、`email`（payload，首次/有時才有）、`is_private_email`。
- 連結（見 §2）。建新帳號時 `email` 取 payload.email ?? body.email；`name` 取 body.fullName ?? null；`id = nanoid()`、`createdAt = now`、Google Calendar 欄位都 null。
- `signJWT({ userId, email: user.email })` → 回 `{ token, user: {...} }`（欄位同 `auth/mobile`）。
- 錯誤：缺 token 400；驗章失敗 401。

### 3.3 `DELETE /api/me`（在現有 `src/app/api/me/route.ts` 加 handler）
- `getUser()` 取認證使用者（同 GET）；未認證 401。
- `await db.delete(users).where(eq(users.id, user.id))` —— 所有 user-scoped 表都 `onDelete: cascade`（tasks/recurrences/tags/assignments…），一刀 cascade 乾淨。
- 回 `{ success: true }`。

## 4. 原生（iOS + macOS）

### 4.1 entitlements（兩 target）
- `Nudge-iOS/Nudge-iOS.entitlements` 與 `Nudge-macOS/Nudge-macOS.entitlements` 加：
  `com.apple.developer.applesignin` = `["Default"]`（array）。
- **手動前置（agent 做不到）**：Apple Developer portal 把 App ID `tw.nudge.app`、`tw.nudge.mac` 都勾啟 **Sign in with Apple** capability，automatic signing 才簽得出帶該 entitlement 的版本。

### 4.2 `AppleSignInService`（NudgeCore 或各 target 殼層）
- 用 `ASAuthorizationAppleIDProvider().createRequest()`，`requestedScopes = [.fullName, .email]`，跑 `ASAuthorizationController`。
- 成功取 `ASAuthorizationAppleIDCredential`：`identityToken`(Data→UTF8 String)、首次的 `fullName`(PersonNameComponents → 組成顯示名)、`email`。
- 回傳 `(identityToken, fullName?, email?)` 給 AuthRepository。
- macOS / iOS presentation anchor：實作 `ASAuthorizationControllerPresentationContextProviding`（給目前 window）。

### 4.3 `AuthRepository.loginWithApple(identityToken:fullName:email:)`
- 鏡像 `login(idToken:)`：`POST /api/auth/apple` body `AppleAuthRequest` → 存 keychain → `status = .authenticated(user)`。
- 新增 DTO `AppleAuthRequest { identityToken, fullName?, email? }`、沿用 `MobileAuthResponse`/`UserDTO`。

### 4.4 `AuthRepository.deleteAccount()`
- `DELETE /api/me`（APIClient 已有 `delete`）→ 成功後 `keychain.remove(token)` + `status = .unauthenticated`。

### 4.5 UI
- `LoginView`：Google 鈕旁加官方 `SignInWithAppleButton`（SwiftUI，`.signIn`，黑/白依 colorScheme，圓角同既有鈕）。點擊跑 AppleSignInService → `loginWithApple`。
- `SettingsView`：加「刪除帳號」`NudgeButton(variant: .destructive)` → 確認 alert（「刪除後資料無法復原」）→ `deleteAccount()`。放在登出附近。

## 5. i18n
- 新字串：`settings.deleteAccount`、`settings.deleteAccountConfirmTitle`、`settings.deleteAccountConfirmBody`、`common.delete`（若無）。
- 流程：先加進 `i18n/canonical/zh-TW.json` → `npm run i18n:sync` → 再把同 key + 翻譯鏡像進 `apple/.../Localizable.xcstrings`。Apple 登入鈕文字由系統提供、免 i18n。

## 6. 測試（Definition of Done）
- `npx next build` 過、`npm test` 過（若動到純邏輯）。
- macOS `swift build` + **完整 `xcodebuild -scheme Nudge-iOS/-macOS build` 過**。
- 互動實測（sim/實機 + 真 Apple ID）：
  - Apple 登入 → 後端建帳號 → 重啟 app `restoreSession` 仍登入。
  - email 併號：先用某 Google email 登入建帳號，再用「同 email 的 Apple ID」登入 → 應併到同一帳號（同樣 tasks）。
  - 刪除帳號 → 確認後登出、回登入頁；重新登入應是全新空帳號（資料已 cascade 刪除）。
- entitlement 沒在 portal 開的話，裝置上 Apple 登入會直接失敗 → 需先確認 portal 設定。

## 7. 邊界 / 注意
- identityToken 過期（exp 短）→ 驗章失敗回 401，app 顯示錯誤、可重試。
- relay 信箱（`is_private_email`）：照存，會轉發；不嘗試跨 provider 併號。
- 部署順序：先讓含 `apple_sub` 讀寫的 code 上線、再/同時跑 migration（nullable 欄位、舊 code 不受影響）。

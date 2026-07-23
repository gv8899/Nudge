# Sign in with Apple — Web + Mac 補齊（跨端同帳號）

日期：2026-07-23
狀態：設計已確認

## 目標

對齊主流「所有平台同一組登入 provider」策略：Web 與 macOS 補上 Sign in with Apple，讓 iPhone 用 Apple ID 註冊/付費的使用者（含「隱藏我的電子郵件」relay 信箱）在 Mac / Web 登入同一個帳號、entitlement 直接生效。iOS 原生流程不動。

背景：billing spec §4（`2026-06-20-phase1-billing-auth-design.md`）已定調 Web 要走 Services ID；本 spec 補上具體設計與 Mac 端。

## 關鍵約束（決定架構的事實）

- Apple web OAuth 的 return URL **必須是註冊過的 https 網域**，不能 redirect 到 custom scheme、不能 localhost → Mac 必須走「伺服器中繼」；驗收在 prod（產品未發佈，風險可接受）。
- macOS 原生 SIWA 需要 restricted entitlement + 內嵌 provisioning profile（Developer ID 分發會 AMFI SIGKILL）→ 不走原生，走 web OAuth（`ASWebAuthenticationSession`），與 Mac 既有 Google 登入同體驗。
- 後端 `/api/auth/apple`（原生 POST）已有三段併號與 `aud` 白名單；`users.apple_sub` UNIQUE 欄位已存在，**免 migration**。

## 架構總覽

```
iOS（不動）   原生 SignInWithAppleButton → POST /api/auth/apple（identityToken）
Web（新）     NextAuth Apple provider（Services ID + form_post）→ signIn callback 併號
Mac（新）     ASWebAuthenticationSession
                → GET  /api/auth/apple/start?source=mac     （state+nonce cookie → redirect Apple）
                → Apple 授權（form_post）
                → POST /api/auth/apple/callback              （驗 state/nonce → code 換 token → 併號 → 簽 app JWT）
                → redirect nudge://auth/apple#token=<appJWT> （fragment，不進 log）
                → 殼層取 token 存 keychain
```

三個入口共用同一個併號核心。

## 元件設計

### 1. 併號核心 `src/lib/auth/apple-account.ts`

從 `/api/auth/apple/route.ts` 抽出 `findOrCreateAppleUser({ sub, email, name, locale }): Promise<User>`：

1. `apple_sub` 命中既有帳號 → 回傳；
2. 未命中但 email 命中既有帳號 → UPDATE 補 `apple_sub`（email 併號）→ 回傳；
3. 都沒有 → 建新帳號（無 email 時 `${sub}@appleid.nudge.local` placeholder）+ `provisionNewUser(locale)`。

消費者：原生 POST route（iOS，行為不變）、NextAuth `signIn` callback（Web）、`/api/auth/apple/callback`（Mac）。

### 2. Web（NextAuth）

- `src/lib/auth.ts`：
  - 加 Apple provider，`clientId = AUTH_APPLE_ID`（Services ID）、`clientSecret = AUTH_APPLE_SECRET`（.p8 預簽 ES256 JWT，效期上限 6 個月；重簽 script 見附錄 B）。`AUTH_APPLE_ID` 未設時不註冊 provider（feature flag）。
  - `signIn` callback 雙軌：`account.provider === "apple"` → `findOrCreateAppleUser`（sub 優先）；Google 維持現行 email 比對。
  - session 由「email 現查 DB」改為「signIn 時把 `dbUser.id` 寫入 NextAuth JWT（`jwt` callback），`session` callback 直接讀」— 消除隱藏信箱帳號的 email 查找歧義，也省每請求一次 DB 查詢。
- `/login` 頁：Apple 按鈕（黑底白字 + Apple logo，官方樣式）排 Google 下方（與 iOS 順序一致）；`AUTH_APPLE_ID` 未設時整顆不渲染。
- i18n：`login.signInWithApple` key 走 canonical → sync 流程（web messages + xcstrings 鏡像，Mac 按鈕共用）。

### 3. Mac 伺服器中繼 endpoints

- `GET /api/auth/apple/start?source=mac`
  - 產 `state`、`nonce`（隨機）→ 寫 httpOnly cookie（5 分鐘）→ 302 到 `https://appleid.apple.com/auth/authorize`（`client_id=Services ID`、`response_type=code`、`response_mode=form_post`、`scope=name email`、`redirect_uri=<AUTH_URL>/api/auth/apple/callback`、`state`、`nonce`）。
  - env 未設 → 404。
- `POST /api/auth/apple/callback`（Apple form_post）
  - 驗 `state` 與 cookie 相符 → 用 `code` 打 `https://appleid.apple.com/auth/token` 換 `id_token`（client_secret 同 Web 那把）→ `jose` 驗簽（issuer/audience=Services ID）+ 驗 `nonce` claim → 取 `sub`/`email`（首次另有 `user` 欄位帶 name）→ `findOrCreateAppleUser` → `signJWT({ userId, email })` → 302 `nudge://auth/apple#token=<appJWT>`。
  - 使用者取消（`error=user_cancelled_authorize`）→ 302 `nudge://auth/apple#error=cancelled`；其他錯誤 → `#error=<code>`。

### 4. Mac 殼層

- 新檔 `apple/Nudge-macOS/AppleSignInService+macOS.swift`：結構鏡像 `GoogleSignInService+macOS.swift`（**非 `@MainActor`**、`@Sendable` callback——同一坑不再踩）。`ASWebAuthenticationSession(url: <AUTH_URL>/api/auth/apple/start?source=mac, callbackURLScheme: "nudge")`，解析 callback URL fragment 的 `token` / `error`。
- `AuthRepository` 加 `loginWithAppleToken(_ token: String)`：直接存 keychain + 拉 user profile（不打 `/api/auth/apple` POST）。
- `LoginView`：appleButton 從 `#if os(iOS)` 擴為雙平台——iOS 維持原生 `SignInWithAppleButton`；macOS 自訂同樣式按鈕（SF Symbol `apple.logo`，黑/白依 colorScheme，50pt 高 Capsule，與 Google 鈕同寬），接 `onAppleWebLogin` closure（由 `NudgeMacApp` 注入）。Mac 不做 client 端 flag（接受憑證未設期間按鈕短暫報錯；產品未發佈）。
- iOS target 完全不動。

### 5. 錯誤處理

- Mac：`#error=cancelled` 靜默（對齊 iOS 取消行為）；其他 error 顯示紅字。
- Web：走 NextAuth 既有 error → `/login` 頁。
- callback 驗證失敗（state/nonce/簽章）一律 401 或 `#error=invalid`，不落任何帳號。

## 外部前置（Mike 於 Apple Developer 後台，實作合併後、驗收前）

1. Identifiers → 新建 **Services ID**（建議 `tw.nudge.web`），啟用 Sign in with Apple，**群組到 iOS App ID（`tw.nudge.app`）同一 primary**（關鍵：同 primary 群組內 `sub` 相同，跨端才是同一人）。
2. Services ID 設定 domain：`nudge.tw`；Return URLs：`https://nudge.tw/api/auth/callback/apple`（NextAuth）與 `https://nudge.tw/api/auth/apple/callback`（Mac 中繼）。
3. Keys → 建 Sign in with Apple Key，下載 `.p8`（**備份**，只可下載一次），記 Key ID。
4. 產 client secret（附錄 B script）→ Zeabur env：`AUTH_APPLE_ID=tw.nudge.web`、`AUTH_APPLE_SECRET=<ES256 JWT>`。
5. （可選）Certificates 頁註冊隱藏信箱轉寄網域，未來寄信給 relay 位址才會送達。

## 測試與驗收

- 單元（vitest）：`findOrCreateAppleUser` — sub 命中／email 併號補 sub／relay 新帳號／無 email placeholder／locale provision。
- 迴歸：iOS 原生 Apple 登入、Web Google 登入、Mac Google 登入不受影響（build + 實測）。
- 端對端（prod，憑證就位後）：
  1. Web Apple 登入 — 新帳號、以及「iOS 已用 Apple 註冊」的既有帳號登入後是同一人；
  2. Mac Apple 登入 — 同上兩情境；取消授權不顯示錯誤；
  3. 核心驗收：iPhone Apple 帳號（隱藏信箱）→ Mac Apple 登入 → 同帳號、訂閱 entitlement 可見。

## 附錄 A：不做的事（YAGNI）

- 設定頁「手動連結帳號」——等真實客訴再議。
- Mac 原生 SIWA（provisioning profile 路線）——維持否決。
- googleSub 欄位 / Google 的 sub 比對——Google email 穩定，現行 email 比對維持。

## 附錄 B：AUTH_APPLE_SECRET 重簽（效期 ≤ 6 個月）

```bash
# 需要：.p8 私鑰、Key ID、Team ID、Services ID
node scripts/sign-apple-secret.mjs \
  --key AuthKey_XXXXXX.p8 --kid <KeyID> --iss <TeamID> --sub tw.nudge.web
# 輸出 ES256 JWT → 更新 Zeabur AUTH_APPLE_SECRET（到期前重跑）
```

（`scripts/sign-apple-secret.mjs` 為本次實作新增，用 jose 簽 `iss/iat/exp/aud=https://appleid.apple.com/sub=<ServicesID>`。）

# Phase 1 設計：帳號識別 + Entitlement + Paddle 訂閱（Web/Mac）

> 狀態：**設計 spec**（已與 Mike 確認）。實作前由 writing-plans 產出 plan。
> 寫於 2026-06-20。上層策略見 [`docs/金流訂閱與Mac更新策略.md`](../../金流訂閱與Mac更新策略.md)。
> 對應策略文件的 **Phase 1**。

---

## 1. 目標 & 範圍

把 Nudge 變付費訂閱的**第一階段地基**：帳號跨平台可識別、後端有訂閱真相、Web/Mac 能用 Paddle「先綁卡試用」開通並擋付費牆。

**做（Phase 1）**
- Web 加 **Sign in with Apple** + 跨平台帳號識別（`apple_sub` 比對）。
- 後端 **entitlement** 資料模型 + 讀取 API + 寫入（Paddle webhook）。
- **Paddle Billing** 結帳：先綁卡 → 7 天試用 → 自動扣。
- **試用邏輯**：7 天、綁 `user_id`、一個帳號一生一次。
- **Paywall 硬牌：Web + Mac**。

**不做（留後續）**
- iOS IAP / RevenueCat → Phase 2。
- Mac Sparkle 自動更新 → Phase 3。
- 台灣在地金流（綠界/藍新 + 發票）→ Phase 4。
- iOS / Flutter 硬 gate（Phase 1 只讀 entitlement、不硬擋，等各自付費路徑到位）。

## 2. 已確認決策（brainstorming 結論）

| # | 決策 |
|---|---|
| 既有用戶 | **一律走試用 → 付費**，不 grandfather（含現有帳號） |
| 付費牆 | **硬牌**：登入後無有效訂閱 → 擋在 paywall，要綁卡才能用 app |
| Phase 1 強制範圍 | **只 Web + Mac**（皆可走 Paddle）；iOS/Flutter 暫不硬鎖 |
| 離線 gate（Mac） | **快取 + 寬限期**：快取最後 entitlement，離線時在期限內（+14 天寬限）放行，上線重驗 |
| iOS 價格 | 與 web **同價**（吃 Apple 抽成）— 屬 Phase 2 |
| 收款主體 | Web/Mac 走 **Paddle（MoR，代收代繳稅）** |

## 3. 資料模型

`users` 既有表新增：
- `apple_sub TEXT UNIQUE NULL` — Sign in with Apple 的穩定使用者識別碼。
- `trial_started_at TEXT NULL` — 首次試用時間，用來保證**一生一次**試用（綁帳號、不綁裝置）。

新表 `subscriptions`（**一個 user 最多一筆有效**，entitlement 真相來源）：

| 欄位 | 說明 |
|---|---|
| `id` | PK |
| `user_id` | FK → users（unique，one active per user） |
| `status` | `trialing` / `active` / `past_due` / `canceled` / `expired` |
| `plan` | `monthly` / `annual` |
| `source` | `paddle` / `apple` / `manual`（Phase 1 只有 paddle/manual） |
| `current_period_end` | 本期到期（ISO 字串，與專案慣例一致） |
| `trial_end` | 試用到期（nullable） |
| `paddle_customer_id` / `paddle_subscription_id` | Paddle 外部 ID |
| `cancel_at_period_end` | bool |
| `created_at` / `updated_at` | |

後端 helper（單一真相）：
```
hasActiveEntitlement(userId): boolean
  = 最新 subscription.status ∈ {trialing, active} 且 now < current_period_end
```

> Migration 依專案慣例：改 `src/lib/db/schema.ts` → `drizzle-kit generate` → 人工檢視 → 依序手動跑 `psql -f`。注意 dev/prod 共用 Postgres，先上相容 code 再跑 migration（新欄位 nullable）。

## 4. 帳號識別（Sign in with Apple 上 Web）

**問題**：Apple 隱藏信箱用戶（中繼 email）在 iOS 用 SIWA 建帳號後，要用 Web 只能也走 Apple 登入；用 Google 會因 email 不同變成兩個帳號、看不到訂閱。

**設計**
- NextAuth 加 **Apple provider**（web 走 Services ID + Sign in with Apple JS；Windows/Linux/Android 任何瀏覽器皆可，與裝置無關）。
- `signIn` callback 改為：**先用 provider identity（Apple `sub`）比對** → 命中即該帳號；未命中再退 email；首次登入存 `apple_sub` + `name`（`name` 只在首次回傳）。
- 放寬現況「強制 email + 用 email 唯一比對」（`src/lib/auth.ts`）以容納隱藏信箱。
- `/login` 加 **Apple 按鈕**（Google / Apple 兩顆）。

**外部設定（需 Mike 在 Apple Developer 後台做，寫進 plan 的前置）**
1. 建 **Services ID** 並**群組到 iOS 同一個 primary App ID** → web 與 iOS 拿到的 `sub`/中繼 email 才一致（沒群組 = 同一人變兩帳號，最常踩）。
2. 設定 web return URL / domain。
3. 私密信箱中繼：若要寄信給隱藏 email，註冊寄件網域（否則 Paddle 等寄件被擋；Phase 1 影響小，列風險）。

## 5. 金流：Paddle Billing（先綁卡試用）

- 用 **Paddle Billing**（非 Classic）。建 1 Product + 2 Price（monthly / annual），帶 **7 天 trial**；另備一組**無 trial** 的 price 給「已用過試用」者。
- **結帳流程**：Web/Mac paywall → Paddle Checkout（帶 `user_id` 進 `customData`）→ **收卡** → Paddle 建 `trialing` 訂閱 → 7 天後自動扣轉 `active`。
- **Webhook**（`subscription.created/updated/canceled`、`transaction.completed/.payment_failed`）：
  - **驗簽**（Paddle signature）+ **冪等**（event id 去重）。
  - 依 `customData.user_id` upsert `subscriptions`。
- **試用唯一性**：建 checkout 前查 `users.trial_started_at`；
  - 沒用過 → 走帶 trial 的 price，並設 `trial_started_at = now`。
  - 用過 → 走無 trial 的 price（立即收費）。
- **Mac**：app 內「開始試用/訂閱」→ **開瀏覽器到 nudge.tw 結帳**（同帳號登入態）→ 成功後 Mac 重讀 entitlement。
- **管理/退訂**：導 Paddle customer portal（依 `source` 顯示「在哪管理」）。

## 6. Entitlement 讀取 + Paywall 強制

- `GET /api/me/entitlement` → `{ status, plan, currentPeriodEnd, trialEnd, isActive, source }`；web（NextAuth session）與 app（Bearer）共用。
- **Web**：server 端直接讀 → 無 `isActive` → 導 `/paywall`；頁面與 `src/api/*` 受保護路由用 `hasActiveEntitlement` gate。
- **Mac**：呼叫同 API、**本地快取**（含取得時間 + `current_period_end`）；離線時若快取仍在期限內（+ **14 天寬限**）放行，連上線重驗。
- **iOS / Flutter**：Phase 1 讀 entitlement 顯示狀態，但**不硬擋**（等各自付費路徑）。

## 7. 錯誤處理

- Webhook：驗簽失敗丟棄；冪等去重（event id）；upsert 失敗記錄 + 由 Paddle 重送補。
- 扣款失敗 → `past_due` → Paddle dunning 重試 + 寬限期 → 仍失敗 → `expired`（webhook 同步狀態）。
- Entitlement API 失效時：app 以本地快取 + 寬限期撐住；web 無快取則保守導 paywall（但記錄錯誤，避免誤鎖付費用戶 → 加短期 server 端容錯）。
- 防雙重訂閱：建 checkout 前若已 `isActive` → 擋住購買 UI（Phase 2 跨 Paddle/Apple 來源時更關鍵）。

## 8. 測試

- **Paddle sandbox** 跑完整：checkout → trialing → 自動扣 → active → 取消 → expired。
- `hasActiveEntitlement` / 狀態機**單元測試**（vitest，與 source 同層 `*.test.ts`）。
- 帳號識別：Apple `sub` 比對 vs email 比對、隱藏信箱、首次 vs 後續登入。
- Webhook：驗簽、冪等、各事件 → entitlement 轉換。
- Paywall gate：web 無訂閱導向、Mac 離線寬限。

## 9. 相依 / 前置（plan 要排序）

1. **Apple Developer**：建 Services ID + 群組到 App ID（Mike 操作）。
2. **Paddle**：完成 KYC（策略文件 Phase 0）、建 Product/Price、拿 API key + webhook secret。
3. **DB migration**：新欄位/新表（nullable 優先，相容 code 先上）。
4. 環境變數：Apple SIWA（client/team/key id、private key）、Paddle（api key、webhook secret、price ids）。

## 10. 不在本 spec（後續 Phase）

- iOS StoreKit IAP + RevenueCat + 跨來源 entitlement 合流（Phase 2）。
- Mac Sparkle 自動更新（Phase 3）。
- 台灣在地金流 + 發票、PPP 在地價微調（Phase 4）。
- iOS/Flutter 硬 paywall。

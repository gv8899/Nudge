# Paddle 結帳（Web + Mac）設計 spec

- 日期：2026-07-23
- 分支：`feat/paddle-checkout`
- 狀態：設計已逐段確認，待 spec review → writing-plans
- 上游文件：`2026-06-20-phase1-billing-auth-design.md`（Phase 1 總綱）、`2026-06-19-billing-entitlement-slice-a-design.md`（已上線地基）、`2026-06-20-subscription-lifecycle-states-design.md`（狀態機）、`docs/金流訂閱與Mac更新策略.md`（定價）

## 1. 範圍與決策

**這份 spec = Paddle 後端 + Web/Mac 付費牆與結帳入口 UI。** Web Sign in with Apple 為**獨立 spec**（有 OTT 手遞後不擋 Paddle 上線，見 §4）。iOS IAP、Mac Sparkle、台灣在地金流照 Phase 1 spec 維持 deferred。

| 決策 | 內容 |
| --- | --- |
| 金流 | Paddle Billing（MoR），Web/Mac 共用 |
| 定價 | **年費 $99 USD 為主、月費 $12.99 錨點**（頁面預設年費）；PPP 在地價照策略文件（TW NT$1,990/249、JP ¥14,800/1,500…）；金額不進 code，只有 price id |
| Trial | 先綁卡 7 天，**一生一次綁帳號**（`users.trial_started_at`）；已用過 → 無 trial 價直接扣款 |
| Mac→結帳 | **方案 A：一次性 token（OTT）手遞**，開預設瀏覽器；不做 in-app 結帳、不做 nudge:// callback |
| Web 結帳 | Paddle.js **overlay** 掛自有 `/paywall` 頁；不用 hosted 頁 |
| 硬付費牆 | 上線**同步開** `PAYWALL_ENFORCE_WEB/_MAC`（per-platform env flag，可隨時關回 soft） |
| Paddle 帳號 | **尚未申請** —— 開發全程 sandbox；申請/KYC 列外部前置 track |

## 2. 外部前置（不擋開發）

1. 申請 Paddle 帳號（量子躍遷有限公司 / Quantum Leap 資料）→ KYC + 網站審核（/terms /privacy /refund 已對齊 Paddle，法務頁就緒）。
2. 過審後：Dashboard 建 1 Product + **4 Prices**（月/年 × 有 trial/無 trial）→ 拿 live API key / client token / webhook secret。
3. Sandbox→live 切換清單：env 換 key 與 price id、Paddle Dashboard webhook URL 指向 prod `/api/webhooks/paddle`、真卡小額自測一輪。

## 3. 後端

### 3.1 設定 `src/lib/paddle/config.ts`

Env：`PADDLE_ENV`（`sandbox|production`）、`PADDLE_API_KEY`、`PADDLE_WEBHOOK_SECRET`、`NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`、`PADDLE_PRICE_MONTHLY_TRIAL`、`PADDLE_PRICE_ANNUAL_TRIAL`、`PADDLE_PRICE_MONTHLY_NOTRIAL`、`PADDLE_PRICE_ANNUAL_NOTRIAL`。全部進 `.env.example`。

### 3.2 Webhook `src/app/api/webhooks/paddle/route.ts`

- 驗 `Paddle-Signature`（`@paddle/paddle-node-sdk` `unmarshal`）；失敗 → 400 + log。
- **Idempotent**：新表 `webhook_events`（`event_id` text PK、`processed_at` text）——migration `0010`。重複 event → 200 skip。**亂序**：用 payload `occurred_at` 與現存狀態比對，舊事件不覆蓋新狀態。
- 事件映射（userId 取自 `customData.user_id`，全部收斂到既有 `grantAccess()` 單一寫入點）：
  - `subscription.created` / `subscription.updated` → upsert status（trialing/active/past_due/canceled）、`currentPeriodEnd`、`externalCustomerId`/`externalSubscriptionId`、`cancelAtPeriodEnd`、`plan`（由 price id 反查）、`source:"paddle"`
  - `subscription.canceled` → status=canceled（期末仍有權；到期由既有 `deriveEntitlement` 時間勝出轉 expired，零改動）
  - `transaction.payment_failed` → 不直接動狀態（Paddle dunning 主導，`subscription.updated` 會帶 past_due 進來）
- `customData.user_id` 缺/查無 → log + 200（不讓 Paddle 無限重送）；admin 以 externalSubscriptionId 人工對帳。

### 3.3 Checkout 準備 `POST /api/billing/checkout`

Web session 或 Bearer 皆可。回 `{ clientToken, priceIds:{monthly,annual}, customData:{user_id}, email, hasUsedTrial }` —— **server 依 `users.trial_started_at` 決定回 trial 價或無 trial 價**（防重領；刪帳號重建由 Slice A 的 apple_sub/email 識別擋）。已有 active 訂閱 → 回 `alreadySubscribed:true`。

### 3.4 OTT 手遞 `POST /api/billing/checkout-session`（Bearer only）

- 用既有 `signJWT` 基建簽 **60 秒、`purpose:"checkout"`** 的 token（**不建表**；單次性靠短效 + 兌換即設 session）。與登入 JWT 隔離：驗證端檢查 purpose，此 token 不能打一般 API。
- Mac 開 `https://nudge.tw/checkout?ott=<token>` → 該頁 server 端驗 token → 設 NextAuth session cookie → redirect `/paywall`。
- 失敗（過期/重放）→「連結逾時，請回 app 重試」。

### 3.5 Customer portal `POST /api/billing/portal`

`source=paddle` 且有 `externalCustomerId` → 用 Paddle API 建 portal session、回 URL（管理/取消/換卡/發票都交給 Paddle）。

## 4. Web UI

### `/paywall`（新頁，(app) group、需登入）

- 雙價卡：預設**年費 $99**（月均 $8.25、「省 37%」badge），可切月費 $12.99。顯示價用 **Paddle.js PricePreview** 拉當地化含稅價，不硬編碼。
- 文案兩版由 `hasUsedTrial` 決定：**A**（可試用）「開始 7 天免費試用——先綁卡、期滿自動扣款、隨時取消」；**B**（已用過）「訂閱 Nudge」。沿 lifecycle spec 的草稿。
- CTA → **Paddle.js overlay**（本頁蓋層，不跳走），帶 price id + `customData.user_id` + email 預填。
- 價卡下方「有兌換碼？」連結展開輸入框 → 既有 `/api/promo/redeem`。
- 已訂閱者進入 → 顯示「已訂閱」+ 導 settings。
- i18n 走 canonical → sync 慣例（三語）。

### `/checkout/success`

輪詢 `/api/me`（1s、上限 30s）至 `entitlement.isActive` → 成功畫面 +「回到 app」；逾時 →「付款處理中，稍後自動生效」（webhook 遲到兜底）。

### 硬牆（`PAYWALL_ENFORCE_WEB=1`）

- `(app)/layout` server 端 `hasActiveEntitlement` 查無權 → redirect `/paywall`。豁免：`/paywall`、`/checkout/*`、settings（保留登出/刪帳號/兌換碼）。
- **API 層不動**——牆是 UX 層非資料層（避免誤傷 app 端同帳號；iOS Phase 1 不硬鎖）。

### Settings CTA（`subscription-section.tsx`）

無權/快到期 →「升級」→ `/paywall`；`source=paddle` 有權 →「管理訂閱」→ portal URL；其他 source（apple/promo/manual/comp）維持純狀態行。

## 5. Mac UI

- **付費牆 view**：`paywall.mac`（來自 `/api/me`，server env 控制）開啟且無權 → root 取代內容的全視窗付費牆（非 modal）。價值三點 + 主 CTA（依 `hasUsedTrial` 文案）+「兌換碼」+「登出」。Design token / `NudgeButton` / xcstrings 三語鏡像照專案規矩。
- **CTA 流程**：打 `/api/billing/checkout-session` 拿 OTT → `NSWorkspace.open` 開預設瀏覽器 → web 完成結帳。
- **回同步**：`NSApplication.didBecomeActive` → refresh entitlement；牆上加「我已完成付款」手動 refresh。**不做 nudge:// callback**。
- **離線寬限**：entitlement 快取 UserDefaults；斷網沿用最後已知狀態，**超過 +14 天**未成功驗證才落牆（照 Phase 1 spec）。
- **Settings**：鏡像 web——無權「升級」（OTT 流程）；paddle 有權「管理訂閱」（portal URL 開瀏覽器）。
- **iOS 此輪不動**（不硬鎖、無購買 UI；IAP 是 Phase 2）。

## 6. 邊界 / 錯誤處理

| 情況 | 處理 |
| --- | --- |
| Webhook 晚於 success 頁 | 輪詢 30s + 「處理中」兜底；Paddle 自動重試 |
| Webhook 重送/亂序 | `webhook_events` 去重；`occurred_at` 比對防舊蓋新 |
| 簽章失敗 | 400 + log（Paddle 重試；連續失敗查 secret） |
| user_id 缺/查無 | log + 200；admin 反查 externalSubscriptionId 人工對帳 |
| OTT 過期/重放 | 60s 短效、單次用途（purpose:"checkout"）；失敗頁引導回 app 重試 |
| 已訂閱又進 /paywall | 「已訂閱」+ 導 settings，不給重複結帳 |
| trial 重複領 | server 端 `trial_started_at` 一生一次；Slice A 識別擋刪帳重建 |
| 硬牆誤傷 | per-platform env flag，關牆即回 soft，不用回滾部署 |
| 退款/爭議 | Paddle MoR 處理；webhook 照實 upsert；政策頁已對齊 |

## 7. 測試 / DoD

- **單元（vitest）**：webhook 驗簽/去重/亂序/事件映射（mock payload）；OTT 簽發/兌換/過期/purpose 隔離；trial 價選擇；`grantAccess` 映射欄位完整性。
- **整合（Paddle sandbox，逐條實走）**：web 結帳（trial 價與無 trial 價各一次）→ webhook → entitlement 翻正 → success 頁；Mac OTT → 瀏覽器 → 付款 → 回前景 refresh；取消 → 期末降權；sandbox 拒付卡 → past_due → dunning。
- **DoD**：build 過不算完成；金流手測清單（含 sandbox 測試卡號）逐項打勾；無法親測的列步驟請使用者代跑。

## 8. 上線順序（每步獨立可驗收）

1. 後端全套 + 單元測試（sandbox 可測；soft mode 下線上無入口、零影響）
2. Web `/paywall` + success + settings CTA（上線但僅主動訪問可見）
3. Mac 付費牆 + settings CTA（正常發版通路）
4. 外部：Paddle 過審 → live Product/Prices → 切 live key → 真卡小額自測
5. 翻 `PAYWALL_ENFORCE_WEB=1` + `PAYWALL_ENFORCE_MAC=1` 開牆

## 9. 不做（YAGNI / 明確排除）

- Web SIWA（獨立 spec；OTT 使其不擋本案）
- iOS IAP / RevenueCat（Phase 2）、iOS 硬牆
- nudge:// 結帳 callback、ASWebAuthenticationSession 內嵌結帳
- 自建發票/稅務處理（Paddle MoR 全包）
- PPP 價格微調自動化（Dashboard 手設）
- `subscriptions` 表結構變更（externalId 泛用欄位已夠）

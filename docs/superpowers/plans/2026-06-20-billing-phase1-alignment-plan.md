# Billing Phase 1 對齊實作 Plan（Slice A → Phase 1 spec + 納入 iOS IAP）

> **For agentic workers:** 用 superpowers:subagent-driven-development 或 executing-plans 逐 task 實作。
> **基準 spec**：`docs/superpowers/specs/2026-06-20-phase1-billing-auth-design.md`（已與 Mike 確認；目前在 `feat/download-page-polish`，待 merge main）。
> **起點**：已上線的 **Slice A**（`docs/superpowers/specs/2026-06-19-billing-entitlement-slice-a-design.md`）。
> **本 plan 的調整**：(1) 以 Phase 1 spec 為準對齊；(2) 保留 Slice A 的 promo/admin；(3) **把 iOS IAP 拉進來，當最快上線的收費管道**（不卡 Paddle KYC）。

**Goal:** 把 Slice A 的 entitlement 地基演進成 Phase 1 的真相模型，接上**三個收費來源（iOS IAP 優先、Paddle web/Mac、未來藍新）**寫進同一個 entitlement，並在有付費路徑的平台翻成硬付費牆。

**Architecture:** 一 user 一筆有效 `subscriptions`（entitlement 真相）。所有來源（apple/paddle/manual/promo）都經**單一寫入點**（演進自 Slice A 的 `grantAccess`）upsert。各平台讀 `hasActiveEntitlement` 做硬牌。

---

## 0. 保留 / 演進 / 新增 對照

| Slice A 既有 | 處置 |
|---|---|
| `src/lib/entitlement.ts`（grantAccess 單一寫入點） | **保留並演進**（改吃新欄位、加 `hasActiveEntitlement`） |
| `promo_codes` / `promo_redemptions` + `/api/promo/redeem` | **保留**（promo = grant 免費時間，寫 source=`promo`） |
| `/admin` 後台 + `/api/admin/*`（ADMIN_EMAILS） | **保留**（手動開/收權限 = source=`manual`） |
| `GET /api/me` 帶 entitlement、原生讀取/顯示 | **保留**（欄位對齊新模型） |
| `users.apple_sub`（Apple 登入功能已加） | **保留**（Phase 1 帳號識別要用） |
| `subscriptions`（精簡：source/accessUntil） | **演進**到 Phase 1 肥模型（見 Task 1） |
| soft 模式（`PAYWALL_ENFORCE` off） | **保留 flag**，各平台有付費路徑後翻硬 |

**新增**：iOS IAP（StoreKit + RevenueCat）、Web Sign in with Apple、Paddle web/Mac、Mac 離線寬限、`trial_started_at` 一生一次。

---

## 階段一：共用地基（unblocked，先做）

### Task 1：`subscriptions` schema 演進 + migration 0007
**Files:** `src/lib/db/schema.ts`、`drizzle/0007_subscriptions_phase1.sql`、`src/lib/entitlement.ts`
- `subscriptions` 改為（一 user 一筆）：
  - `userId`(PK/unique FK)、`status`(`trialing|active|past_due|canceled|expired`)、`plan`(`monthly|annual` nullable)、`source`(`apple|paddle|manual|promo`)、`currentPeriodEnd`、`trialEnd`(nullable)、`externalCustomerId`/`externalSubscriptionId`(nullable，存 RC/Paddle 外部 id)、`cancelAtPeriodEnd`(bool)、`createdAt`/`updatedAt`。
  - `accessUntil` → `currentPeriodEnd`；舊 `source` 值對應（trial→status trialing、comp→manual+active）。
- `users` 加 `trialStartedAt`（nullable，保證試用一生一次、綁帳號）。
- migration 0007：additive 新欄位（nullable）+ 回填既有列的 `status`（trial→trialing、comp→active、accessUntil→currentPeriodEnd）。**dev/prod 共用 DB，先上相容 code 再跑。**

### Task 2：entitlement helper 改寫
**Files:** `src/lib/entitlement.ts`、`src/lib/entitlement.test.ts`
- `hasActiveEntitlement(userId)` = 最新 sub `status ∈ {trialing,active}` 且 `now < currentPeriodEnd`（永久 = currentPeriodEnd null）。
- `grantAccess` 改寫新欄位（給 promo/admin/webhook 共用）；promo → source=`promo`、status=`active`、period_end=now+grantDays；admin 開永久 → source=`manual`、period_end=null。
- vitest 補狀態機（trialing/active/past_due/expired、永久、promo 疊加、trial 一生一次）紅→綠。

### Task 3：entitlement 讀取 API + flag
**Files:** `src/app/api/me/route.ts`（或新 `/api/me/entitlement`）
- 回 `{ status, plan, currentPeriodEnd, trialEnd, isActive, source }`；web（NextAuth）與 app（Bearer）共用。
- `PAYWALL_ENFORCE` 細到分平台（如 `PAYWALL_ENFORCE_IOS` / `_WEB` / `_MAC`），預設 off，各 track 完成才翻 on。

---

## 階段二：Track A — iOS IAP（**最快收費管道，優先**）

> 不卡 Paddle KYC；只要 App Store Connect 商品 + RevenueCat。iOS 能最先真正收費。

**外部前置（Mike）：**
- ASC 建 **auto-renewable subscription**（Subscription Group 內 monthly / annual；Small Business Program 15%；各設 7 天 introductory free trial）。
- RevenueCat 專案：接 ASC、建 entitlement `premium`、綁兩個 product、拿 public SDK key + webhook secret。

### Task A1：iOS 接 RevenueCat SDK + 購買流程
**Files:** `apple/project.yml`（SPM 加 RevenueCat）、`apple/NudgeKit/.../Purchases*.swift`、iOS paywall view
- App 啟動 configure RevenueCat（user id 綁我們的 userId）。
- Paywall：顯示方案（年/月、試用）、購買、**還原購買**。
- 購買成功 → RC 更新 → app 重讀 entitlement。

### Task A2：後端 RevenueCat webhook → entitlement
**Files:** `src/app/api/webhooks/revenuecat/route.ts`
- 驗證 RC webhook（Authorization header secret）+ 冪等。
- 事件（INITIAL_PURCHASE / RENEWAL / CANCELLATION / EXPIRATION / BILLING_ISSUE）→ upsert `subscriptions`（source=`apple`、status/period_end/external ids 由 RC payload 帶）→ `grantAccess`。
- 試用一生一次：Apple introductory eligibility + `trial_started_at` 雙保險。

### Task A3：iOS 硬付費牆
**Files:** iOS paywall gate（`AuthGateView` 之後加 entitlement gate）
- 登入後無 `isActive` → 擋在 paywall（要購買/還原才進 app）。`PAYWALL_ENFORCE_IOS` on。

→ **里程碑：iOS 可真正收費上線（TestFlight → App Store）。**

---

## 階段三：Track B — Web/Mac Paddle（卡 Paddle KYC）

**外部前置（Mike）：** Paddle KYC 過、Paddle Billing 建 1 Product + 2 Price（含 trial / 無 trial）、api key + webhook secret。
- 照 Phase 1 spec §5–6：Web/Mac paywall → Paddle Checkout（`customData.user_id`、先綁卡 7 天試用）→ webhook（驗簽+冪等）→ `subscriptions`（source=`paddle`）。
- Web 硬牌（server 端 `hasActiveEntitlement` gate 受保護路由）；Mac 開瀏覽器結帳 + **本地快取 + 14 天離線寬限**。
- 管理/退訂導 Paddle customer portal。

## 階段四：Track C — Web Sign in with Apple（卡 Apple Services ID）

**外部前置（Mike）：** Services ID 群組到 iOS 同一 primary App ID、web return URL、（選）寄件網域。
- NextAuth 加 Apple provider；`signIn` callback **先比 `apple_sub` 再退 email**；首次存 apple_sub+name；放寬 `src/lib/auth.ts` 的 email-唯一比對以容隱藏信箱；`/login` 加 Apple 鈕。

## 階段五：跨來源合流 + 翻硬牌

- 一 user 一筆有效 sub；apple/paddle/manual 寫同表，`hasActiveEntitlement` 取最新有效。
- 防雙重訂閱：已 active → 擋其他來源購買 UI。
- 各平台付費路徑到位後逐一 `PAYWALL_ENFORCE_* = on`。iOS/Flutter 在各自 IAP 前維持只讀不硬擋。

---

## 排序（為什麼 IAP 先）

1. **階段一 共用地基** — 現在做，無外部相依。
2. **Track A iOS IAP** — Mike 建好 ASC 商品 + RevenueCat 即做 → **第一個真正收費的管道**。
3. **Track B Paddle**（KYC 過）+ **Track C Web SIWA**（Services ID）並行。
4. 逐平台翻硬牌。

## 外部前置彙整（Mike 要辦）

| 前置 | 解鎖 | 狀態 |
|---|---|---|
| ASC auto-renewable IAP 商品 | Track A | 待辦（最快） |
| RevenueCat 專案 + key | Track A | 待辦 |
| Paddle KYC + Product/Price | Track B | 待辦（慢） |
| Apple Services ID 群組 | Track C | 待辦 |

## 協調

- **billing 實作由此 session（feat/billing-phase1）負責**；marketing worktree 專注 landing/download。
- Phase 1 spec 待從 `feat/download-page-polish` merge 進 main（本 plan 引用其路徑）。

## DoD

- `npx next build` / iOS·macOS build 過；`npm test`（entitlement 狀態機 / promo / trial 一生一次 紅→綠）。
- IAP sandbox：購買→trial→active→取消→expired、還原購買。
- Paddle sandbox（Track B）。帳號識別（Track C）。各平台硬牌 gate 實測。

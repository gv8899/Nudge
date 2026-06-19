# 付費機制 Slice A：entitlement 地基 + 試用 + 後端/Web paywall + admin + promo

> 策略上層見 `docs/金流訂閱與Mac更新策略.md`。本 spec = Slice A 實作設計。
> Slice B（Paddle web 結帳）、Slice C（iOS IAP+RevenueCat）、藍新（台灣 PSP）另起。

**Goal:** 建立 provider-neutral 的訂閱 entitlement 地基：註冊自動 7 天試用、四端讀同一個 entitlement、後端 + Web paywall（soft、不硬擋）、admin 小後台手動開/收權限、promo code 兌換（送免費時間）。**不接任何真金流**（Paddle/iOS/藍新都是後續 slice）。

**Architecture:** entitlement 存後端、一 user 一列、all-or-nothing。所有授權來源（trial/comp/promo/未來 paddle/ios/newebpay）都只是「寫 `accessUntil` + `source` 進同一張 `subscriptions`」。讀取走 `GET /api/me` 內嵌的 `entitlement`。金流整合是各自獨立 slice，靠共用 helper `grantAccess()/revokeAccess()` 匯流 → **換/加金流商不動核心**。

**Tech Stack:** drizzle（schema + 手動 migration）、Next.js API、NextAuth（admin web session）、現有帳號系統。

---

## 1. 範圍

**IN（Slice A）**
- `subscriptions` / `promo_codes` / `promo_redemptions` 三表 + migration（含既有 user backfill 試用）。
- 註冊建試用（接所有建 user 點）。
- `GET /api/me` 回 `entitlement`。
- Web paywall UI（soft：顯示狀態 + 兌換碼；`PAYWALL_ENFORCE` flag 預設 off）。
- `POST /api/promo/redeem`。
- Admin 小後台 `/admin`（限 `ADMIN_EMAILS`）：查 user、開/收權限、promo code 管理。
- 共用 helper `grantAccess/revokeAccess`（給 promo/admin 用，未來金流也用）。

**OUT（後續 slice，但設計要留接縫）**
- Paddle web 結帳 + webhook（Slice B）。
- iOS StoreKit IAP + RevenueCat（Slice C）。
- 藍新（台灣 PSP：信用卡/LINE Pay/ATM + 電子發票）—— Paddle 的對等整合。
- iOS/Mac/Flutter paywall UI；硬擋（`PAYWALL_ENFORCE=on`）；Paddle/藍新 折扣碼。

## 2. 資料模型

### 2.1 `subscriptions`（provider-neutral，一 user 一列）
```ts
export const subscriptions = pgTable("subscriptions", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  // 授權來源；可擴充（之後加 paddle/ios/newebpay）。
  source: text("source", { enum: ["trial","comp","promo","paddle","ios","newebpay"] }).notNull(),
  // 存取到期；NULL = 永久（admin 永久 comp 用）。
  accessUntil: text("access_until"),   // ISO string，nullable
  updatedAt: text("updated_at").notNull(),
});
```
- **不放任何金流商專屬欄位**。Paddle/藍新/iOS 的 subscriptionId 等之後各自開整合表（或加 `provider_*` 欄位於該 slice），核心表保持中立。
- 衍生：`isPremium = accessUntil == null || now < accessUntil`。
- `status`（給 UI）：`source==trial && isPremium` → `trialing`；`!isPremium` → `expired`；其餘 → `active`。

### 2.2 `promo_codes`
```ts
export const promoCodes = pgTable("promo_codes", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),         // 兌換碼（建議存 upper-case）
  grantDays: integer("grant_days").notNull(),    // 送幾天免費
  maxRedemptions: integer("max_redemptions"),    // NULL = 無限；1 = 唯一單次碼
  perUserLimit: integer("per_user_limit").notNull().default(1),
  redeemedCount: integer("redeemed_count").notNull().default(0),
  expiresAt: text("expires_at"),                 // NULL = 碼不過期
  isActive: boolean("is_active").notNull().default(true),
  createdAt: text("created_at").notNull(),
});
```
- 唯一單次碼 = `maxRedemptions:1`；共用多人碼 = `maxRedemptions:N`/null。**一表兩用**。

### 2.3 `promo_redemptions`
```ts
export const promoRedemptions = pgTable("promo_redemptions", {
  id: text("id").primaryKey(),
  codeId: text("code_id").notNull().references(() => promoCodes.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  redeemedAt: text("redeemed_at").notNull(),
});
```
- 擋重複 + 計次（per-user limit、總次數）。

### 2.4 migration `drizzle/0006_billing_entitlement.sql`
- 建三表 + index（`promo_redemptions(code_id)`、`(user_id)`）。
- **backfill**：對既有 users，插一列 `subscriptions(source:'trial', accessUntil: now+7d)`（soft 模式不鎖人，無害）。手動依序跑（共用 DB）。

## 3. 共用 helper（`src/lib/entitlement.ts`）
- `getEntitlement(userId)` → `{ isPremium, status, source, accessUntil }`（無列 → 視為無權限 / 或 lazy 建試用，見 §4）。
- `grantAccess(userId, { source, accessUntil })` → upsert subscriptions（金流/promo/admin 共用的唯一寫入點）。
- `extendAccess(userId, { source, days })` → `accessUntil = max(now, accessUntil) + days`（promo 疊加用）。
- `revokeAccess(userId)` → 設 `accessUntil = now`（即時到期；或刪列）。

## 4. 試用建立
- **新註冊**：在所有建 user 的點呼叫 `grantAccess(userId, {source:'trial', accessUntil: now+7d})`：
  - `src/app/api/auth/mobile/route.ts`、`src/app/api/auth/apple/route.ts`、`src/lib/auth.ts`（NextAuth）、`src/lib/get-user.ts`。
- **既有 user**：migration backfill（§2.4）。
- 防呆：`getEntitlement` 遇到無列時 lazy 建一筆試用（涵蓋任何漏接的建 user 路徑）。

## 5. 讀取 + Web paywall（soft）
- `GET /api/me` 回應加 `entitlement: { isPremium, status, accessUntil, source }`（app/web 既有請求，省一次 round-trip）。
- Web：
  - 狀態列/橫幅：`trialing`→「試用中，剩 N 天」；`expired`→「試用已結束」（soft：**不擋功能**）。
  - 兌換碼輸入框 → `POST /api/promo/redeem`。
  - `PAYWALL_ENFORCE`（env，預設 `false`）：true 時才把 expired 使用者導去 paywall、擋功能。Slice A 維持 false。

## 6. Promo 兌換 `POST /api/promo/redeem`
- body `{ code }`；需登入（web NextAuth / app Bearer 皆可，走 `getUser`）。
- 驗：碼存在 + `isActive` + 未過期（`expiresAt`）+ 未超 `maxRedemptions` + 該 user 未超 `perUserLimit`。
- 成功：寫 `promo_redemptions`、`redeemedCount++`、`extendAccess(userId, {source:'promo', days:grantDays})` → 回新 entitlement。
- 失敗碼別：`invalid` / `expired` / `exhausted` / `already_redeemed`（i18n 訊息）。

## 7. Admin 小後台 `/admin`
- 入口：`src/app/[locale]/admin/page.tsx`（或不帶 locale 的 `/admin`）。**Server-side 檢查 NextAuth session email ∈ `ADMIN_EMAILS`**（env 逗號分隔）；非 admin → 404/redirect。
- 功能：
  1. 查 user（by email）→ 顯示 entitlement（status / accessUntil / source）。
  2. **開權限**：永久（accessUntil=null）/ +N 天 / 指定到期 → `grantAccess`（source:'comp'）。
  3. **收回**：`revokeAccess`。
  4. **Promo code**：列表 + 建立（code / grantDays / maxRedemptions / expiresAt）。
- 端點（都先過 admin allowlist 檢查 helper `requireAdmin()`）：
  - `POST /api/admin/grant { email, accessUntil|forever:true }`
  - `POST /api/admin/revoke { email }`
  - `GET /api/admin/user?email=`（查 entitlement）
  - `GET/POST /api/admin/promo-codes`（列表 / 建立）
- `requireAdmin()`：取 NextAuth session（admin 後台是 web-only）→ email ∈ `ADMIN_EMAILS` 否則 401/403。

## 8. i18n
- 新字串：`billing.trialRemaining`(剩 N 天)、`billing.trialEnded`、`billing.redeemCode.*`(輸入框/成功/各失敗)、`admin.*`（後台標題/按鈕；admin 後台僅內部用，可只做 zh-TW，或照流程補 en/ja）。
- 流程：canonical zh-TW → `i18n:sync` → 待翻 en/ja。admin 後台字串若只給自己用，可標註不對外、簡化。

## 9. 測試（DoD）
- `npx next build` 過；`npm test` 過（entitlement 純邏輯如 `isPremium`/`status` 推導、promo 驗證 → 補單元測試 紅→綠）。
- 互動實測（本機）：
  - 新帳號註冊 → entitlement = trialing、剩 7 天。
  - 既有帳號（backfill）→ trialing。
  - promo：建唯一碼 + 共用碼 → 兌換 → accessUntil 延長、重複兌換被擋、超額被擋。
  - admin：非 admin email 進不去 `/admin`；admin 開永久/+N天/收回 → entitlement 變化正確。
  - soft：expired 使用者**功能不被擋**（`PAYWALL_ENFORCE=false`）。
- migration 在共用 DB 跑前需使用者授權（dev/prod 同庫）。

## 10. 邊界 / 風險
- **soft 模式**：Slice A 不硬擋，避免「沒金流卻鎖死所有人」。Paddle/藍新接好才翻 `PAYWALL_ENFORCE`。
- **provider-neutral**：核心 `subscriptions` 不綁任何金流商；藍新/Paddle/iOS 各自 slice 寫 `grantAccess`，TW 可路由藍新（在地付款 + 發票）、其餘 Paddle。
- **admin 安全**：`ADMIN_EMAILS` 必須是「已驗證的 NextAuth 登入 email」，不是任意輸入；grant/revoke 端點一律先 `requireAdmin()`。
- **部署順序**：先上會讀寫新表的 code，再/同時跑 migration（新表 + nullable，舊 code 不受影響）。

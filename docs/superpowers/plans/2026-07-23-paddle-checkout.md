# Paddle Checkout (Web + Mac) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Paddle Billing checkout for Web + Mac — webhook→entitlement pipeline, `/paywall` overlay checkout, OTT hand-off from Mac, settings CTAs, flag-gated hard paywall.

**Architecture:** All writes converge on the existing `grantAccess()` single write point. Webhook is verified + idempotent (`webhook_events` table). Mac never checkouts in-app: it exchanges its Bearer JWT for a 60s single-purpose OTT and opens the default browser at `nudge.tw/checkout?ott=…`, which sets a short-lived app-JWT cookie and lands on `/paywall`. Hard wall lives in `(app)/layout` (UX layer only), controlled by existing `PAYWALL_ENFORCE_WEB/_MAC` env flags.

**Tech Stack:** Next.js App Router, Drizzle/Postgres, `@paddle/paddle-node-sdk` (webhook verify + portal), `@paddle/paddle-js` (overlay checkout + price preview), jose JWT (existing `src/lib/jwt.ts`), SwiftUI (Mac).

## Global Constraints

- 定價：**$99/yr 主、$12.99/mo 錨點**；金額不進 code——只有 4 個 price id（env）。顯示價一律 Paddle 當地化。
- Trial：先綁卡 7 天、一生一次綁 `users.trial_started_at`；已用 → 無 trial 價。
- 所有 subscriptions 寫入走 `grantAccess()`（`src/lib/entitlement.ts:205`）；不得繞過、不得改 `subscriptions` 表結構。
- Webhook 必須：驗 `Paddle-Signature`、以 `event_id` 去重、`occurred_at` 防舊蓋新、未知 user 回 200。
- OTT：`signJWT({userId, purpose:"checkout"}, "60s")`；驗證端必檢 `purpose`；不能打一般 API。
- 硬牆是 **UX 層**：`(app)/layout` redirect；API 層不擋。豁免 `/paywall`、`/checkout/*`、settings。
- Web UI 字串走 canonical → `npm run i18n:sync`（三語）；Apple 鏡像 xcstrings（zh-Hant source）。色彩只用 design token（web token / `Color.nudgeXxx`）；Apple 主 CTA 用 `NudgeButton`。
- Apple DoD：`xcodebuild -scheme Nudge-iOS` + `-scheme Nudge-macOS` 都要過 + token lint。iOS 此輪不加 UI，但共用 NudgeKit 改動必須兩個 scheme 都綠。
- Migration `0010_webhook_events.sql`：additive；先上 code 再跑（deploy 順序）。
- Paddle sandbox：`PADDLE_ENV=sandbox`；無 key 時 server 啟動不得 crash（config lazy 驗證，缺 key 只在用到時 503）。

---

## File Structure

**Backend:**
- `src/lib/paddle/config.ts` — env 讀取 + lazy 驗證 + `getPaddle()` SDK singleton。
- `src/lib/paddle/map-event.ts` — 純函式：Paddle event → `grantAccess` 參數（可單測）。
- `src/lib/paddle/map-event.test.ts`
- `src/lib/db/schema.ts` — 加 `webhookEvents` 表。
- `drizzle/0010_webhook_events.sql`
- `src/app/api/webhooks/paddle/route.ts` — 驗簽 + 去重 + 套用 map-event。
- `src/app/api/billing/checkout/route.ts` — checkout 準備（price 選擇）。
- `src/lib/billing/select-prices.ts` + `.test.ts` — 純函式 trial/無 trial 價選擇。
- `src/app/api/billing/checkout-session/route.ts` — OTT 簽發（Bearer only）。
- `src/app/api/billing/portal/route.ts` — Paddle customer portal URL。
- `src/lib/get-user.ts` — 加 checkout-session cookie fallback。
- `src/lib/checkout-session.ts` + `.test.ts` — OTT 驗證 + cookie 名/簽發 helpers。

**Web UI:**
- `src/app/[locale]/checkout/route.ts` — OTT 兌換（設 cookie → redirect /paywall）。**在 (app) group 之外**（無 session 也能兌換）。
- `src/app/[locale]/(app)/paywall/page.tsx` + `src/components/billing/paywall-content.tsx`（雙價卡 + Paddle.js overlay + promo 入口）。
- `src/app/[locale]/(app)/checkout/success/page.tsx` + `src/components/billing/checkout-success.tsx`（輪詢）。
- `src/components/settings/subscription-section.tsx` — CTA。
- `src/app/[locale]/(app)/layout.tsx` — 硬牆 redirect。
- `i18n/canonical/{zh-TW,en,ja}.json` — `billing.paywall.*` 等 key。

**Mac:**
- `apple/NudgeKit/Sources/NudgeCore/UserDTO.swift` — 加 `paywall` decode。
- `apple/NudgeKit/Sources/NudgeCore/AuthRepository.swift` — entitlement 快取 + `checkoutURL()`（OTT 流程）+ 離線寬限判斷。
- `apple/NudgeKit/Sources/NudgeUI/Billing/PaywallView.swift` — 全視窗付費牆。
- `apple/NudgeKit/Sources/NudgeUI/PlatformRootView.swift` — macOS root 掛牆。
- `apple/NudgeKit/Sources/NudgeUI/SettingsView.swift` — 升級/管理 CTA。
- `Localizable.xcstrings` — `billing.paywall.*` 鏡像。

---

### Task 1: Paddle config + SDK 安裝 + env

**Files:** Create `src/lib/paddle/config.ts`; Modify `.env.example`, `package.json`（安裝）。

**Interfaces — Produces:**
```ts
type PaddlePriceIds = { monthlyTrial: string; annualTrial: string; monthlyNoTrial: string; annualNoTrial: string };
function paddleEnv(): "sandbox" | "production";
function paddlePriceIds(): PaddlePriceIds;          // 缺 env → throw PaddleConfigError
function paddleClientToken(): string;                // NEXT_PUBLIC_PADDLE_CLIENT_TOKEN
function getPaddle(): Paddle;                        // node-sdk singleton（lazy；缺 PADDLE_API_KEY → throw）
class PaddleConfigError extends Error {}
```

- [ ] `npm install @paddle/paddle-node-sdk @paddle/paddle-js`
- [ ] 寫 `config.ts`：

```ts
import { Paddle, Environment } from "@paddle/paddle-node-sdk";

export class PaddleConfigError extends Error {}

export function paddleEnv(): "sandbox" | "production" {
  return process.env.PADDLE_ENV === "production" ? "production" : "sandbox";
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new PaddleConfigError(`${name} not configured`);
  return v;
}

export type PaddlePriceIds = {
  monthlyTrial: string; annualTrial: string;
  monthlyNoTrial: string; annualNoTrial: string;
};

export function paddlePriceIds(): PaddlePriceIds {
  return {
    monthlyTrial: required("PADDLE_PRICE_MONTHLY_TRIAL"),
    annualTrial: required("PADDLE_PRICE_ANNUAL_TRIAL"),
    monthlyNoTrial: required("PADDLE_PRICE_MONTHLY_NOTRIAL"),
    annualNoTrial: required("PADDLE_PRICE_ANNUAL_NOTRIAL"),
  };
}

export function paddleClientToken(): string {
  return required("NEXT_PUBLIC_PADDLE_CLIENT_TOKEN");
}

export function paddleWebhookSecret(): string {
  return required("PADDLE_WEBHOOK_SECRET");
}

let _paddle: Paddle | null = null;
export function getPaddle(): Paddle {
  if (!_paddle) {
    _paddle = new Paddle(required("PADDLE_API_KEY"), {
      environment: paddleEnv() === "production" ? Environment.production : Environment.sandbox,
    });
  }
  return _paddle;
}
```

- [ ] `.env.example` 加 8 個 var（含註解：sandbox 起步、4 price id 來自 Paddle Dashboard）。
- [ ] `npx next build` 過（無 key 不 crash——config 全 lazy）。Commit `feat(billing): paddle config + SDK`。

### Task 2: `webhook_events` 表 + migration 0010

**Files:** Modify `src/lib/db/schema.ts`; Create `drizzle/0010_webhook_events.sql`。

**Interfaces — Produces:** `webhookEvents` = `{ eventId: text PK, eventType: text notNull, occurredAt: text notNull, processedAt: text notNull }`。

- [ ] schema.ts 尾端加：

```ts
// Paddle webhook 冪等去重 — 一 event 一列（event_id 為 Paddle 全域唯一）。
// occurred_at 供亂序判斷（舊事件不覆蓋新狀態）。
export const webhookEvents = pgTable("webhook_events", {
  eventId: text("event_id").primaryKey(),
  eventType: text("event_type").notNull(),
  occurredAt: text("occurred_at").notNull(),
  processedAt: text("processed_at").notNull(),
});
```

- [ ] `drizzle/0010_webhook_events.sql`（手寫，照 0009 風格註解 + `CREATE TABLE IF NOT EXISTS`；apply 指令註明 `psql "$DATABASE_URL" -f …`）。
- [ ] `npx next build`。Commit `feat(billing): webhook_events 去重表 + migration 0010`。

### Task 3: 事件映射純函式（TDD）

**Files:** Create `src/lib/paddle/map-event.ts`, `src/lib/paddle/map-event.test.ts`。

**Interfaces — Produces:**
```ts
type PaddleEventInput = {
  eventId: string; eventType: string; occurredAt: string;
  data: { id?: string; status?: string; customerId?: string;
          customData?: Record<string, unknown> | null;
          currentBillingPeriod?: { endsAt: string } | null;
          scheduledChange?: { action: string } | null;
          items?: Array<{ price?: { id: string } }> };
};
type MappedGrant = { userId: string; grant: GrantOptions };  // GrantOptions 來自 entitlement.ts
function mapPaddleEvent(e: PaddleEventInput, prices: PaddlePriceIds): MappedGrant | null;
// null = 此事件不觸發寫入（transaction.*、缺 user_id 等）
```

- [ ] 失敗測試（節錄核心 case；`makeEvent` helper 建 payload）：

```ts
import { describe, it, expect } from "vitest";
import { mapPaddleEvent } from "./map-event";

const PRICES = { monthlyTrial:"pri_mt", annualTrial:"pri_at", monthlyNoTrial:"pri_mn", annualNoTrial:"pri_an" };
const base = { eventId:"evt_1", occurredAt:"2026-07-23T00:00:00Z" };
const sub = (over={}) => ({ ...base, eventType:"subscription.created", data:{
  id:"sub_1", status:"trialing", customerId:"ctm_1",
  customData:{ user_id:"u1" },
  currentBillingPeriod:{ endsAt:"2026-07-30T00:00:00Z" },
  items:[{ price:{ id:"pri_at" } }], ...over }});

describe("mapPaddleEvent", () => {
  it("subscription.created trialing → grant trialing/annual/期末", () => {
    const m = mapPaddleEvent(sub(), PRICES)!;
    expect(m.userId).toBe("u1");
    expect(m.grant).toMatchObject({ source:"paddle", status:"trialing", plan:"annual",
      accessUntil:"2026-07-30T00:00:00Z", externalCustomerId:"ctm_1", externalSubscriptionId:"sub_1",
      cancelAtPeriodEnd:false });
  });
  it("scheduledChange cancel → cancelAtPeriodEnd true", () => {
    const m = mapPaddleEvent(sub({ scheduledChange:{ action:"cancel" } }), PRICES)!;
    expect(m.grant.cancelAtPeriodEnd).toBe(true);
  });
  it("subscription.canceled → status canceled、沿用期末", () => {
    const m = mapPaddleEvent(sub({ status:"canceled" }), PRICES)!;
    expect(m.grant.status).toBe("canceled");
  });
  it("monthly price id → plan monthly", () => {
    const m = mapPaddleEvent(sub({ items:[{ price:{ id:"pri_mn" } }] }), PRICES)!;
    expect(m.grant.plan).toBe("monthly");
  });
  it("past_due 映射", () => {
    expect(mapPaddleEvent(sub({ status:"past_due" }), PRICES)!.grant.status).toBe("past_due");
  });
  it("缺 user_id → null", () => {
    expect(mapPaddleEvent(sub({ customData:{} }), PRICES)).toBeNull();
  });
  it("transaction.* → null（不寫入）", () => {
    expect(mapPaddleEvent({ ...base, eventType:"transaction.payment_failed", data:{} }, PRICES)).toBeNull();
  });
  it("未知 status → null（防寫壞資料）", () => {
    expect(mapPaddleEvent(sub({ status:"paused" }), PRICES)).toBeNull();
  });
});
```

- [ ] 跑 → 全紅。實作 `mapPaddleEvent`：`eventType` 僅接受 `subscription.created|updated|canceled`；status 白名單 `trialing|active|past_due|canceled` 映射到 `EntitlementStatus`；`plan` 由 price id 對照 `prices`；`accessUntil = currentBillingPeriod?.endsAt ?? null`（null → 交給 grantAccess 的欄位語義=永久？**不行**——canceled 且無 period 時沿用「不覆蓋」策略：`accessUntil` 為 null 時回傳 null 略過，測試補一條）。`cancelAtPeriodEnd = scheduledChange?.action === "cancel"`。
- [ ] 跑 → 全綠。Commit `feat(billing): paddle 事件映射純函式`。

### Task 4: Webhook route

**Files:** Create `src/app/api/webhooks/paddle/route.ts`。

**Interfaces — Consumes:** `getPaddle()`, `paddleWebhookSecret()`, `paddlePriceIds()`, `mapPaddleEvent`, `grantAccess`, `webhookEvents`。

- [ ] 實作：

```ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { webhookEvents, subscriptions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { grantAccess } from "@/lib/entitlement";
import { getPaddle, paddleWebhookSecret, paddlePriceIds, PaddleConfigError } from "@/lib/paddle/config";
import { mapPaddleEvent } from "@/lib/paddle/map-event";

export async function POST(request: NextRequest) {
  let event;
  try {
    const signature = request.headers.get("paddle-signature") ?? "";
    const raw = await request.text();
    event = await getPaddle().webhooks.unmarshal(raw, paddleWebhookSecret(), signature);
  } catch (e) {
    if (e instanceof PaddleConfigError) return NextResponse.json({ error: "not configured" }, { status: 503 });
    console.error("[paddle-webhook] signature verify failed:", e);
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  // 冪等：insert 失敗（PK 衝突）= 已處理過 → 200 skip
  const nowISO = new Date().toISOString();
  const inserted = await db.insert(webhookEvents)
    .values({ eventId: event.eventId, eventType: event.eventType,
              occurredAt: event.occurredAt, processedAt: nowISO })
    .onConflictDoNothing({ target: webhookEvents.eventId })
    .returning({ eventId: webhookEvents.eventId });
  if (inserted.length === 0) return NextResponse.json({ ok: true, skipped: "duplicate" });

  const mapped = mapPaddleEvent(event as never, paddlePriceIds());
  if (!mapped) return NextResponse.json({ ok: true, skipped: "no-op" });

  // 亂序防護：同一訂閱、更舊的事件不覆蓋（比對現存 updatedAt 前先查）
  const [existing] = await db.select().from(subscriptions)
    .where(eq(subscriptions.userId, mapped.userId)).limit(1);
  if (existing?.source === "paddle" && existing.updatedAt > event.occurredAt) {
    return NextResponse.json({ ok: true, skipped: "stale" });
  }

  await grantAccess(mapped.userId, mapped.grant);
  return NextResponse.json({ ok: true });
}
```

- 註：`grantAccess` 的 `updatedAt` 寫入改帶 `occurredAt`？**不改** grantAccess——stale 判斷用 `occurredAt` 對 `updatedAt`（近似，秒級足夠）；映射到查無 user 的情況由 `grantAccess` 的 FK 失敗 catch → log + 200。route 全包 try/catch：未知錯誤 500（讓 Paddle 重試），**唯獨 user 查無**（FK violation）→ 200。
- [ ] `npx next build`；`npm test` 全綠。Commit `feat(billing): paddle webhook（驗簽+冪等+亂序防護）`。

### Task 5: 價格選擇 + `/api/billing/checkout`（TDD）

**Files:** Create `src/lib/billing/select-prices.ts` + `.test.ts`, `src/app/api/billing/checkout/route.ts`。

**Interfaces — Produces:**
```ts
function selectPrices(hasUsedTrial: boolean, ids: PaddlePriceIds): { monthly: string; annual: string; withTrial: boolean };
// GET /api/billing/checkout →
//   200 { clientToken, env, priceIds:{monthly,annual}, withTrial, customData:{user_id}, email, alreadySubscribed:false }
//   200 { alreadySubscribed:true }
//   401 未登入；503 Paddle 未設定
```

- [ ] 測試：`selectPrices(false)` → trial 組 + `withTrial:true`；`selectPrices(true)` → 無 trial 組。跑紅 → 實作（4 行）→ 綠。
- [ ] route（`getUser()` 統一驗身分——web session / Bearer / checkout cookie 都吃，Task 6 加 cookie）：

```ts
import { NextResponse } from "next/server";
import { getUser } from "@/lib/get-user";
import { getEntitlement, hasUsedTrial } from "@/lib/entitlement";
import { paddleClientToken, paddlePriceIds, paddleEnv, PaddleConfigError } from "@/lib/paddle/config";
import { selectPrices } from "@/lib/billing/select-prices";

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ent = await getEntitlement(user.id);
  if (ent.isActive && ent.source !== "trial") return NextResponse.json({ alreadySubscribed: true });
  try {
    const used = await hasUsedTrial(user.id);
    const prices = selectPrices(used, paddlePriceIds());
    return NextResponse.json({
      clientToken: paddleClientToken(), env: paddleEnv(),
      priceIds: { monthly: prices.monthly, annual: prices.annual },
      withTrial: prices.withTrial,
      customData: { user_id: user.id }, email: user.email,
      alreadySubscribed: false,
    });
  } catch (e) {
    if (e instanceof PaddleConfigError) return NextResponse.json({ error: "billing not configured" }, { status: 503 });
    throw e;
  }
}
```

注意：`ent.source !== "trial"` 讓 trial 中的人也能提前付費轉正（Paddle sub 建立後 webhook 覆蓋 trial row）。
- [ ] build + test 綠。Commit `feat(billing): checkout 準備 API + 價格選擇`。

### Task 6: OTT 手遞（簽發 + 兌換 + cookie fallback）（TDD）

**Files:** Create `src/lib/checkout-session.ts` + `.test.ts`, `src/app/api/billing/checkout-session/route.ts`, `src/app/[locale]/checkout/route.ts`; Modify `src/lib/get-user.ts`。

**Interfaces — Produces:**
```ts
// checkout-session.ts
const CHECKOUT_COOKIE = "nudge_checkout";
async function issueCheckoutToken(userId: string): Promise<string>;        // signJWT({userId,purpose:"checkout"},"60s")
async function verifyCheckoutToken(t: string): Promise<string | null>;     // 驗 purpose；壞/過期 → null
async function issueCheckoutCookieJWT(userId: string): Promise<string>;    // signJWT({userId,purpose:"checkout-web"},"30m")
async function verifyCheckoutCookieJWT(t: string): Promise<string | null>;
// POST /api/billing/checkout-session (Bearer only) → { url: "https://nudge.tw/checkout?ott=…" }（dev: localhost）
// GET /[locale]/checkout?ott=… → 兌換成功: set-cookie + redirect ../paywall；失敗: redirect ../checkout/expired（or /login?checkout=expired）
```

- [ ] `checkout-session.test.ts`：issue→verify 回 userId；改 purpose 的 JWT → null；過期（`signJWT(...,"0s")`）→ null；login JWT（無 purpose）餵 `verifyCheckoutToken` → null。跑紅 → 實作 → 綠。
- [ ] `get-user.ts`：Bearer → NextAuth 之後加第三 fallback——讀 `nudge_checkout` cookie → `verifyCheckoutCookieJWT` → 查 user 回傳。**放最後**（不影響既有路徑）。
- [ ] `/api/billing/checkout-session`：只認 Bearer（`headers().get("authorization")` 直驗，不走 getUser，避免 web session 也能簽）；回 `{url}`，base 用 `process.env.NEXT_PUBLIC_APP_URL ?? "https://nudge.tw"`（`.env.example` 補）。
- [ ] `/[locale]/checkout/route.ts`（route handler，在 (app) 之外）：驗 ott → 成功 `cookies().set(CHECKOUT_COOKIE, cookieJWT, { httpOnly:true, secure:prod, sameSite:"lax", path:"/", maxAge:1800 })` → `redirect(\`/${locale}/paywall\`)`；失敗 → `redirect(\`/${locale}/login?checkout=expired\`)`（login 頁顯示逾時訊息 key）。
- [ ] build + test 綠。Commit `feat(billing): OTT 手遞（Mac→web 結帳免 web 登入）`。

### Task 7: Portal endpoint

**Files:** Create `src/app/api/billing/portal/route.ts`。

- [ ] `POST`：`getUser()` → 讀 subscriptions row；`source!=="paddle" || !externalCustomerId` → 400；`getPaddle().customerPortalSessions.create(externalCustomerId, [])` → 回 `{ url: session.urls.general.overview }`；`PaddleConfigError` → 503。
- [ ] build 綠。Commit `feat(billing): paddle customer portal API`。

### Task 8: Web `/paywall` + success + i18n

**Files:** Create `src/app/[locale]/(app)/paywall/page.tsx`, `src/components/billing/paywall-content.tsx`, `src/app/[locale]/(app)/checkout/success/page.tsx`, `src/components/billing/checkout-success.tsx`; Modify canonical i18n ×3 + sync。

**Interfaces — Consumes:** `GET /api/billing/checkout`（Task 5 shape）、`/api/promo/redeem`、`initializePaddle`/`Paddle.Checkout.open`（`@paddle/paddle-js`）。

- [ ] canonical `zh-TW` 加 key（en/ja 同步自譯，標 TODO(review)）：`billing.paywall.title`「解鎖 Nudge 完整功能」、`subtitle`、`annual`「年繳」、`monthly`「月繳」、`perMonth`「{price}/月」、`savePct`「省 {pct}%」、`ctaTrial`「開始 7 天免費試用」、`ctaBuy`「訂閱 Nudge」、`trialNote`「先綁卡；試用期滿自動扣款，可隨時取消」、`havePromo`「有兌換碼？」、`promoPlaceholder`、`promoApply`、`alreadySubscribed`「你已訂閱」、`goSettings`「前往設定」、`checkoutExpired`「連結逾時，請回 app 重試」、`success.title`「訂閱完成 🎉」、`success.processing`「付款處理中，稍後自動生效」、`success.back`「回到 Nudge」。`npm run i18n:sync` ×2。
- [ ] `paywall-content.tsx`（client）：mount 時 fetch `/api/billing/checkout` → `alreadySubscribed` → 顯示已訂閱 + settings link；否則 `initializePaddle({ token, environment: env })`；雙價卡（**預設年繳**，`Paddle.PricePreview({ items:[…] })` 拉當地化顯示價，失敗 fallback 顯示 `$99`/`$12.99` USD 常數——僅顯示用）；CTA → `paddle.Checkout.open({ items:[{priceId, quantity:1}], customData, customer:{email}, settings:{ successUrl: \`\${origin}/\${locale}/checkout/success\` } })`；promo 折疊輸入 → `/api/promo/redeem` → 成功 reload。503 → 顯示「金流尚未開通」。全部 token 色（`bg-card`/`border-border`/`text-primary`/`bg-primary` 等，參考 `subscription-section.tsx` 慣例）。
- [ ] `checkout-success.tsx`（client）：`useMe` SWR `refreshInterval:1000`；`entitlement.isActive` → 成功畫面；30s 未翻 → `success.processing`。
- [ ] 兩個 page.tsx 薄殼（server component 包 client 元件）。
- [ ] `npx next build`；手走 `/paywall`（無 Paddle key → 「金流尚未開通」不炸）。Commit `feat(billing): /paywall + checkout success（web）`。

### Task 9: Web settings CTA + login 逾時訊息

**Files:** Modify `src/components/settings/subscription-section.tsx`, login page（`checkout=expired` 訊息）。

- [ ] subscription-section：`!isActive || status ∈ {past_due,canceled,expired}` → `<Link href="/paywall">` 主色「升級」鈕；`isActive && source==="paddle"` → 「管理訂閱」鈕 → `POST /api/billing/portal` → `window.open(url)`；其他 source 維持現狀。i18n key `billing.upgrade`「升級」、`billing.manage`「管理訂閱」（canonical + sync）。
- [ ] login 頁：query `checkout=expired` → 顯示 `billing.paywall.checkoutExpired`。
- [ ] build 綠。Commit `feat(billing): settings 訂閱 CTA`。

### Task 10: Web 硬牆（flag-gated）

**Files:** Modify `src/app/[locale]/(app)/layout.tsx`。

- [ ] 現有「無 session → /login」之後加：

```ts
if (isPaywallEnforced("web")) {
  const active = await hasActiveEntitlement(user.id);
  if (!active) redirect(`/${locale}/paywall`);
}
```

豁免靠路徑：`/paywall`、`/checkout/*` 不在此 layout？**確認**：paywall/checkout-success 在 (app) group 內 → layout 會攔自己 → 需在 layout 內以 `headers()` 取 pathname 豁免，或把 paywall/checkout 移出 (app)。**決定：檢查現有 layout 怎麼拿 user；用「豁免清單比對 pathname」實作**（`next/headers` 的 `x-pathname` 若無，改用 middleware 傳遞或直接把兩頁移出 (app) group 自帶 sidebar-less layout——實作時擇其簡，優先「移出 (app)」：`/paywall` 本來就不該有 app sidebar）。settings 保持在牆內清單豁免 → 若移出方案，settings 仍在 (app) 內：豁免它需要 pathname——**最終策略：`/paywall`+`/checkout/*` 移出 (app)；settings 不豁免**（硬牆使用者可從 paywall 頁的「登出」「兌換碼」完成 spec 要求的動作，spec 的 settings 豁免以 paywall 頁功能等價滿足——paywall 頁已有兌換碼 + 登出加上去）。
- [ ] paywall 頁補「登出」小連結（`signOut()`）。
- [ ] `PAYWALL_ENFORCE_WEB=1` 本地開起來實走：過期帳號 → 任何 (app) 頁 → 被推到 /paywall；paywall/checkout 可達；關 flag 恢復。
- [ ] build 綠。Commit `feat(billing): web 硬付費牆（flag-gated）`。

### Task 11: Mac — DTO + AuthRepository（OTT + 快取 + 離線寬限）

**Files:** Modify `apple/NudgeKit/Sources/NudgeCore/UserDTO.swift`, `AuthRepository.swift`。

**Interfaces — Produces（Swift）:**
```swift
public struct PaywallFlagsDTO: Codable, Equatable, Sendable { public let ios: Bool; public let web: Bool; public let mac: Bool }
// UserDTO: public let paywall: PaywallFlagsDTO?（decodeIfPresent）
// AuthRepository:
public private(set) var paywallFlags: PaywallFlagsDTO?      // refreshCurrentUser 更新
public func requestCheckoutURL() async throws -> URL         // POST /api/billing/checkout-session → url
public var shouldShowMacPaywall: Bool                        // 見下述規則
```

- [ ] `PaywallFlagsDTO` + `UserDTO.paywall` decode（default nil，向後相容）。
- [ ] AuthRepository：`refreshCurrentUser()`/`refreshEntitlement()` 同步更新 `paywallFlags` 並把 `{entitlement, paywallFlags, lastValidatedAt: Date}` 存 UserDefaults（JSON encode，key `nudge.billing.cache`）；啟動 restore 時載入快取。
- [ ] `shouldShowMacPaywall` 規則（照 spec +14 天寬限）：
  - flags 說 mac 沒 enforce → false
  - entitlement `isActive` → false
  - **無法連線期間**：拿快取；`lastValidatedAt` 距今 ≤ 14 天 → 沿用快取判斷；> 14 天且快取顯示無權 → true
- [ ] `requestCheckoutURL()`：`client.post("/api/billing/checkout-session", body: EmptyBody())` decode `{url}` → URL。
- [ ] `cd apple && xcodebuild -scheme Nudge-iOS … build` + `-scheme Nudge-macOS` 都綠。Commit `feat(billing): mac entitlement 快取 + OTT + paywall flags`。

### Task 12: Mac — PaywallView + root 掛載 + settings CTA + xcstrings

**Files:** Create `apple/NudgeKit/Sources/NudgeUI/Billing/PaywallView.swift`; Modify `PlatformRootView.swift`（macOS branch）, `SettingsView.swift`, `Localizable.xcstrings`; `xcodegen generate`。

- [ ] xcstrings 加 key（zh-Hant/en/ja，與 web canonical 同文案）：`billing.paywall.title/subtitle/point1/point2/point3/ctaTrial/ctaBuy/trialNote/havePromo/refresh/paidDone/logout`、`billing.upgrade`、`billing.manage`。（web canonical 若缺 `point1-3`「跨 Web/Mac/iOS 同步」「行事曆整合」「每日規劃與回顧」→ Task 8 補進 canonical。）
- [ ] `PaywallView`：全視窗（`frame(maxWidth:.infinity, maxHeight:.infinity)`、`Color.nudgeBackground`）；title + 三 point（SF icon + text）+ 主 CTA `NudgeButton`（依 `hasUsedTrial`→ 由 entitlement `trialEnd`/status 推：`auth.entitlement?.status == "trialing" || trial 已用` 用 ctaBuy，否則 ctaTrial；具體以 `/api/billing/checkout` 的 `withTrial` 為準——**Mac 不打 checkout API**，用 `auth.currentUser.trialStartedAt`？DTO 無此欄——**簡化：CTA 文案統一用 `billing.paywall.ctaBuy`「訂閱 Nudge」+ trialNote 註記「未用過試用可於結帳頁開始 7 天試用」**，實際 trial 判定 server 在 web 端做）；「我已完成付款」→ `await auth.refreshEntitlement()`；「兌換碼」→ 沿用 SettingsView 既有 promo 兌換元件/邏輯；「登出」→ `auth.logout()`。CTA action：`requestCheckoutURL()` → `NSWorkspace.shared.open(url)`（`#if os(macOS)`）。
- [ ] `PlatformRootView` macOS branch：`if auth.shouldShowMacPaywall { PaywallView() } else { 既有內容 }`；`NSApplication.didBecomeActiveNotification` publisher → `auth.refreshEntitlement()`。
- [ ] SettingsView subscription 區：無權 → `NudgeButton("billing.upgrade")`（同 OTT 流程）；`source=="paddle"` 且有權 → `billing.manage` → `POST /api/billing/portal`（AuthRepository 加 `requestPortalURL()`，shape 同 checkoutURL）→ open。
- [ ] `xcodegen generate`；兩 scheme build 綠；token lint 綠。Commit `feat(billing): mac 付費牆 + settings CTA`。

### Task 13: 驗證 pass + sandbox 手測清單

- [ ] `npm test` 全綠、`npm run i18n:check` 綠、`npx next build` 綠、兩 xcodebuild 綠、lint-swift-tokens 綠。
- [ ] 寫 `docs/superpowers/plans/2026-07-23-paddle-SANDBOX-TEST.md`：Paddle sandbox 帳號註冊步驟（sandbox 免 KYC 即時可用）、Dashboard 建 product/4 prices、env 填法、`paddle sandbox 測試卡 4242 4242 4242 4242`、逐條流程（web trial 結帳→webhook→success；無 trial；Mac OTT；取消；拒付卡 `4000 0000 0000 0002` → past_due）、migration 0010 apply 指令、上線前 sandbox→live 清單。
- [ ] Commit `docs(billing): sandbox 手測清單`。

---

## Self-Review notes

- Spec coverage：§3.1→T1、§3.2→T2+T4、§3.3→T5、§3.4→T6、§3.5→T7、§4→T8-10、§5→T11-12、§6 邊界分散於 T4/T6/T8/T11、§7→各 task TDD + T13、§8 步驟 1-3 = 本 plan，4-5 = 外部/flag。
- 已知折衷（實作時按此執行）：paywall/checkout 移出 (app) group 以避開 layout 自攔；settings 不豁免、以 paywall 頁的兌換碼+登出等價滿足；Mac CTA 文案統一 ctaBuy + trialNote（trial 判定留在 web/server）。
- 無 Paddle sandbox key 期間：T1-T12 全部可完成與單測；**端到端結帳流程要等 sandbox 帳號**（T13 清單交使用者/後續補跑）。

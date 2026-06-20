# 訂閱生命週期狀態 + wording + 未付費介面 Design

> **狀態**：已與 Mike brainstorm 對齊（2026-06-20）。
> **前置**：Phase 1 共用地基已實作（`subscriptions` 肥模型 + `entitlement.ts` 改寫 + migration 0007 已跑）。本 spec 接續，補「完整生命週期狀態的顯示與 grace 邏輯」。
> **基準 plan**：`docs/superpowers/plans/2026-06-20-billing-phase1-alignment-plan.md`。

## 目標

把 entitlement 的 5 種 `status`（`trialing / active / past_due / canceled / expired`）對齊到：
1. 正確的「有權 / 無權」判斷（含付款失敗寬限期）。
2. 設定頁每個狀態的正確 wording 與配色（web + iOS 對齊）。
3. 未付費介面（soft 狀態列現在做；hard 全頁付費牆設計留待 Track A/B）。

涵蓋 4 條使用者流程：試用後取消、滿期不續約、回流再買、付款失敗。

---

## 已定案決策（brainstorm 2026-06-20）

| 決策 | 結論 | 理由 |
|---|---|---|
| 付款失敗 `past_due` 是否保有權限 | **寬限期內保有**（`past_due` 納入有權狀態，只要未過 `currentPeriodEnd`） | 對齊 Apple billing grace / RevenueCat 預設；對付費者最友善 |
| `expired` wording 是否分來源 | **分兩種**：試用沒付過→「試用已結束」；曾付費流失→「訂閱已結束」 | 對回流老客體面，利於日後差異化 re-engage |
| soft 模式（現在）CTA 按鈕 | **純文字，不放鈕**；按鈕等 Track A/B 結帳接上再加 | 金流未接，按鈕無去處，避免死連結 |

---

## 狀態機

```
trialing ──轉付費──▶ active ──取消續訂──▶ canceled ──期末──▶ expired
   │                   │  ▲                   │  (期末前反悔)──▶ active
   │(試用內取消/到期未付) │  │款項恢復              │
   ▼                   ▼  │                   ▼
 expired           past_due(寬限,仍有權)──寬限結束──▶ expired
                                              │
 expired ──重新購買(不再送試用, trial 一生一次)──▶ active
```

### 有權判斷（`deriveEntitlement`）

```
notExpired   = currentPeriodEnd === null || now < currentPeriodEnd
grantsAccess = status ∈ { trialing, active, past_due, canceled }
isActive     = grantsAccess && notExpired
effectiveStatus = (grantsAccess && !notExpired) ? "expired" : status
```

規則一句話：**四個「進行中」狀態（trialing / active / past_due / canceled）只要還沒過 `currentPeriodEnd` 就有權；唯一無權的是 `expired`（或被時間覆蓋成 expired）。**

- `past_due`：扣款失敗的寬限期。仍有權，但 wording/配色提醒更新付款。
- `canceled`：已排定期末取消（`cancelAtPeriodEnd=true`），使用者已付到期末，期末前仍有權。與 `past_due` 差別只在 wording / 配色，access 規則相同。
- `expired`：永遠無權。

> 實作注意：目前已實作的 `deriveEntitlement` 只把 `{ trialing, active }` 當有權，本次要擴成 `{ trialing, active, past_due, canceled }`。

---

## 設定頁 wording（web + iOS 共用 i18n key）

| status | 條件 | i18n key | zh-TW | 配色 |
|---|---|---|---|---|
| trialing | — | `billing.trialing` | 試用中，剩 {days} 天 | primary 亮 |
| active | 有到期日 | `billing.activeUntil` | Premium 使用中（至 {date}） | primary 亮 |
| active | 永久（`currentPeriodEnd=null`） | `billing.activeForever` | Premium 使用中 | primary 亮 |
| canceled | — | `billing.canceled` ✚新 | 已取消，Premium 使用至 {date} | warning 橘 |
| past_due | — | `billing.pastDue` ✚新 | 付款失敗，請更新付款方式 | warning 橘 |
| expired | source 為試用/從未付費（trial/comp/promo/manual） | `billing.expired` | 試用已結束 | dim 暗 |
| expired | source 曾付費（apple/paddle/newebpay） | `billing.subscriptionEnded` ✚新 | 訂閱已結束 | dim 暗 |

**新增 3 個 key**：`billing.canceled`、`billing.pastDue`、`billing.subscriptionEnded`。
**配色新增**：past_due / canceled 用 warning（web `text-chart-2`/border 對應；iOS `nudgeWarning`）。其餘維持原本 primary / dim 二分。

### 顯示邏輯（web `subscription-section.tsx` + iOS `SettingsView.swift`）

兩邊 `switch(status)`：trialing / active(分永久) / canceled / past_due / 預設(expired 再依 source 分 `expired` vs `subscriptionEnded`)。
判斷「曾付費」：`source ∈ {apple, paddle, newebpay}`。

---

## 未付費介面

### Part 1 — soft 狀態列（**現在做**）
- 就是上面那張 wording 表；app 功能不擋（`PAYWALL_ENFORCE_*` 全 off）。
- 純文字、無 CTA 按鈕。past_due / canceled 用 warning 配色提醒。

### Part 2 — hard 全頁付費牆（**Track A/B 才上，本 spec 只定方向**）
登入後 `!isActive` 且該平台 `PAYWALL_ENFORCE=on` → 擋全頁付費牆。兩變體：

- **A 新用戶（可試用）**：標題「解鎖 Nudge Premium」、副標「先免費試用 7 天」、CTA「開始 7 天免費試用」。
- **B 回流／試用用過（無試用）**：標題「重新訂閱」、**不出現「免費試用」字眼**、CTA「訂閱年方案」。

UX 原則：
- 試用一生一次：B 變體靠 `users.trialStartedAt` + Apple introductory eligibility 雙判，決定是否顯示試用。
- 「還原購買」必備（App Store 規定 + 換機/重裝）。
- 防雙重訂閱：已 `active` 不會看到此頁，且擋其他來源重複購買 UI。
- Mac：開瀏覽器走 Paddle + 本地快取 14 天離線寬限（Phase 1 spec 既定）。

---

## i18n 流程

3 個新 key 走標準鏡像：改 `i18n/canonical/zh-TW.json`（加 `billing.canceled / pastDue / subscriptionEnded`）→ `npm run i18n:sync`（en/ja 進 pending）→ 補進 `apple/.../Localizable.xcstrings`（同名 key）。

## 範圍切分

- **本次實作（unblocked）**：`deriveEntitlement` grace 邏輯（past_due/canceled 納入有權）+ 3 個 wording key + web/iOS 顯示 switch + warning 配色 + 單元測試補 past_due/canceled/expired-分流。
- **留待 Track A/B**：hard 全頁付費牆、購買頁試用/無試用變體、CTA 接結帳。

## DoD

- `entitlement.test.ts` 補：past_due 寬限有權 / past_due 過期無權 / canceled 未到期有權 / canceled 過期無權 / expired 分 source（紅→綠）。
- `npx next build` + iOS `xcodebuild` 過；`npm test` 綠。
- 設定頁五狀態 wording 實測（web + iOS 模擬器，soft 模式）。

# Onboarding Flow 設計（first-run experience）

- 日期：2026-07-07
- 分支：`worktree-feat+onboarding-flow`
- 狀態：設計已與使用者逐段確認，待 spec review → writing-plans

## 1. 目標與範圍

新使用者第一次進 Nudge 時，目前**直接落在空白的「今日」任務清單、零引導**（Web 與 Apple 皆然，無任何 onboarding、tour、first-run flag）。本設計用「**範例內容 + 輕量導覽**」填補：註冊當下把一批精選的範例任務／卡片 seed 進帳號，讓使用者**用真實的任務和卡片去理解 app 的核心概念**，再搭配一張 welcome 卡與少量 inline 提示。

### 決策（已與使用者確認）

| 項目 | 決定 |
| --- | --- |
| 平台範圍 | **Web + Apple（iOS + macOS）一起** |
| 呈現方式 | **範例內容 + 輕量導覽** |
| 範例資料歸屬 | **就是使用者的真實資料**（可編輯／完成／刪除；不加 sample flag） |
| 導覽形態 | **welcome 卡 + inline 提示** |
| Seed 觸發時機 | **帳號建立時（approach A）**，以 `users.onboarded_at` 當防重門閂 |
| 範例內容語言 | **依註冊請求的 locale 選語言**（zh-TW / en / ja 三份內容） |

### 關鍵既有事實（探勘結論）

- 目前**完全沒有** onboarding / welcome / tour / first-run 相關程式碼；要從零建。
- **「卡片」與「任務」是同一張 DB row**：card = `tasks` 表中 `description`（rich HTML）非空且 `status != archived` 的 task。「任務清單」與「卡片」是同一份資料的兩種視圖。
- 兩個活躍前端：Web（`src/`）、Apple（`apple/`，iOS+macOS 共用 SwiftUI）。Flutter 已退役。
- 既有 `scripts/seed-landing-demo.mjs` 是一份精選的「範例的一天」（今日任務／逾期／重複+提醒／卡片／日誌／標籤），正是 onboarding 要的教學素材，但它用 raw `pg`、含破壞性 `--reset`、且需使用者已存在。
- **timestamp 欄位存 text ISO string**（非 timestamptz）。
- **沒有單一的 user 建立入口**：三條路徑各自 `db.insert(users)` 後都呼叫 `ensureTrial()`。
- 建帳號當下 `users.locale = null`（locale 尚未知）。

## 2. 資料模型

### `users` 新欄位

```ts
// src/lib/db/schema.ts users 表
onboardedAt: text("onboarded_at"),   // nullable ISO string；NULL = 尚未 onboard
```

- 語義：`NULL` = 尚未 onboard；一旦 seed 成功即寫入時間戳，作為**冪等門閂**。
- 型別用 `text`（與 `createdAt` / `trialStartedAt` 一致），不用 timestamptz。

### Migration

- 檔名：`drizzle/0009_add_users_onboarded_at.sql`（沿用 `000X_snake_name.sql`，前例 `0001_add_users_locale.sql`）。
- Additive、nullable，無 backfill。**遵守部署順序**：先上依賴新欄位的 code，再手動 `psql -f`。
- **既有舊帳號處理**：migration 內把所有現存 user 的 `onboarded_at` 一次性設為 `now()`（視為已 onboard），確保只有真正的新帳號會走 onboarding。

## 3. 觸發接縫（approach A）

### 共用 `provisionNewUser`

新增 `src/lib/onboarding/provision-user.ts`（或就近放 `src/lib/auth` 週邊）：

```ts
async function provisionNewUser(userId: string, ctx: { locale: string | null }) {
  await ensureTrial(userId);                 // 收攏原本三處重複呼叫
  await maybeSeedOnboarding(userId, ctx.locale);
}
```

三個新帳號 insert 點改為呼叫這一個函式（把原本各自的 `ensureTrial` 收進來）：

- `src/lib/auth.ts:29`（Google web，`signIn` callback 內的 insert）
- `src/app/api/auth/apple/route.ts:99`（Apple 新帳號分支）
- `src/app/api/auth/mobile/route.ts:56`（mobile Google 新帳號分支）

這是順手把重複的「新帳號後續」邏輯 DRY 成單一 choke point 的小重構，不擴大範圍。之後任何新帳號要做的事都只有一個地方改。

### 冪等 / 門閂

`maybeSeedOnboarding(userId, locale)`：

1. 先搶門閂：`UPDATE users SET onboarded_at = <now> WHERE id = ? AND onboarded_at IS NULL`。
2. 受影響列數 = 0 → 別人已 seed 或已 onboard，直接 return。
3. 拿到門閂 → 在**同一 transaction** 內寫入所有 seed 資料。
4. 整包 try/catch；失敗則 rollback（含門閂那步）→ `onboarded_at` 保持 NULL，容後補救。

如此天然 idempotent、可重入；兩裝置同時首登也只會 seed 一次。

### 失敗不可擋登入

seed 失敗只記 log、不 throw 給呼叫端；使用者頂多看到空白畫面。保留一個 **lazy 補救點**：`GET /api/me` 若見 `onboarded_at IS NULL` 可再試一次（需重試上限，避免每次請求都重試）。

## 4. Seed 內容 module

### 檔案結構

- `src/lib/onboarding/seed-onboarding.ts` — 匯出 `maybeSeedOnboarding(userId, locale)`；用 **Drizzle**（非 raw pg）寫入，對應既有表：`tags` / `tasks` / `status_history` / `daily_task_assignments` / `task_recurrences` / `task_tags` / `daily_notes` / `notification_preferences`。
- `src/lib/onboarding/content/{zh-TW,en,ja}.ts` — **純資料**（範例的一天），三語各一份。zh-TW 從 `scripts/seed-landing-demo.mjs:68-168` 搬；en / ja 另行撰寫。
- 寫入 helper（`insertTask` / `assignToDay` / `addRecurrence`）從腳本 port 成 Drizzle 版；**丟掉 `--reset` 破壞性邏輯與 `.env.local` 解析與 user 存在檢查**。

### 範例內容（教學意圖：每個核心概念各一個活例）

- **4 標籤**：工作 / 讀書 / 運動 / 生活（chart color）。
- **7 任務**：5 個今日（含 1 個已完成、1 個每週重複「寫週報」帶 17:00 提醒、1 個工作日重複「晨間站會」）、2 個逾期。→ 示範 today / done / overdue / recurrence / reminder。
- **4 張卡片**（有 rich HTML 內容的任務 + 標籤）：示範「卡片＝有內容的任務」與 rich text。
- **3 筆日誌**（`daily_notes`）。
- `notification_preferences` 開啟 `per_task_reminders_enabled`。

### 日期 / 時區

- 「今天」以**使用者時區**換算（非 server 本地）；建帳號當下 timezone 多半未知 → 用請求可得的最佳訊號，取不到則 fallback app 預設時區。
- 逾期任務用今天 −3 / −5 天；重複規則 `start_date = 今天`。
- **只建今天與過去的 `daily_task_assignments`、不預先展開未來** → 維持 AGENTS.md 的 recurrence orphan 不變式（新用戶不觸發 `assignmentsToReap()`）。

### locale 選擇

- 建帳號當下 `locale = null`；seed 時用「觸發註冊那個請求的 locale 訊號」：
  - Web：signup 的 `[locale]` 網址段。
  - Apple / mobile：`Accept-Language` header。
- 取不到 → fallback `zh-TW`（app 預設）。
- 內容一旦 seed 即為**真實資料**，之後即使使用者切語言也**不回頭改寫**（符合「就是他的真實資料」）。

## 5. 前端：welcome 卡 + inline 提示

### 「該不該顯示導覽」的訊號

- 後端在使用者資料回傳處多帶 `onboardedAt`（Web `GET /api/me` 已有；Apple 走對應 endpoint）。
- 前端顯示條件需**同時**滿足三項：
  1. `onboardedAt` 存在（代表有 seed）**且為近期**（`onboardedAt` 在 now 的一個短窗內，例如數日；確切窗值為 planning 細節）。→ 避免老用戶換新裝置 / 清 localStorage 時又跳 welcome。
  2. 本地尚未記錄「已看過」（各平台本地儲存：Web `localStorage`、Apple `UserDefaults`；不佔後端）。
  3.（僅 inline 提示）**該提示錨定的 seed 項目仍存在**——若使用者已把那個範例任務/卡片編輯改名或刪除，對應提示直接不顯示（no-op），不會出現壞錨點。
- 「已看過」刻意做成 **per-surface**（web 看過、iOS 仍可再看一次）——首登裝置不同，重覆成本低、比跨裝置同步簡單。

### Welcome 卡（一張，關掉即進 app）

- 內容：一句歡迎 + 三點（這是任務／這是卡片=有內容的任務／支援重複與提醒）+ 一顆「開始」。
- Web：day view 上的 dismissible 卡；沿用既有 modal / overlay 樣式，全用 design token（禁硬編碼色）。
- Apple：`DailyHostView` 首次進來的 sheet；優先用共用 `Components/NudgeModalOverlay.swift`（自刻 overlay 要補圓角 / backdrop / z-order，故用共用元件）。

### Inline 提示（少量、錨在 seed 出來的真實項目上）

3 個關鍵點，各自可 dismiss、各自本地記已讀：

1. 錨在一個今日任務 → 「點圈圈完成它」。
2. 錨在每日重複任務 → 「這是每天重複＋提醒」。
3. 錨在一張卡片 → 「卡片＝有內容的任務，可寫長筆記」。

樣式沿用既有 empty-state / 卡片語彙，小泡泡、不遮操作。

### 文案 i18n（兩條管線，勿混）

- **UI 字串**（welcome 卡 + inline 提示）：改 `i18n/canonical/zh-TW.json` → `npm run i18n:sync`（en/ja 進 `.pending-translations.md`，於對話中翻）→ 再 sync 轉檔至 `src/messages`；Apple 端把同名 key 鏡像進 `Localizable.xcstrings`（`Text("key", bundle: .module)`）。
- **Seed 範例內容**：是資料，走第 4 段的 `content/{locale}.ts`，**不走** next-intl 訊息管線。

## 6. 邊界情況 / 錯誤處理

| 情況 | 處理 |
| --- | --- |
| 兩裝置同時首登（race） | 條件式 update 搶門閂 + 同一 transaction 內 seed；搶不到跳過 → 只 seed 一次 |
| Seed 失敗 | try/catch + rollback，不寫 `onboarded_at`、不擋登入；`GET /api/me` lazy 補救（有重試上限） |
| 使用者刪光範例 | 門閂是 `onboarded_at` 非「有無任務」→ 不重 seed |
| 既有舊帳號 | migration 一次性設 `onboarded_at = now()` → 不 seed 舊帳號 |
| 時區未知 | fallback app 預設時區算「今天」；差一天仍合理 |
| recurrence orphan | 只建今天/過去 assignment、`start_date=今天`、不預展未來 |
| 老用戶換新裝置 / 清 localStorage | 有「近期 window」條件擋著（`onboardedAt` 過期就不跳）；就算剛 onboard 完清 localStorage 頂多再看一次 welcome，且 inline 提示只在錨點仍在時顯示 → 無壞錨點 |
| inline 提示錨點已被刪/改 | 提示 no-op 不顯示（顯示條件含「錨定 seed 項目仍存在」） |

## 7. 測試 / Definition of Done

### 單元（vitest，`*.test.ts` 與 source 同層）

- `maybeSeedOnboarding`：idempotency（跑兩次只有一份資料）、門閂條件式 update、注入 `now` 驗相對日期、locale 選對 content module。
- `provisionNewUser`：三處呼叫點（或抽出後的行為）。
- 內容健檢：三份 `content/{locale}.ts` 的 task/card/note 數量與結構一致（避免某語言漏一張卡）。

### DoD（依 AGENTS.md，build 過不算完成 → 實走整條 first-run）

- **Web**：新帳號登入 → 落在今日 → 見 seed 的一天 + welcome 卡 → 關卡 → 3 個 inline 提示可各自 dismiss → reload 後不再出現 → 完成一個範例任務正常。
- **iOS + macOS**：模擬器實測同一路徑；務必跑 `xcodebuild -scheme Nudge-iOS ... build`（SwiftUI modifier 多只在 full target build 才報錯）+ 模擬器互動。
- **邊界**：welcome 關掉後 reload 不重跳；範例全刪不重 seed；切語言後範例內容不被改寫。
- 無法親自跑模擬器互動時，明確列出步驟請使用者代測，不憑 build 過報完成。

## 8. 不做（YAGNI / 明確排除）

- 不做 sample flag / demo 沙盒（範例即真實資料）。
- 不做互動式 coach tour（highlight 一步步帶做）。
- 不做 welcome wizard（收集姓名／時區／通知權限）。
- 不做跨裝置同步的「已看過」狀態。
- 不 seed 既有舊帳號。
- 不預先展開未來的 recurrence assignment。

## 9. 待辦訊號（給 writing-plans）

- 撰寫 en / ja 兩份範例內容（4 卡片 rich HTML + 7 任務 + 3 日誌 + 4 標籤）。
- welcome 卡 + inline 提示的 UI 文案（canonical → sync → xcstrings 鏡像）。

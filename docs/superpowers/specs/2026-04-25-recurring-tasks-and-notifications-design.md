# 重複任務 + 智慧通知 設計文件

**日期**：2026-04-25
**範圍**：Nudge iOS app（macOS 部分跟著做但通知不送）
**狀態**：spec，準備進 implementation plan

---

## 1. 背景與決策

### 1.1 現況

- 任務模型：`tasks` 表（id / title / description / status / sortOrder / `remindAt`(unused)）
- 每日清單：`dailyTaskAssignments` 表，把 task assign 到 date，加上 `isCompleted` 與 `sortOrder`
- 完成狀態在 assignment 上、不在 task 上 → 同一個 task 在不同天有獨立完成狀態
- 完全 greenfield：沒有 recurring / rrule / repeat / 通知投遞任何痕跡

### 1.2 使用者決策（brainstorming 結論）

| 維度 | 決策 |
|---|---|
| 使用情境 | 全包：習慣追蹤 + 常規工作 + 提醒，不偏重 |
| 通知類型 | 個別任務時間 + 每日批次摘要 |
| 規則彈性 | preset 組合（Apple Reminders / Google Tasks 等級）|
| 心智模型 | 單一 master + 衍生實例 |
| 通知平台 | iOS only（macOS / Web 不送）|
| UI 入口 | 卡片詳細頁主入口；行動頁 row `...` menu 二級入口 |
| 結束條件 | 永遠 + 可選 end date |
| 編輯範圍 | v1 一律改 master；不支援「只改這次」的 override |
| 跳過實例 | 支援「跳過這次」 |
| 批次內容 | 早晚各一可開關，內容、時段都可選 |

---

## 2. 資料模型

### 2.1 新增 `task_recurrences` 表

每個 task 最多一條 recurrence rule（1:1 透過 `taskId UNIQUE`）。

```ts
export const taskRecurrences = pgTable("task_recurrences", {
  id: text("id").primaryKey(),
  taskId: text("task_id")
    .notNull().unique()
    .references(() => tasks.id, { onDelete: "cascade" }),
  preset: text("preset", {
    enum: [
      "daily",
      "weekdays",
      "weekly",
      "biweekly",
      "monthly_day",
      "monthly_nth_weekday",
      "yearly",
    ],
  }).notNull(),
  // CSV "1,3,5" — ISO weekday: 1=Mon ... 7=Sun
  // 給 weekly / biweekly 用；其他類型 null
  weekdays: text("weekdays"),
  // 1..31 — 給 monthly_day 用
  monthDay: integer("month_day"),
  // 1..5 (1=第一個、5=最後一個) — 給 monthly_nth_weekday 用
  monthNth: integer("month_nth"),
  // 1..7 — 給 monthly_nth_weekday 用
  monthNthWeekday: integer("month_nth_weekday"),
  // YYYY-MM-DD，第一次發生
  startDate: text("start_date").notNull(),
  // YYYY-MM-DD or null（無結束）
  endDate: text("end_date"),
  // HH:MM or null — per-task reminder 的時段；recurring task 的提醒
  // 用這欄，每次 occurrence 都會在這時間 fire
  remindAtTimeOfDay: text("remind_at_time_of_day"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
```

**為何不直接存 RRULE 字串**：preset 系統每個 case 欄位乾淨、UI 直接 binding、不用 parse / serialize。未來要升級到 RRULE 只需加一個 `rruleOverride: text` 欄位，老資料照 preset 算、有 override 就用 override，無痛升級。

### 2.2 `dailyTaskAssignments` 加欄位

```ts
isSkipped: boolean("is_skipped").notNull().default(false),
```

查詢 daily 時 `WHERE isSkipped = false`。順手加 `UNIQUE (task_id, date)` constraint，避免同一 task 在同一天有多筆 assignment（本來 schema 就該有，目前是隱患）。

### 2.3 新增 `notification_preferences` 表

每個 user 一筆。

```ts
export const notificationPreferences = pgTable("notification_preferences", {
  userId: text("user_id").primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  morningEnabled: boolean("morning_enabled").notNull().default(true),
  morningTime: text("morning_time").notNull().default("09:00"), // HH:MM
  morningContent: text("morning_content", {
    enum: ["summary", "incomplete", "summary_streak"],
  }).notNull().default("summary"),
  eveningEnabled: boolean("evening_enabled").notNull().default(true),
  eveningTime: text("evening_time").notNull().default("21:00"),
  eveningContent: text("evening_content", {
    enum: ["summary", "incomplete", "summary_streak"],
  }).notNull().default("incomplete"),
  // 全局關掉所有 per-task reminder 的開關
  perTaskRemindersEnabled: boolean("per_task_reminders_enabled")
    .notNull().default(true),
  updatedAt: text("updated_at").notNull(),
});
```

### 2.4 `tasks` 表保持不動

- 是否重複 = 「有沒有 `task_recurrences` 對應 row」
- 既有 `tasks.remindAt` (ISO datetime) 用來給**非重複任務**的一次性提醒
- 重複任務的提醒在 `task_recurrences.remindAtTimeOfDay`
- 任務從非重複轉成重複時，UI 提示是否要把 remindAt 的 time-of-day 帶入新的 recurrence

---

## 3. Recurrence 計算（純函式 occurs）

`occurs(date: YYYYMMDD, rule: TaskRecurrence) -> Bool`

外層守門：`startDate <= date AND (endDate == nil OR date <= endDate)`

| preset | 判斷 |
|---|---|
| `daily` | true |
| `weekdays` | ISO weekday ∈ {1,2,3,4,5} |
| `weekly` | ISO weekday ∈ rule.weekdays |
| `biweekly` | ISO weekday ∈ rule.weekdays AND `(date - startDate) / 7` 為偶數 |
| `monthly_day` | day-of-month == rule.monthDay；2月31日這種 = 跳過該月 |
| `monthly_nth_weekday` | 該日是該月第 N 個 W：用 cal 算出該月所有 W 的列表，取第 monthNth 個（5 = 最後一個的別名）|
| `yearly` | (月, 日) == startDate 的 (月, 日)；2/29 → 平年算 2/28 |

實作位置：
- Server：TypeScript 純函式，`src/lib/recurrence.ts`
- iOS：Swift 純函式，`NudgeCore/RecurrenceCalculator.swift`
- 兩邊都要有 unit tests

---

## 4. Lazy materialization 流程

### 4.1 `GET /api/daily/[date]` handler 改造

```
1. fetch 該 date 既有 assignments (含 task join)
2. fetch 該 user 所有 active recurrences
   (recurrence.endDate IS NULL OR recurrence.endDate >= date)
3. for each recurrence:
     if occurs(date, rule) AND 不存在 assignment for (taskId, date):
        INSERT INTO daily_task_assignments (
          id, taskId, date,
          isCompleted=false, isSkipped=false,
          sortOrder=該日當下最大值 + 1
        )
4. 回傳完整 assignments
```

唯一性 constraint 防雙寫。INSERT 用 `ON CONFLICT DO NOTHING`。

### 4.2 建立 / 編輯 recurrence 的 server handler

`PUT /api/tasks/[id]/recurrence`：
- 寫 / 更新 `task_recurrences` row
- 如果 `startDate <= today` AND `occurs(today, newRule)` → **同步 materialize 今天的 assignment**（避免使用者剛建好今天卻沒看到）
- 規則改了不會回收已 materialize 的舊 row（保守、不破壞使用者已看到的狀態）

`DELETE /api/tasks/[id]/recurrence`：
- 刪 recurrence row（task 本體保留為普通任務）
- 已 materialize 的未來 assignments 不動（讓使用者自己決定要不要 archive）

### 4.3 跳過實例

`PATCH /api/daily-assignments/[id]` body `{ isSkipped: true }`：
- 直接更新欄位
- 客戶端 list 立刻過濾掉
- UI 提供 5 秒 toast「已跳過 · 復原」可 PATCH 回 false

---

## 5. UI 流程

### 5.1 卡片詳細頁新增 Schedule 區塊

`CardDetailView` 在 RichTextEditor 上方加一個摺疊區塊（無設定時摺起、有設定時展開、顯示摘要）。

UI 元件全用 iOS 26 native：`Form` / `Section` / `Picker` / `Toggle` / `DatePicker`。

```
Section "排程"
├ Picker "重複"  → [關 / 每天 / 平日 / 每週 / 每兩週 / 每月某日 / 每月第幾個週幾 / 每年]
├ (條件) weekdays chip selector  ← weekly / biweekly
├ (條件) day-of-month picker     ← monthly_day
├ (條件) Nth + weekday pickers   ← monthly_nth_weekday
├ DatePicker "開始日期"
├ DatePicker "結束日期"  (可選 / 永遠)
├
├ Picker "提醒"  → [關 / DatePicker 或 TimePicker]
   ├ 非重複任務：完整 date+time picker（值寫入 tasks.remindAt）
   └ 重複任務：只有 time-of-day picker（值寫入 task_recurrences.remindAtTimeOfDay）
```

存檔即時 PATCH（無「儲存」按鈕，跟現在 title / description debounced save 一致）。

### 5.2 行動頁 row `...` menu 統一

過去日期跟今日 row 統一用 `...` icon（移除今日 row 的「日曆 icon」）。Menu 內容依情境動態：

| 動作 | 顯示時機 |
|---|---|
| 排入今天 | 過去日期 row 才有，今日不顯示 |
| 排到其他日期... | 永遠 |
| 跳過這次 | 該 row 對應 task 有 recurrence 才有 |
| 設為重複任務 | task 沒有 recurrence 才有；點了 push 卡片頁並展開 schedule 區塊 |
| 設定提醒 | 永遠；點了 push 卡片頁並 focus 到提醒 picker |
| 封存 | 永遠 |

### 5.3 Daily list 不加重複任務 icon

維持目前 row 視覺乾淨，不在標題旁加 SF Symbol。要看是否重複，進卡片詳細頁看 schedule 區塊。

### 5.4 設定頁通知偏好區塊

`SettingsView` 新增「通知」section（`Form` + `Section`）：

```
Section "通知"
├ Toggle "早晨摘要"
│ ├ DatePicker "時間"  (HH:MM)
│ └ Picker "內容"  → [今日待辦 / 未完成提醒 / 待辦 + Streak]
│
├ Toggle "晚上回顧"
│ ├ DatePicker "時間"
│ └ Picker "內容"
│
└ Toggle "個別任務提醒" (全局關掉所有 per-task reminder)
```

PATCH `/api/notification-preferences`，每次改即時送，server 回 200 後 iOS client reschedule local notifications。

---

## 6. iOS Local Notification 排程

### 6.1 權限

App 第一次需要排程任何 notification 時，呼叫 `UNUserNotificationCenter.requestAuthorization([.alert, .sound, .badge])`。沒授權就跳系統設定提示一次。

### 6.2 Per-task reminder

**非重複任務**（`tasks.remindAt` 是 ISO datetime）：
- 排一個 `UNCalendarNotificationTrigger`，DateComponents 對應 remindAt 年/月/日/時/分，`repeats=false`
- identifier = `task-reminder-{taskId}`
- 改 reminder time → 重新 schedule（同 ID 覆蓋）
- task 完成 / 封存 / 刪除 → cancel

**重複任務**（`task_recurrences.remindAtTimeOfDay = "09:00"`）：
- 不能用 system trigger 的 weekly repeat（不支援「每兩週」「每月第三個週二」這類）
- 改用**前向排程未來 30 天 occur 的所有日期**：
  - 算出 rule 在未來 30 天所有 occur 日期（用 §3 的 `occurs`）
  - 對每個日期排一個 one-shot trigger
  - identifier = `task-reminder-{taskId}-{YYYYMMDD}`
- Reschedule 觸發點：
  - app 進 `.active` scenePhase
  - 任務 / 規則變動

**iOS 上限**：每個 app 最多 64 個 pending notifications。client 自管 prefix `task-reminder-*`，總數逼近上限時優先排最近的。app 至少每月開一次就不會漏。

### 6.3 Daily batch（早晨 / 晚上）

排兩個 `UNCalendarNotificationTrigger` with `repeats=true`：
- identifier = `daily-batch-morning` / `daily-batch-evening`
- DateComponents = 使用者設的時段（hour, minute）

**內容問題**：local notification 排程當下就要把 title/body 寫死，無法在 fire 當下動態算。

**做法**：每次 reschedule 時根據「下次 fire 那天」的當下 snapshot 寫進 body。觸發點：
- app 進 background / inactive
- 任務 / 行事曆 events 變動

最壞誤差是「使用者最後一次離開 app」到「fire」之間的變動；對 morning 摘要而言通常前一晚就是最後狀態，誤差小。

**Body 模板**：
- `summary`: `今天有 {N} 個任務、{M} 個會議`（M 從 CalendarRepository 抓今日 Google Calendar events 數）
- `incomplete`: `還有 {N} 個任務沒完成`（晚上用）
- `summary_streak`: `今天 {N} 個任務 · 連續 {streak} 天 ✨`（streak 算法見 §6.4）

點通知 → deep link 到 DailyHostView 並切到通知對應的日期。

### 6.4 Streak 計算（給 `summary_streak` 用）

往回掃連續幾天「assignments 全部完成（沒有 incomplete 也沒有 skipped 還沒判斷）」。今天不算（會在當天算），從昨天往前推。

純客戶端算，不需要 server 欄位。

---

## 7. 跨裝置一致性（已知 trade-off）

因為純 local notification：
- iPhone 標掉的提醒，macOS 不會跟著消（macOS 沒 notification）
- 設定頁的「通知偏好」存 server，**時間 / 內容 / 開關可跨裝置同步**
- 但「提醒已 fire」這件事不跨裝置

這是選 「平台範圍 = iOS only」 時的已知 trade-off。未來要升級到 server push 是另一個 spec。

---

## 8. 不在 v1 範圍

明列以避免 scope creep：

- **「只改這一次」的 override 機制**：v1 編輯一律改 master。Override 機制（per-instance title / description / tag）等使用者反映再做
- **server-side push（APNs / Web Push）**：v1 純 local。要跨裝置 / Web 收通知是 v2
- **macOS / Web 通知**：v1 不送
- **學習型 / 場景感知通知**（會議中不推、根據過往完成時間挑時段）：v1 不做，等資料累積再評估
- **完整 RRULE input UI**：v1 只有 preset。RRULE 輸入是給進階使用者的後續加項
- **重複 N 次的結束條件**：v1 只支援「永遠」+ end date。N 次很少人用，未來再說
- **自然語言 input**（"每週一三五" parse）：v1 不做，多語系 parser 成本高

---

## 9. 推進順序建議

寫實作計畫時拆成幾個獨立 PR：

1. **Schema migration + recurrence 純函式 + tests**（無 UI）
2. **API endpoints**：`/api/tasks/[id]/recurrence` (GET/PUT/DELETE)、`/api/daily-assignments/[id]` PATCH (isSkipped)、`/api/notification-preferences` (GET/PATCH)、`/api/daily/[date]` 加 lazy materialization
3. **iOS data layer**：`TaskRecurrenceDTO`、`RecurrenceRepository`、`NotificationPreferencesDTO`、相關 repository methods
4. **iOS UI - Schedule 區塊**：CardDetailView 加排程 picker
5. **iOS UI - 行動頁 `...` menu 統一**：含跳過實例、新增 entry points
6. **iOS UI - 設定頁通知偏好**：Form section
7. **iOS notification scheduler**：per-task + daily batch + scenePhase 整合 + reschedule logic
8. **End-to-end 測試 + TestFlight**

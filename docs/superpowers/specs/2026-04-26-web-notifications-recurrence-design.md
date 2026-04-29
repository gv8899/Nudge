# Web 子題 #1：通知偏好 + 重複任務 UI

**日期**：2026-04-26
**範圍**：Web（Next.js）追平 App / Mac 已有的功能 surface
**狀態**：Design approved，待寫 implementation plan

---

## Background

App / Mac 已具備重複任務（recurring task）+ 通知偏好（notification
preferences）功能。Backend 也完成：

- `/api/tasks/[id]/recurrence` PUT — 設定 / 更新某任務的重複規則
- `/api/notification-preferences` GET / PATCH — 使用者通知偏好
- `/api/daily-assignments/[id]` PATCH — `isSkipped: true` 跳過某次發生

但 Web UI 尚未接這三個 endpoint。使用者打開 Web：

- 找不到「設為重複任務」的入口
- 沒有頁面可以設定通知偏好
- 也無法在 Web 跳過某次重複任務

Web 是長時間工作場景（跟 mac 同性質），這幾項是必要的桌機工作流功能。

## Goals

1. 使用者可以在 Web 上完成跟 App / Mac 同樣的重複任務設定動作
2. 使用者可以在 Web 設定通知偏好（早晚摘要、單任務提醒開關）
3. 使用者可以從 Web 跳過某次重複任務發生
4. UX surface 結構鏡像 mac（card detail 有 ScheduleSection、row `…` menu
   提供 quick action），使用者跨平台不用重學

## Non-Goals

- ❌ Browser push notification delivery（service worker / VAPID）— 推播
  仍由 iOS app 接收，Web 純設定中心
- ❌ Recurring badge 在 row 顯示 ⟳ 圖示 — App 沒做、Web 對齊（is recurring
  狀態由 menu 項目「跳過這次」vs「設為重複任務」隱性揭示）
- ❌ Settings 改成獨立 page — 維持現有 modal pattern
- ❌ 此 spec 不涵蓋其他 5 個子題（grid view、dashboard、popover quick edit、
  keyboard shortcuts、typography polish）

## Architecture

### 新增檔案

```
src/components/
  settings/
    notifications-section.tsx        Settings modal 的「通知」section
  task/
    schedule-section.tsx             重複規則 + 提醒時間 核心 UI
    schedule-dialog.tsx              Dialog 包裝（給 row menu 開）
    skip-confirmation-dialog.tsx     跳過確認對話框
src/lib/
  hooks/
    use-task-recurrence.ts           SWR：GET / PUT recurrence
    use-notification-preferences.ts  SWR：GET / PATCH preferences
```

### 重點：ScheduleSection DRY

`schedule-section.tsx` 是核心，被以下兩處共用：

1. **Card detail page** — inline 顯示，編輯即存
2. **Row `…` menu / context menu** — 包在 `<ScheduleDialog>` 開啟

避免兩套各自實作 recurrence picker 後續分裂。

### 修改既有檔案

- `src/components/settings/settings-modal.tsx`：插入 `<NotificationsSection />`
- `src/components/cards/card-detail.tsx`：插入 `<ScheduleSection cardId={...} />`
- `src/components/task/task-card.tsx`（或 row 對應元件）：
  - `…` menu 加三個項目：「設為重複任務」/「跳過這次」/「設提醒時間」
  - `onContextMenu` 開同樣 menu
- `src/messages/{en,ja,zh-TW}.json`：補 `schedule.*`、`notifications.*` keys

## UX Surfaces

### Surface 1：Settings modal「通知」section

新 section 與既有 sections（account / theme / language / appearance / tags /
calendar）並列，使用相同 `<section className="py-4">` + `<h3>` 樣式。

| 欄位 | 控制 | API field |
|---|---|---|
| 早晨摘要 | toggle | `morningEnabled` |
| 早晨時間 | TimeInput | `morningTime` |
| 早晨內容 | Select（summary / list） | `morningContent` |
| 晚間摘要 | toggle | `eveningEnabled` |
| 晚間時間 | TimeInput | `eveningTime` |
| 晚間內容 | Select（incomplete / summary） | `eveningContent` |
| 單任務提醒 | toggle | `perTaskRemindersEnabled` |

底部加一行小字提示：
> 推播在 iOS app 接收。Web 僅做設定。

任一欄位變動 → 500ms debounce → PATCH `/api/notification-preferences`。
失敗顯示 inline error 並 revert 該欄位。

### Surface 2：Card detail 的 ScheduleSection

完整鏡像 mac `apple/.../Cards/ScheduleSection.swift`：

```
┌─ 重複 ───────────────────────────────────────┐
│ [picker: 不重複 | 每日 | 每週 | 每兩週 |    │
│         每月某日 | 每月第 N 個星期 X]       │
│                                              │
│ 條件式：                                     │
│   每週 / 每兩週 → [日 一 二 三 四 五 六]    │
│                  (7 顆 chip 多選)            │
│   每月某日      → 「每月 12 日」(readonly)   │
│   每月第 N 個   → [picker: 第 1/2/3/4/最後] │
│                  [picker: 日/一/二/三/四/五/六] │
│                                              │
│ 起始日 [DatePicker]                          │
│ □ 設定結束日                                 │
│   結束日 [DatePicker]                        │
└──────────────────────────────────────────────┘
┌─ 提醒時間 ───────────────────────────────────┐
│ [TimeInput] (空 = 不提醒)                    │
└──────────────────────────────────────────────┘
```

任一欄位變動 → 500ms debounce → PUT `/api/tasks/[id]/recurrence` 或
PATCH card.remindAt。

### Surface 3：Daily row schedule actions

**`…` menu** 在現有 archive / move-to-today 等項目中插入（順序鏡像 mac）：

```
- 移到今天 / 移到其他日期
- ───
- 跳過這次          ← 只在 isRecurring 時顯示
- 設為重複任務      ← 只在 !isRecurring 時顯示
- 設提醒時間
- ───
- 封存
```

**右鍵 context menu** 鏡像同樣三項（跟 archive / move 一起）。

**點擊行為**：
- 「設為重複任務」/「設提醒時間」→ 開 `<ScheduleDialog>`（內含 ScheduleSection）
- 「跳過這次」→ 開 `<SkipConfirmationDialog>`：
  ```
  跳過這次發生？
  「(任務標題)」這次發生會被跳過。
  下次發生會照重複規則繼續。
  [取消]              [跳過]
  ```
  確認後 PATCH `/api/daily-assignments/[id]` `{ isSkipped: true }`，成功
  後 SWR `mutate` 當天 daily key 重新拉。

**註**：App 端 skip 目前不確認、直接執行。Web 加確認是因為桌機點擊比手
機誤觸成本低 → 確認反而幫使用者；App 之後若也要加 confirm 需另外設計。

## Data Flow

### Recurrence

```
Card detail mount
  ↓
useTaskRecurrence(taskId).data → ScheduleSection 顯示現值
  ↓
user 改欄位
  ↓
local state update + 500ms debounce
  ↓
PUT /api/tasks/[id]/recurrence
  ↓
optimistic mutate cache
  ↓ (server response)
revalidate
```

### Notification preferences

```
Settings modal open
  ↓
useNotificationPreferences().data → defaults if未設過
  ↓
user 改欄位
  ↓
local state update + 500ms debounce
  ↓
PATCH /api/notification-preferences
  ↓
optimistic mutate cache
```

### Skip occurrence

```
user 點「跳過這次」
  ↓
SkipConfirmationDialog open
  ↓
user 確認
  ↓
PATCH /api/daily-assignments/[id] { isSkipped: true }
  ↓
mutate daily(/api/daily/[date]) → 該 row 從畫面消失
```

## Validation

- **End date 必須晚於 start date** — form-level，違反時 disable save
  按鈕 + 欄位下方紅字
- **每週 / 每兩週 至少選一個 weekday** — 違反時 disable save + 提示
- **monthly_nth_weekday 第 N 個** — 1, 2, 3, 4 或「最後」(internal value 5)

## i18n

新增 keys 至 `src/messages/{en,ja,zh-TW}.json`，鏡像 apple xcstrings：

- `schedule.recurrence.off / daily / weekly / biweekly / monthlyDay / monthlyNthWeekday`
- `schedule.recurrence.startDate / hasEndDate / endDate`
- `schedule.recurrence.weekdays / monthDayN / nthN / nthLabel / weekday / last`
- `schedule.reminder.label / placeholder / clear`
- `daily.moveToToday / setRecurring / skipThisOccurrence / setReminder`
- `notifications.section / morning / morningTime / morningContent / evening / ... / perTaskReminders`
- `notifications.platformNote`（推播在 iOS app 接收）
- `daily.skipConfirmTitle / skipConfirmBody / skipConfirmAction`

按專案 convention 先加 Web，再 mirror 到 Apple xcstrings。

## Edge cases

| 情境 | 處理 |
|---|---|
| 任務沒設過 recurrence 就開 ScheduleSection | API 回 null → picker 顯示「不重複」 |
| 通知偏好沒設過 | API 回 defaults，前端不寫 DB 直到第一次 PATCH |
| 同時改 recurrence + reminder | 兩個 debounce 各自獨立、各自 PUT/PATCH |
| start date 改晚於 end date | 保留 user 輸入但 disable save、紅字提示 |
| skip 後 cache stale | mutate daily key 重新拉當天 assignments |
| Web 開 ScheduleDialog 時 card detail 也開著 | 兩處共用 useTaskRecurrence cache，編輯同步 |
| 網路錯 | toast 顯示錯誤，欄位 revert 到上次成功值 |

## Testing

- **Unit**：
  - `schedule-section` 的 preset 切換 → 條件式欄位顯隱
  - end date validation
  - `notifications-section` debounce 行為
- **Integration**：
  - GET / PUT recurrence round-trip
  - GET / PATCH preferences round-trip
  - PATCH skip → daily 重新 fetch 後 row 消失
- **E2E（playwright）**：
  - 建立每週重複任務 → 隔日刷新 daily 看到、過 1 週看到
  - 跳過某次 → 該天 row 消失但下次發生仍在
  - 改通知偏好 → reload settings 看到保留

## Open Questions

無。

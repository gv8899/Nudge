# 行事曆週檢視 Time Grid 改版（Web + Mac）

日期：2026-07-06
狀態：設計已確認（含 HTML mockup 使用者驗收）

## 目標

把 `/calendar` 的週檢視從「按日分組的 agenda 列表」改成 Google / Notion Calendar 式的**時間軸網格**（左側時間軸、7 日欄、事件按 start/end 定位），並把 **Web 與 Mac 的預設行事曆檢視改為週檢視**。

Mockup（已驗收）：https://claude.ai/code/artifact/a7ad7769-10c4-4c52-bb55-dc51eab40243

## 範圍

| 項目 | 內容 |
| --- | --- |
| 改 | Web `src/components/calendar/week-view.tsx`（重寫為 time grid） |
| 改 | Mac `CalendarWeekView.swift` — **僅 macOS** 走新網格，iOS 平台分支維持現有 agenda 列表 |
| 改 | 預設檢視：Web `calendar-host.tsx` fallback `"day"` → `"week"`；Mac `CalendarViewMode` `@AppStorage` 預設 `.day` → `.week`（僅 macOS，iOS 維持 `.day`） |
| 新增 | 重疊避讓純函式：`src/lib/calendar-layout.ts` + `NudgeUI/Calendar/CalendarWeekLayout.swift`，各配單元測試 |
| 不動 | 後端 / schema / 資料源（仍走 `useCalendarRange` 與 `CalendarRepository.events()`，唯讀）、日/月檢視、iOS 週檢視、Daily 頁 WeekStrip |

網格內容**只有 Google Calendar 事件**，不含 Nudge 任務（任務無時段欄位）。不做現在時刻紅線、不做點空白建立事件、不做拖拉。

## 版面（兩端同構，依 mockup）

- 頂部沿用現有導覽（`‹ 範圍 本週 ›` + 日/週/月切換）。
- 固定 header：7 欄（Mon–Sun）星期 + 日期數字；今天用 primary 圓形高亮。
- header 下方**全天事件列**：`allDay === true` 事件以 chip 橫放於當日欄、垂直堆疊，不進時間軸。
- 主體為垂直捲動的 24 小時網格：
  - 左側 56px 時間軸欄，每小時刻度 `HH:MM`（tabular-nums，`text-faint`）。
  - 7 日欄，每小時一條淡格線（`border` token，約 55% opacity）。
  - 每小時高度：web 48px / mac 對齊視覺（~44–48pt）。
- 事件塊：`top/height` 由 start/end 換算；primary 淡底（light `rgb(primary/0.16)`、dark `rgb(primary/0.18)`）+ 左側 3px primary 色條 + 圓角 7px；內容為標題（最多兩行）+ 起訖時間。
  - **≤30 分鐘短事件**：單行緊湊排版，只顯示標題。
  - **過去事件**（`end < now`，非 allDay）：淡底 + 色條改 `border-light`、文字 `text-dim`，沿用現有淡化規則。
  - hover 加深底色；點擊行為沿用現有（web `EventPopover`、mac 現有 `Button` action → 詳情）。
  - 跨午夜/跨日事件裁切到當日欄顯示。
- 初始捲動：當天第一個事件前一小時；當天無事件則 8:00。
- Web 手機寬度：網格 `min-width` + 外層 `overflow-x: auto` 橫向捲動，不做手機特化版。

## 重疊避讓演算法（雙語言鏡像）

純函式 `layoutDayEvents(events) -> [{event, column, columnCount}]`：

1. 事件按 start 升冪（同 start 時長者優先）排序。
2. 掃描切「重疊叢集」：與目前叢集時間範圍相接觸的事件併入，`start >= clusterEnd` 時封叢集。
3. 叢集內貪婪分欄：放入第一個 `columnEnd <= start` 的欄，否則開新欄。
4. 叢集內所有事件 `columnCount = 欄數`；寬 = `1/columnCount`，左偏移 = `column/columnCount`。

TS 與 Swift 各一份實作，**共用同一組測試案例**：不重疊、二重疊、三連鎖、包含關係、零長度事件、跨叢集不互相影響。此鏡像模式比照 `recurrence.ts` ↔ `RecurrenceCalculator.swift`。

## 預設週檢視細節

- Web：`calendar-host.tsx` 無 URL mode、無 localStorage 偏好時 fallback 改 `"week"`。已存偏好（含手選過日檢視）者不受影響。
- Mac：`@AppStorage("calendar.view.mode")` 預設值平台分支——macOS `.week`、iOS `.day`。已有存值者不受影響。
- `CalendarHostView` embedded 模式（Daily 右側面板）維持強制 `.day`，不受此變更影響。

## i18n

- 時間刻度與日期用既有 date-fns / DateFormatter locale 格式化，時間格式 `HH:MM`。
- 「全天」標籤沿用現有 key（web `calendar.eventAllDay`；mac xcstrings 對應 key），預期不需新增 key；若實作中發現缺 key，走 canonical → sync → xcstrings 鏡像流程。

## 測試與驗收（DoD）

- 避讓演算法：vitest（`calendar-layout.test.ts`）+ swift-testing 各自紅→綠，案例同組。
- Web：`npx next build` 通過 + 瀏覽器實測：切週、初始捲動、垂直捲動、點事件開 popover、重疊並排、全天列、過去事件淡化、視窗縮窄橫向捲動、深/淺色主題。
- Mac：`swift build` + `xcodebuild` full target build 通過，真 app 實測同上流程；並確認 **iOS 週檢視與預設檢視不變**。
- 互動改動等使用者實測完才 commit（依專案既有規則）。

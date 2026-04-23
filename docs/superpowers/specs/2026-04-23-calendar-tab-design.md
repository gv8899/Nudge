# 日曆 Tab + 設定入口重構（Swift）

**日期**：2026-04-23
**範圍**：iOS + macOS（共用 SwiftUI view）
**預估**：約 3 天

## 目標

新增獨立的「日曆」tab，取代原本嵌在「行動」頁的 `CalendarSectionView` 今日行程 section。日曆 tab 預設 Day view，可切換 Week / Month view。同時把「設定」從底部 tab bar 移除，改放在行動頁右上角，騰出 tab 給日曆。

## Tab bar 重排

**舊**：`行動 / 卡片 / 日誌 / 設定`（4 個）
**新**：`行動 / 日曆 / 卡片 / 日誌`（4 個）

設定從 tab bar 拿掉，改為行動頁右上角 gear icon 入口（見下方「行動頁 header」）。

## 架構

### 新檔案（`NudgeKit/Sources/NudgeUI/Calendar/`）

```
Calendar/
├── CalendarHostView.swift           ← tab root，切換 Day/Week/Month
├── CalendarDayView.swift            ← 單日事件 list
├── CalendarWeekView.swift           ← 7 天 agenda list
├── CalendarMonthView.swift          ← 月曆 grid + 下方當日 list
├── CalendarEventDetailSheet.swift   ← 事件詳情 sheet
├── CalendarConnectPrompt.swift      ← 未連結全版面 CTA
└── CalendarViewMode.swift           ← enum: day / week / month
```

### 改動

- `PlatformRootView.swift` — 移除設定 tab、新增日曆 tab（順序改為「行動 / 日曆 / 卡片 / 日誌」）
- `DailyHostView.swift`
  - 移除 `CalendarSectionView(events:isConnected:onConnectTapped:)` 整個 section
  - `statusBanner` 上方新增 header row：「行動」標題 + 右上 `gearshape` icon
  - 點 gear → 透過 `NavigationLink(destination: SettingsView)` push 進現有 `NavigationStack`（DailyHostView 已持有一個 NavigationStack 與 `DailyAssignmentDTO` destination；為 Settings 新增一組 `.navigationDestination(for: SettingsRoute.self)` 或直接包 NavigationLink，視實作便利度）
- `CalendarRepository.swift` — 新增 `events(start: end:)` 範圍查詢方法（server endpoint 已支援 `endDate` param）
- 本地化：新增 i18n keys（見下方）

## 資料流

| View | 查詢範圍 | Repository call |
|---|---|---|
| Day | 選定當日 | `events(date: selectedDate)` |
| Week | 該週週一 00:00 ~ 週日 23:59 | `events(start: weekStart, end: weekEnd)` |
| Month | 月首所在週的週一 ~ 月末所在週的週日（≥ 6 週 grid） | `events(start: gridStart, end: gridEnd)` |

`CalendarRepository` 內部依 `start|end` 字串組 cache key，切換 view 時若範圍重疊可重用（例：Day 的事件屬於 Week 範圍子集，可不重打 API）。初版實作先**每次切換都打一次 API**，cache 優化留給後續輪次。

## 行動頁 header

```
┌──────────────────────────────┐
│  行動                    ⚙   │
├──────────────────────────────┤
│     [WeekStripView]          │
│     ...                      │
```

- 標題「行動」左對齊、`.largeTitle.weight(.bold)`、`nudgeForeground`
- 右邊 gear icon：`gearshape`、`nudgePrimary` 色
- 點 gear → push 到 `SettingsView`
- `NavigationStack` 繼續覆蓋 TaskDetailView 路徑（兩條 destination：`DailyAssignmentDTO` 走原本 push detail，`SettingsRoute` push settings）

## 日曆 tab 結構

### `CalendarHostView`

```
NavigationStack {
    VStack(spacing: 0) {
        header               // 月份/週標題 + 左右切換 + view mode menu
        content              // Day / Week / Month 視 mode 渲染
    }
    .sheet($selectedEvent) { CalendarEventDetailSheet(event: ...) }
    .overlay { CalendarConnectPrompt if !isConnected }
}
```

- `@AppStorage("calendar.view.mode")` 持久化 view mode（day / week / month）
- `@State private var selectedDate: Date`（Day / Month 選中的那天）
- `@State private var selectedEvent: CalendarEventDTO?`（詳情 sheet）
- 重用 `DailyHostView` 的 `WeekStripView` 做 Day/Week 的日期導覽

### View mode 切換器（header 右上角）

SF Symbol `calendar.badge.plus` 或 `slider.horizontal.3` → tap 開 `Menu`：

```
✓ 日
  週
  月
```

選中項勾選、icon `checkmark`；沒選的空白。

### `CalendarDayView`

- 上方重用 `WeekStripView`（bind 到 CalendarHostView 的 `selectedDate`）
- 下方 list：事件依開始時間排序
- 每個 row：重用今天的事件 row 樣式（時間 left 大粗、標題 right、location 下方帶 pin icon、timeline 線）
- 點 row → set `selectedEvent`
- Empty state：「今天沒有行程」(`calendar.panelEmpty`)

### `CalendarWeekView`

Agenda list 按日分段：

```
週一 4/24 ──────────
  10:00   例行週會
  12:30   移動部門聚餐｜樂埔町

週二 4/25 ──────────
  （無事件）

週三 4/26 ──────────
  ...
```

- Header bar：`< 4月24日 - 4月30日 >` + 「今週」按鈕
- 每日分段標題：`週X M/D` 樣式 + 下方 hairline
- 無事件的日子顯示「（無事件）」灰字
- 點事件 → set `selectedEvent`

### `CalendarMonthView`

Apple Calendar 風，6-week 固定 grid：

```
2026 年 4 月              <  今  >

週一 週二 週三 週四 週五 週六 週日
 30   31    1    2    3    4    5   ← dim (prev/next month)
              •
  6    7    8    9   10   11   12
       •         •
 13   14   15   16   17   18   19
              ••       •
 20   21   22   23   24   25   26
             •••  ••       •       ← 24 highlighted (今天)
 27   28   29   30    1    2    3

──────────────────────────────
選中那天的事件
  10:00  例行週會
  12:30  移動部門聚餐｜樂埔町
  12:30  Aspire 招待
```

- 6-week 固定 grid（高度不跳動）
- 每天最多 3 個 dots，超過顯示 `···`
- Dot 色統一 `nudgePrimary`（不區分子日曆、不區分 tag）
- 今天：日期字 `nudgePrimaryForeground` on `nudgePrimary` 實心圓
- 選中（非今天）：`nudgeBorderLight` stroke 外框
- 上月 / 下月日期：`nudgeTextDim`
- Header `<` `>` 切月；「今」按鈕回今天
- 點日期 → 更新下方 list；再次點同一天（已選中）→ 切回 Day view
- Helper 純函式：`func monthGrid(for month: Date) -> [[Date]]`（單元測試）

### `CalendarEventDetailSheet`

底部 sheet，medium detent：

```
─────── ▬ ─────────
  12:30 – 15:30
  移動部門聚餐｜樂埔町（Aspire 招待）

  [ 📹 加入線上會議 ]        ← 只在 hangoutLink 非空時顯示

  📍 樂埔町 — 台北市大安區杭州南路二段67號
  🏷 mike.huang@uspace.city

  備註
  ── ─ ─ ── ──
  Aspire 請客，帶銘片 × 5

  與會者（3）
  • alice@x.com
  ...
```

- 欄位有值才渲染（`description` / `location` / `attendees` / `hangoutLink` 任一為空就不顯示該 block）
- 全天事件：時段列顯示「全天」(`calendar.eventAllDay`)
- **加入線上會議**按鈕：
  - 只在 `event.hangoutLink` 非空字串時顯示
  - `NudgeButton(variant: .primary)` 填滿寬度
  - icon `video.fill`
  - 點擊：`UIApplication.shared.open(url)`（iOS）/ `NSWorkspace.shared.open(url)`（macOS）
  - 未來擴充 Zoom / Teams 時按鈕文案不動、邏輯擴充為從 description 或新欄位判斷
- 純讀取，無編輯按鈕

### `CalendarConnectPrompt`

```
    📅
   連結 Google Calendar

 看看今天有哪些行程、會議，
   跟任務排在一起的安排。

    [ 連結 ]
```

- 全版面覆蓋整個 Calendar tab 內容（`.overlay` 或 view switch）
- 點連結 → 呼叫既有 `CalendarOAuthCoordinator.present(...)`
- 連結成功 → `calendarRepo.refreshConnectionStatus()` → `isConnected` 切 true → overlay 自動消失、事件 UI 顯示

## i18n keys（鏡像到 xcstrings）

| key | zh-Hant | en | ja |
|---|---|---|---|
| `nav.calendar` | 日曆 | Calendar | カレンダー |
| `calendar.viewMode.day` | 日 | Day | 日 |
| `calendar.viewMode.week` | 週 | Week | 週 |
| `calendar.viewMode.month` | 月 | Month | 月 |
| `calendar.weekEmpty` | 這週沒有行程 | Nothing this week | 今週は予定がありません |
| `calendar.joinMeeting` | 加入線上會議 | Join meeting | 会議に参加 |
| `calendar.attendees` | 與會者 | Attendees | 参加者 |
| `calendar.description` | 備註 | Notes | メモ |
| `calendar.thisWeek` | 今週 | This week | 今週 |
| `calendar.today` | 今 | Today | 今日 |

既有 keys 照用：`calendar.panelEmpty`（當日無事件）、`calendar.eventAllDay`（全天）、`calendar.connectTitle`、`calendar.section`。

Web 端 i18n 同時補齊對應 key 以便後續對齊。

## Empty / loading / error

| 狀態 | Day | Week | Month |
|---|---|---|---|
| 載入中 | `ProgressView` 置中 | 同 | Grid 先亮、下方 list 顯示 ProgressView |
| 無事件 | 「今天沒有行程」 | 「這週沒有行程」 | 該日無事件時下方 list 顯示「這天沒有行程」 |
| 網路錯誤 | `ErrorBannerView(onRetry:)` | 同 | 同 |
| 未連結 | `CalendarConnectPrompt` 全版面 | 同 | 同 |

## 事件點擊

任何 view 內點事件 → set `selectedEvent = event` → 觸發 sheet。Day / Week / Month 通用。

## 範圍外

- 事件編輯 / 建立
- 事件拖曳改時間
- 重複事件展開（已由 server 展開回給 client）
- 個人 tz vs 事件 tz 混合顯示（沿用「事件 tz wins」策略）
- 離線 cache 月曆事件
- 非 Google 日曆（Apple / Outlook / iCloud）
- 子日曆選擇 UI（之後做，放在設定 → 行事曆 section）
- Week view 時間軸格子視覺（本次用 agenda list）

## 測試

- `CalendarRepository.events(start: end:)` — `MockURLProtocol` unit test（URL 帶 `endDate` param、Response decode）
- `CalendarViewMode.rawValue` @AppStorage round trip — unit test
- `func monthGrid(for:)` 6-week 切片邏輯 — unit test（跨月、跨年、閏年二月等 edge case）
- Day / Week / Month view snapshot — SwiftUI Preview + 手測
- 連結 → 斷開 → 重連的 UI 狀態切換 — 手測

## 預估工作量

| 項目 | 預估 |
|---|---|
| `CalendarRepository.events(start: end:)` + cache | 0.3 天 |
| `CalendarViewMode` + `CalendarHostView` + view switcher | 0.2 天 |
| `CalendarDayView`（重用 WeekStripView） | 0.3 天 |
| `CalendarWeekView`（agenda list） | 0.3 天 |
| `CalendarMonthView`（6-week grid + 日期計算） | 0.8 天 |
| `CalendarEventDetailSheet` | 0.3 天 |
| `CalendarConnectPrompt` | 0.2 天 |
| `DailyHostView` 移除 CalendarSectionView + 加 settings header | 0.2 天 |
| `PlatformRootView` tab 重排 | 0.1 天 |
| i18n keys（xcstrings + web messages） | 0.1 天 |
| unit tests | 0.2 天 |
| **合計** | **~3 天** |

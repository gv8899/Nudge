# Swift Phase 2：行動（每日任務）設計

## 背景

Phase 1（骨架 + 基礎建設）已完成，iOS + macOS app 能 Google 登入、進到空的導航骨架。Phase 2 把「行動」tab 填滿，對齊 Web `/day/[date]` 整套每日任務功能。

## Parent Spec

上層 spec：`docs/superpowers/specs/2026-04-17-swift-rewrite-design.md`

## 範圍（In Scope）

對齊 Web `/day/[date]` 頁面全部功能：

1. **週曆 bar**：水平 7 天、有任務圓點、今天按鈕、左右滑/點週切換
2. **當日 Google Calendar events 區**：可收合，summary + 展開列出；未連結時顯示 inline CTA
3. **Overdue 區**：過去未完成任務、weekend 預設收合、單筆可排入今天 / 移到其他日期 / 封存
4. **當日任務 list**：checkbox + title + drag handle + 展開 detail icon
5. **新增任務**：iOS 底部固定輸入框；macOS ⌘N 在任務列頂端插空 row + 游標 focus（Reminders 風格）
6. **勾選完成**：toggle + 完成任務自動排到 sortOrder 底（淡出 60% + 刪除線）
7. **拖曳排序**：iOS `.onMove`；macOS `.draggable` + `.dropDestination`，加 ⌥↑/⌥↓ 鍵盤快捷鍵
8. **Swipe actions**（iOS only）：左滑封存；右滑移到明天 / 挪日期
9. **Context menu**：iOS 長按、macOS 右鍵——完成、移到…、封存、編輯
10. **Move to date popover**：iOS sheet、macOS popover，含 DatePicker
11. **任務詳細 view**：iOS NavigationStack push 全頁；macOS NavigationSplitView detail pane——title 編輯、description 編輯（純文字 TextEditor）、tags 顯示（read-only）、move date、archive
12. **Google Calendar 連結**：Settings 裡有按鈕；當日事件區未連結時 inline CTA
13. **離線**：顯示 cache + "上次更新於 HH:mm" banner；完全離線時寫入 CTA disabled

**Design tokens + i18n 基礎建設**（Phase 2 會用到，一併做掉）：

14. **Design tokens**：建 `NudgeUI/Resources/Assets.xcassets`，semantic color tokens 完全對齊 Web `src/app/globals.css`（background / foreground / primary / border / chart-1~5 / text-dim / status-*）
15. **i18n**：建 `NudgeKit/Resources/Localizable.xcstrings`（String Catalog），對應 Web `src/messages/{zh-TW,ja,en}.json` 的 key
16. **Minimal TagRepository**：只做 `GET /api/tags` + in-memory cache（只讀）。Phase 2 的 TaskDetailView 顯示 tag chips 需要名稱 + 顏色，沒完整 Tag CRUD（那是 Phase 5）

## 不做（Non-Goals）

- Status 切換 UI（Web 已移除）
- Tag 顯示在任務列（只在 detail 和卡片顯示）；tag CRUD（Phase 5）
- 富文本編輯（Phase 3 notes 才做）；Phase 2 的 description 只用純 `TextEditor`
- 離線寫入 queue
- 推播通知（Phase 6）
- Widget / Live Activity / App Intents（Phase 6）
- Paper texture / 紙質感設定（Phase 5 Settings）
- 語言手動切換設定（auto follow system locale for Phase 2；Phase 5 Settings 再加切換）
- 主題手動切換（auto follow system for Phase 2）

## 平台定位提醒

iOS 和 macOS 同等重要，每個 feature 在兩個平台都跑過完整流程才算 Phase 2 完成。Web 維持運作但不屬此 scope。

## 決策紀錄

| 項目 | 決策 | 理由 |
|------|------|------|
| macOS sidebar | 沿用 Phase 1：靜態 tab（行動 / 日誌 / 卡片 / 設定），**不**用日期樹 | 和 iOS TabView 對稱，程式碼分歧少 |
| 「今天」tab 名稱 | 改叫 **「行動」**（新 i18n key `nav.action`）| 使用者指定 |
| iOS 任務 detail | NavigationStack push 全頁（不用 sheet）| 使用者指定 |
| macOS 新增任務 | ⌘N 在任務列頂端插空 row + focus（Reminders 風格）| Mac-native |
| macOS task detail | NavigationSplitView detail pane | 善用既有三欄 |
| 拖曳 | 兩平台都做 drag；macOS 加 ⌥↑/⌥↓ 鍵盤 | 兩端都拿到順手感 |
| Calendar events 版面 | macOS content pane 左 300px + 右 tasks（仿 Web）；iOS 上方 inline 可收合 | 各平台最合理 |
| Design tokens | Asset Catalog .colorset（Any + Dark）+ `Color+Nudge` extension | iOS/macOS 標準作法 |
| i18n | String Catalog `.xcstrings`，key 對齊 Web `messages/*.json` | 避免雙 source of truth |
| Status 欄位 | Repository 仍帶 `archived` 狀態（用於封存 API）；UI 不顯示 | Web 後端仍用 status 欄，archive 動作沿用 `/api/tasks/{id}/status` |

## 架構

### 新增檔案

**NudgeKit Swift Package：**

```
NudgeKit/Sources/
├── NudgeCore/
│   ├── TaskDTO.swift              # 對齊 server tasks + daily_task_assignments
│   ├── DailyDataDTO.swift         # GET /api/daily/[date] response
│   ├── WeekSummaryDTO.swift       # GET /api/daily/week response
│   ├── CalendarDTO.swift          # Google Calendar event DTO
│   ├── TagDTO.swift               # Tag（id / name / color / sortOrder）
│   ├── TaskRepository.swift       # 讀 / 寫 / cache 協調
│   ├── TagRepository.swift        # in-memory tag cache（list only）
│   └── CalendarRepository.swift   # Google Calendar events + isConnected
├── NudgeData/
│   ├── TaskItem+Model.swift       # @Model TaskItem
│   ├── DailyAssignment+Model.swift # @Model DailyAssignment
│   └── NudgeModelContainer.swift  # 更新 schema 含兩個 @Model
└── NudgeUI/
    ├── Resources/
    │   └── Assets.xcassets        # Color tokens（+ Dark variants）
    ├── Tokens/
    │   └── Color+Nudge.swift      # extension Color token API
    ├── Daily/
    │   ├── DailyHostView.swift    # 根 view（平台中性）
    │   ├── WeekStripView.swift
    │   ├── CalendarSectionView.swift
    │   ├── OverdueSectionView.swift
    │   ├── TaskListView.swift
    │   ├── TaskRowView.swift
    │   ├── TaskDetailView.swift
    │   ├── NewTaskInputView.swift
    │   ├── MoveToDatePickerView.swift
    │   └── OfflineBannerView.swift
    └── SettingsView.swift         # 擴展 Phase 1 的 SettingsPlaceholder
```

**NudgeKit Resources：**
```
NudgeKit/Sources/NudgeCore/Resources/
└── Localizable.xcstrings          # i18n key base（ja / en / zh-Hant）
```

**Platform target 補充：**
```
Nudge-iOS/Commands+iOS.swift       # 若外接鍵盤才用——Phase 2 先略
Nudge-macOS/Commands+macOS.swift   # ⌘N、⌘→/⌘←、⌘T、⌥↑/⌥↓、⌘⌫、Space
```

### Module 邊界（沿用 Phase 1）

`NudgeCore`（Foundation）→ `NudgeData`（+ SwiftData）→ `NudgeUI`（+ SwiftUI）→ platform target（+ UIKit / AppKit）

嚴格單向；平台 target 才能碰 UIKit / AppKit。

## 資料模型

### SwiftData

```swift
@Model
public final class TaskItem {
    @Attribute(.unique) public var serverId: String
    public var title: String
    public var desc: String          // 避開 description 保留字
    public var tagIds: [String]       // Phase 5 才 join tags table
    public var createdAt: Date
    public var updatedAt: Date
    public var fetchedAt: Date        // cache 時戳
    @Relationship(deleteRule: .cascade) public var assignments: [DailyAssignment] = []
}

@Model
public final class DailyAssignment {
    @Attribute(.unique) public var serverId: String
    public var date: String          // "YYYY-MM-DD"
    public var isCompleted: Bool
    public var sortOrder: Int
    public var fetchedAt: Date
    public var task: TaskItem?
}
```

### DTO（NudgeCore）

```swift
public struct TaskDTO: Codable, Sendable {
    public let id: String
    public let title: String
    public let description: String
    public let status: String            // "inbox" | "backlog" | "in_progress" | "waiting" | "done" | "archived"
    public let tagIds: [String]
    public let createdAt: Date
    public let updatedAt: Date
}

public struct DailyAssignmentDTO: Codable, Sendable {
    public let id: String
    public let taskId: String
    public let date: String
    public let isCompleted: Bool
    public let sortOrder: Int
    public let task: TaskDTO
}

public struct DailyDataDTO: Codable, Sendable {
    public let date: String
    public let assignments: [DailyAssignmentDTO]
    public let overdueTasks: [DailyAssignmentDTO]  // 跟 assignments 同 shape
    public let noteContent: String?                // Phase 2 不用；Phase 3（日誌）消費
}

public struct WeekSummaryDTO: Codable, Sendable {
    public let datesWithTasks: [String]
}

public struct TagDTO: Codable, Equatable, Sendable {
    public let id: String
    public let name: String
    public let color: String          // hex string，例 "#5a7050"
    public let sortOrder: Int
}

public struct CalendarEventDTO: Codable, Sendable {
    public let id: String
    public let summary: String
    public let start: Date
    public let end: Date
    public let location: String?
    public let attendees: [String]
    public let hangoutLink: String?
    public let htmlLink: String?
}
```

## 資料流

### 核心原則：cache first → background revalidate → 寫入走 server

```
View ──read──> TaskRepository
                 ├─ 讀 SwiftData cache → 即時返回
                 └─ 背景 fetch API → 更新 SwiftData → @Observable 廣播

View ──create/update/delete──> TaskRepository
                 ├─ 打 API（POST/PATCH/PUT/DELETE）
                 │   ├─ 成功 → 更新 SwiftData → View 自動刷新
                 │   └─ 失敗（網路） → 丟 error → View 顯示 toast
                 └─ 不做 optimistic（先等 server 200 再寫入本地）
```

### Repository 契約

```swift
@Observable @MainActor
public final class TaskRepository {
    // 讀
    public func dailyData(date: Date) async throws -> DailyDataDTO
    public func weekSummary(start: Date, end: Date) async throws -> WeekSummaryDTO

    // 寫
    public func createTask(date: Date, title: String) async throws -> DailyAssignmentDTO
    public func toggleComplete(assignmentId: String, isCompleted: Bool, onDate: Date) async throws
    public func reorder(date: Date, orderedIds: [String]) async throws
    public func moveToDate(assignmentId: String, from: Date, to: Date) async throws
    public func archive(taskId: String) async throws
    public func updateDescription(taskId: String, description: String) async throws
    public func updateTitle(taskId: String, title: String) async throws

    // Cache 控制
    public func invalidateDay(date: Date)
    public func invalidateWeek(start: Date, end: Date)
}

@Observable @MainActor
public final class CalendarRepository {
    public func events(date: Date) async throws -> [CalendarEventDTO]
    /// 透過呼叫 events() 得到 400 來判斷未連結。
    /// 或可改呼叫 /api/calendar/calendars 判斷（回傳 200 = 連結；400 = 未連結）。
    public private(set) var isConnected: Bool
}

@Observable @MainActor
public final class TagRepository {
    /// 回傳全部 tags。第一次呼叫 fetch，後續從 in-memory cache 返回。
    public func list() async throws -> [TagDTO]
    /// 清 cache 強制重 fetch（Phase 5 CRUD 後可觸發）
    public func invalidate()
}
```

### Cache 策略

- **Write**：成功後直接寫 cache + 更新 `fetchedAt`
- **Read**：先查 SwiftData（按 date）回傳，**同時**起 async task 打 API revalidate
- **Revalidate 差異**：整包 replace（砍掉該日所有 `DailyAssignment`、重新寫入），簡單、不做 diff
- **TTL**：`fetchedAt` > 5 分鐘且 offline → 顯示 OfflineBanner；online 時不論 TTL 都 revalidate

### API endpoint 對應

| Repository method | API call | Body / Query |
|---|---|---|
| `dailyData(date:)` | `GET /api/daily/{date}` | — |
| `weekSummary` | `GET /api/daily/week` | `?start=YYYY-MM-DD&end=YYYY-MM-DD` |
| `calendarEvents` | `GET /api/calendar/events` | `?date=YYYY-MM-DD` |
| `createTask` | `POST /api/daily/{date}/tasks` | `{ title }` |
| `toggleComplete` | `PATCH /api/daily/{date}/tasks` | `{ assignmentId, isCompleted }` |
| `reorder` | `PUT /api/daily/{date}/tasks/reorder` | `{ order: [{id, sortOrder}] }` |
| `moveToDate` | `PATCH /api/daily/{date}/tasks` | `{ assignmentId, moveToDate }` |
| `archive` | `PATCH /api/tasks/{id}/status` | `{ status: "archived" }` |
| `updateDescription` | `PATCH /api/tasks/{id}` | `{ description }` |
| `updateTitle` | `PATCH /api/tasks/{id}` | `{ title }` |

### 401 處理

Phase 1 留了個洞——APIClient 的 `unauthorizedHandler` 沒接到 `AuthRepository.handleUnauthorized()`。Phase 2 要補這條線（使用 box pattern 或重構 APIClient 允許 handler 後設定）。401 → 清 token → UI 跳回 LoginView。

## 平台 UX

### iOS 主畫面

```
NavigationStack
 └─ DailyHostView
    ├─ WeekStripView              # 上方 fixed，7 天水平滑動，圓點標記有任務
    ├─ ScrollView (vertical)
    │  ├─ CalendarSectionView     # 可收合，預設 collapsed summary
    │  ├─ OverdueSectionView      # 可收合，weekend 預設收起
    │  └─ TaskListView
    └─ NewTaskInputView           # 底部 fixed input bar

點任務 → NavigationStack push TaskDetailView
```

**iOS 手勢**
- 左右滑動整個畫面 → 切前/後一天
- 長按 task row → context menu
- 左滑 task row → 封存
- 右滑 task row → 移到明天 / 挪日期
- Pull to refresh → 重拉當日資料

### macOS 主畫面

```
NavigationSplitView (三欄)
 ├─ Sidebar                     # 行動 / 日誌 / 卡片 / 設定
 ├─ Content: HStack
 │  ├─ CalendarSectionView      # 左 300px 固定
 │  └─ VStack (剩餘空間)
 │     ├─ WeekStripView
 │     ├─ OverdueSectionView
 │     └─ TaskListView
 └─ Detail: TaskDetailView or Text("選擇任務")
```

### macOS `.commands`

- `⌘N` → 插入新任務空 row + 游標 focus
- `⌘→` / `⌘←` → 切換下一天 / 前一天
- `⌘T` → 跳回今天
- `⌥↑` / `⌥↓` → 選中任務上移 / 下移
- `⌘⌫` → 封存選中任務
- `Space` → 預覽選中任務（detail pane）
- `↵` → 編輯選中任務（focus 到 detail 的 title）

### 共用 UI 規則

- 完成任務 → 淡出 60% + 標題刪除線（沿用 Web）
- 完成任務 → 自動排到 list 最底
- Overdue 任務 row 左邊紅色提示 dot
- 未連結 Google Calendar → `CalendarSectionView` 顯示 CTA 按鈕
- 離線 banner：頂部黃色條 "離線中。上次更新於 14:32"（`fetchedAt > 5min` 且 reachability fail）

### TaskDetailView 共用 layout

```
ScrollView
 ├─ Title（iOS 大字 / macOS 中字）
 ├─ Description TextEditor（純文字）
 ├─ Tags chips（read-only，從 tagIds 查 tag 顯示；未來 Phase 5 完善 tag source）
 ├─ Move to date 按鈕 → DatePicker popover
 └─ Archive 按鈕（底部，紅色）
```

## Design Tokens

### Asset Catalog 結構

```
NudgeUI/Resources/Assets.xcassets/
├── nudge.background.colorset/
│   └── Contents.json     # Any: #efe9d4, Dark: #1c1b18
├── nudge.foreground.colorset/
├── nudge.primary.colorset/
├── nudge.primaryForeground.colorset/
├── nudge.border.colorset/
├── nudge.borderLight.colorset/
├── nudge.textDim.colorset/
├── nudge.weekend.colorset/
├── nudge.chart1.colorset ~ chart5.colorset/
├── nudge.statusInbox.colorset/
├── nudge.statusBacklog.colorset/
├── nudge.statusInProgress.colorset/
├── nudge.statusWaiting.colorset/
├── nudge.statusDone.colorset/
└── nudge.statusArchived.colorset/
```

Hex 值**完全複製** Web `src/app/globals.css`（light = `:root`；dark = `.dark`）。

### `Color+Nudge.swift`

```swift
import SwiftUI

public extension Color {
    static let nudgeBackground = Color("nudge.background", bundle: .module)
    static let nudgeForeground = Color("nudge.foreground", bundle: .module)
    static let nudgePrimary = Color("nudge.primary", bundle: .module)
    // ... 其他 token
    static let nudgeStatusArchived = Color("nudge.statusArchived", bundle: .module)
}
```

**規則**：新 UI code 禁止使用 `.blue` / `.gray` / `Color(.systemBackground)` 等；所有顏色走 `Color.nudgeXxx`。

## i18n

### `Localizable.xcstrings`

用 Xcode 15+ String Catalog 格式，手動編輯 JSON schema：

```json
{
  "sourceLanguage": "zh-Hant",
  "strings": {
    "common.save": {
      "localizations": {
        "zh-Hant": { "stringUnit": { "state": "translated", "value": "儲存" } },
        "en": { "stringUnit": { "state": "translated", "value": "Save" } },
        "ja": { "stringUnit": { "state": "translated", "value": "保存" } }
      }
    }
  }
}
```

**Key 命名**：完全對齊 Web `src/messages/zh-TW.json` 的 dot-path key（例：`common.save`、`settings.account.section`）。

**Phase 2 必要 key 批次**（從 Web 複製對應的）：
- `common.save` / `common.cancel` / `common.delete` / `common.loading` / `common.today`
- `nav.action`（新 key：行動 / Action / 行動）
- `nav.notes` / `nav.cards` / `nav.settings`
- `daily.newTaskPlaceholder`（例：「新增任務」）
- `daily.overdueSection` / `daily.calendarSection` / `daily.todayButton`
- `daily.emptyState`
- `offline.banner`（例：「離線中。上次更新於 {time}」）
- `task.archive` / `task.moveTo` / `task.completed`
- `calendar.connectCTA`
- `error.network` / `error.unauthorized` / `error.unknown`
- `weekday.mon ~ weekday.sun`

**使用**：
```swift
Text("common.save")                                              // SwiftUI Text auto-resolve
let msg = String(localized: "offline.banner")                    // 動態文字
String(localized: "offline.banner", defaultValue: "...")         // 帶 default
```

## 風險與 Mitigation

| 風險 | 機率 | 影響 | Mitigation |
|---|---|---|---|
| 拖曳 iOS/macOS 體驗差異 | 高 | 中 | `.onMove` 和 `.draggable` 各寫一套，共用 `reorderCallback`。Phase 2 前一天做 spike |
| 週曆 bar 手勢（iOS 左右滑切日期）衝突 | 中 | 中 | 用 `TabView` with date-tagged pages 而非手動 DragGesture |
| Google Calendar OAuth on macOS 再次 keychain error | 低 | 高 | Phase 1 已確認 entitlement OK |
| 離線 cache 過期但 UI 沒標示 | 中 | 中 | Banner + `fetchedAt > 5min + !reachable` 觸發 |
| SwiftData schema 首次 migration | 低 | 中 | Phase 1 schema 是空，Phase 2 = 首次真實 schema，fresh create 無 migration 風險 |
| macOS ⌘N FocusState 複雜 | 中 | 中 | 用 `@FocusState` + UUID-keyed row，先做小 PoC |
| String Catalog 格式手寫易錯 | 中 | 低 | 直接從 Web messages JSON 腳本轉換產生初版 |
| 401 handler box pattern 的 Sendable 問題 | 低 | 低 | Phase 1 我們避開了；Phase 2 用 lock-protected class holder 或重構 APIClient |

## 測試策略

| 層 | 方法 |
|---|---|
| `NudgeCore` DTO Codable | Unit test，用實際 server response 當 fixture，round-trip 驗 shape |
| `TaskRepository` | Unit test with `MockURLProtocol` + `NudgeModelContainer.makeInMemory()` |
| `CalendarRepository` | 同上 |
| SwiftData cache 行為 | Integration test：cache miss → fetch → populate → subsequent hit |
| SwiftUI View | 不寫 snapshot；對複雜 ViewModel 邏輯（`OverdueCollapseState` 等）寫 unit |
| 手動驗收（CLAUDE.md 完成定義）| iOS + macOS 都跑過下方 checklist |

## Phase 2 手動驗收 checklist

- [ ] 週曆 bar：滑動、點日期、今天按鈕、圓點顯示正確
- [ ] 切日期 → 任務 list 正確刷新
- [ ] 新增任務：iOS 底部打字送出；macOS ⌘N 頂端 focus 打字 Enter
- [ ] 勾選完成 → 淡出 + 排到底 + server 更新
- [ ] 拖曳排序：iOS drag；macOS drag + ⌥↑/⌥↓
- [ ] Swipe actions (iOS)：左滑封存、右滑移日期
- [ ] Context menu（iOS 長按 / macOS 右鍵）：完成 / 移到 / 封存 / 編輯
- [ ] 點任務 → iOS push detail / macOS detail pane 顯示
- [ ] Detail view：title、description、move date 能編輯、archive 能按
- [ ] Overdue 區：排入今天 / 移到他日 / 封存 都 work
- [ ] Weekend 收合：六/日 overdue 預設收起
- [ ] Google Calendar events：已連結顯示事件；未連結 CTA 進 Settings
- [ ] Settings 連結/解除連結 Calendar 都能 work
- [ ] 離線 banner：飛航模式下顯示、寫入 CTA disabled
- [ ] i18n：切 ja / en → 所有文字正確翻譯
- [ ] Design tokens：light / dark mode 兩邊顏色正確

## Definition of Done（Phase 2 整體）

- `swift test --no-parallel` 全綠，新增至少 15 個新 test（DTO / Repository / cache）
- iOS iPhone 17 Pro simulator：驗收 checklist 全走過
- macOS 實機：驗收 checklist 全走過
- `swiftlint` / `swift-format` 沒新 warning（若 Phase 2 中引入）
- 所有 commits 都在 tests 通過後才 commit
- 和 Web 打同一 server，資料兩端一致
- Light + dark mode 都正確顯示

## 後續階段入口

Phase 2 完成後：
- Phase 3（日誌）：`Notes` feature、`WKWebView` + Quill editor 整合、notes feed
- Phase 5（卡片 + tags）：把 Phase 2 留下的 tagIds 接上真實 tag source，補 tag CRUD、kanban view

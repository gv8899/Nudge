# Swift 重寫：iOS + macOS App 設計

## 背景與動機

目前 Nudge 的 Flutter App（`/mobile/`）已開發到 Phase 5（功能大致和 Web 對齊，Google Calendar 整合已 merge），進度僅上 TestFlight，**沒有真實使用者**。

換成 Swift 的三個核心痛點（使用者親選）：

1. **macOS App 難做**：Flutter 在 macOS 吃不到選單列、視窗管理、原生控制項，macOS 感做不出來
2. **iOS 特定功能做不到**：Widget、Live Activities、App Intents / Shortcuts、Focus Filter、Siri 等 Apple 原生 framework，Flutter 沒有乾淨的接口
3. **UI 原生質感**：Flutter 的動畫、手感和 Apple 平台永遠差一層

由於目標市場是**日本 + 北歐**（iOS 市佔極高），放棄 Android 的成本低，用 Swift + SwiftUI 深耕 Apple 生態是合理選擇。

## 範圍（In Scope）

- 砍掉 `/mobile/`（Flutter 專案）
- 新建 `/apple/` Swift 專案，**單一 SwiftUI codebase、兩個 target**：`Nudge-iOS`（iPhone / iPad）、`Nudge-macOS`（Mac）
- 最低系統版本：**iOS 18+ / macOS 15+**
- 功能對齊 Web：每日任務、overdue、日誌（notes）、卡片（cards + tags + kanban）、設定、Google Calendar 整合
- 登入：Google Sign-In → `/api/auth/mobile` → Bearer token，存 Keychain
- 資料層：走現有 Next.js API（Postgres = source of truth），SwiftData 當本地離線 cache
- 平台原生功能：macOS 的 `MenuBarExtra` / 多視窗 / 全域快捷鍵；iOS 的 Widget / Live Activities / App Intents

## 不做（Non-Goals）

- Android / Windows / Linux
- CloudKit / iCloud 同步（走 server）
- 離線寫入 queue（離線只能讀、不能寫）
- 多人協作
- 重寫後端 API（沿用）
- 重寫 Web（Web 仍維護，但不屬此 scope）
- Firebase / Crashlytics / FCM（全走 Apple 原生：APNs、MetricKit、OSLog）

## 平台定位

- **macOS App = iOS App（同等重要）**
- **Web = 次要備援**（給沒有 Apple device 的人用）
- 兩個 Apple target 在每個 phase 一起做完才進下一個——避免先做完 iOS 才補 macOS，SwiftUI 共用 view 記憶最高

## 技術選型

| 項目 | 選擇 | 理由 |
|------|------|------|
| UI | SwiftUI + `#if os` 分歧 | 單一 codebase 覆蓋兩平台，macOS 差異處用 `NavigationSplitView` / `MenuBarExtra` / `Settings` scene |
| 狀態管理 | `@Observable` + Observation framework | iOS 17+ 新 API，取代 `ObservableObject`；不引 TCA 避免過度工程 |
| 架構風格 | Model-View（MV），Repository pattern | Apple 官方 sample 走法；複雜畫面才拆 `ViewModel` 中繼層 |
| 網路層 | 純 `URLSession` + `async/await` + `Codable` | Alamofire 對此 scope 是 overkill |
| 本地 cache | SwiftData（`@Model`）| 離線讀、聯網寫；SwiftData 原生整合 SwiftUI `@Query` |
| 富文本（notes/cards description） | `WKWebView` 包 Quill editor（iOS + macOS 共用） | 風險最低、跟 Web + Flutter 舊版相容；SwiftUI 原生富文本生態不夠成熟 |
| 登入 | GoogleSignIn-iOS SDK + `ASWebAuthenticationSession` fallback | 沿用現有 `/api/auth/mobile` 驗證流程 |
| i18n | String Catalogs（`.xcstrings`），ja + en + zh-Hant | 新 API 比舊 `.strings` 強非常多，符合目標市場 |
| 推播 | APNs 直推 | 已放棄 Android，不需 FCM 抽象 |
| 測試 | Swift Testing（`@Test`）| 新 framework，取代 XCTest；不寫 SwiftUI snapshot |
| 可觀測性 | OSLog + MetricKit + Xcode Organizer | 避免額外 SDK 依賴 |

## 專案結構

```
nudge/                         ← repo 根（不變）
├── src/                       ← Next.js web（不變）
├── mobile/                    ← 【Phase 0 砍掉】Flutter
├── apple/                     ← 【新增】Swift 專案根
│   ├── Nudge.xcworkspace
│   ├── Nudge.xcodeproj
│   ├── Nudge-iOS/             ← iOS target
│   │   ├── NudgeiOSApp.swift
│   │   ├── Info.plist
│   │   └── Widget/            ← Widget Extension target
│   ├── Nudge-macOS/           ← macOS target
│   │   ├── NudgeMacApp.swift
│   │   └── Info.plist
│   └── NudgeKit/              ← 本地 Swift Package（共用 code）
│       ├── Package.swift
│       └── Sources/
│           ├── NudgeCore/     ← DTOs、API client、domain types
│           ├── NudgeData/     ← SwiftData @Model、Repository
│           └── NudgeUI/       ← 共用 SwiftUI Views
```

### Module 邊界（單向相依）

| Module | 能 import 什麼 | 職責 |
|--------|--------------|------|
| `NudgeCore` | Foundation only | DTOs、API client、networking errors、domain types |
| `NudgeData` | `NudgeCore` + SwiftData | `@Model` 物件、Repository、cache invalidation |
| `NudgeUI` | `NudgeCore` + `NudgeData` + SwiftUI | 共用 View（task row、tag badge、editor）。用 `#if os` 分歧 |
| `Nudge-iOS` | `NudgeKit` + UIKit | iOS-only scenes、Widget、App Intents |
| `Nudge-macOS` | `NudgeKit` + AppKit | macOS-only scenes、MenuBarExtra、全域 hotkey |

**相依方向嚴格單向**：`UI → Data → Core`，沒有反向 import。平台 target 才能碰 UIKit / AppKit。

### 為什麼切成 Swift Package

- 三個 target（iOS、macOS、Widget）都能 import 同一份 shared code
- 強制「shared code 不碰 UIKit / AppKit」（SPM 編譯時抓）
- SPM target 比 Xcode target build 快
- 未來要加 watchOS / visionOS，多一個 target import `NudgeKit` 即可

## 資料流與同步

### 核心原則：離線讀、聯網寫

```
View ──read──> Repository ──┬─ cache hit → SwiftData (即時返回)
                            └─ background fetch → API → update SwiftData → notify View

View ──write──> Repository ──> API ──ok──> update SwiftData ──> View 自動刷新
                                    └──fail (離線)──> 顯示錯誤，不寫 cache
```

### Repository 契約（每個 domain 一個）

```swift
@Observable
public final class TaskRepository {
    public func tasksForDate(_ date: Date) -> [Task]
    public func createTask(_ input: NewTaskInput) async throws -> Task
    public func updateStatus(_ id: String, _ status: TaskStatus) async throws
    public func reorder(_ ids: [String], date: Date) async throws
}
```

### 為什麼不做離線寫

離線寫入 queue 要處理：衝突解決、retry、pending UI 狀態、失敗 rollback、optimistic ID、時鐘不同步。以「一人開發 + 使用者通常有網路」而言成本遠大於效益。

**後路**：Repository 介面設計保留這個可能——未來要做，`createTask` 改為先寫 SwiftData 再背景 retry 送 server，介面不變。

### API Client

- `NudgeCore/APIClient.swift` — `URLSession` + `async/await`
- Bearer token 從 Keychain 讀，401 觸發重新登入
- `Codable` DTO shape 對齊 Web server response
- 統一錯誤 type：`APIError { .unauthorized, .network, .server(code), .decoding }`

### SwiftData Schema（Cache-oriented）

- `@Model Task`、`@Model Tag`、`@Model DailyNote`、`@Model CalendarEventCache`
- 每個 Model 有 `serverId: String`（對應 server uuid）、`fetchedAt: Date`（cache 時戳）
- 查詢用 `@Query` + predicate
- TTL：預設 cache 永久保留，聯網時背景 revalidate；離線時顯示 "上次更新於 xx"

### SwiftUI 和 Data 的綁定

- View 透過 `@Environment(TaskRepository.self)` 取 repository
- Repository 透過 `@Observable` 廣播變更，View 自動 reactive
- 不用 Combine / Publishers

### 平台差異處

- **macOS 多視窗**：多個 View 共用同一個 repository instance，透過 `.environment` 注入
- **iOS Widget**：Widget 不能共用 in-memory repository，走 App Group + 直接讀 SwiftData store（read-only）

## 平台 UX 差異

同樣 feature，兩邊呈現方式不同：

| Feature | iOS | macOS |
|---------|-----|-------|
| 主導航 | `TabView`（行動 / 日誌 / 卡片 / 設定） | `NavigationSplitView` 三欄 |
| 每日任務 | 週曆 bar 在上方，任務清單捲動 | sidebar 日期樹、中欄任務清單、detail 顯示選中任務 |
| 新增任務 | 底部固定輸入框 | ⌘N 開新任務 sheet；`MenuBarExtra` 也能直接加 |
| 狀態切換 | 長按 / swipe → menu | 右鍵 context menu + ⌘1-6 快捷鍵對應 6 種 status |
| 拖曳排序 | `DragGesture` + `.onMove` | 原生 AppKit drop（多選 + shift + command） |
| 卡片看板 | 水平捲動 column | 多欄並列，方向鍵導覽，滑鼠拖曳 |
| 日誌編輯 | 全螢幕 `WKWebView` Quill | 可獨立視窗（⌘⇧N 開新視窗），多日誌並列 |
| 設定 | `Form` → push 進 sub-screen | `Settings` scene（⌘,）tab 分類 |
| 鍵盤 | 外接鍵盤才支援 | 全面支援：⌘N、⌘F、⌘⇧D 標完成、Space 預覽、⌘W |
| 選單列 | — | 完整 `File` / `Edit` / `View` / `Window` / `Help` |
| Menu Bar Extra | — | 狀態列圖示，點開顯示今日任務 + 快速加入 |
| OAuth redirect | `ASWebAuthenticationSession` | 同上（macOS 也支援） |

**實作原則**：
- 能用 SwiftUI 自己的 platform-aware container（`NavigationSplitView`、`TabView`）就用
- `#if os(macOS)` 只用在「那邊沒這個 API」的地方
- 避免整個 View 雙份

## Phase 規劃

```
Phase 0: 砍 Flutter、起 Xcode 專案骨架
   ↓
Phase 1: 基礎建設（auth、HTTP client、SwiftData cache、導航骨架）
   ↓
Phase 2: 行動（每日任務）— iOS + macOS 同時做完
   ↓
Phase 3: 日誌（notes + WKWebView Quill editor）
   ↓
Phase 4: 卡片 + tags + kanban
   ↓
Phase 5: 設定 + Google Calendar 整合
   ↓
Phase 6: Apple 平台專屬深耕（iOS Widget / Live Activities / App Intents；macOS MenuBarExtra / hotkey / 多視窗）
   ↓
Phase 7: 上架（iOS + macOS 分別送審）
```

### 為什麼這樣排

- Phase 0-1 是基礎建設，沒它做不了任何 feature
- Phase 2-5 按「最常用 → 最少用」，對齊 Web 現有 feature 權重
- **每個 phase iOS + macOS 一起做完才進下一個**（兩平台同等重要；同時做 SwiftUI 共用 view 記憶最高）
- Phase 6 刻意擺在 feature parity 之後，避免還沒追上 Web 就先做花的
- Phase 7 上架放最後

### 每個 Phase 的驗收

- 每個 feature 在 iOS 和 macOS 都跑完整使用者流程（不只 build 過）
- 和 Web 打同一 server，資料一致
- 離線時能讀 cache，聯網自動同步

### 時間估（一人 + Claude Code 輔助）

| Phase | 預估 | 主要風險 |
|-------|------|---------|
| 0. 骨架 | 0.5 天 | — |
| 1. 基礎建設 | 1-2 天 | SwiftData cache 策略 |
| 2. 行動 | 3-5 天 | 拖曳排序（iOS / macOS 差異大） |
| 3. 日誌 | 3-5 天 | WKWebView + Quill 整合（最大風險） |
| 4. 卡片 | 3-5 天 | Kanban 拖曳在 macOS 的鍵盤 / 滑鼠互動 |
| 5. 設定 + Calendar | 2-3 天 | OAuth redirect 在 macOS 與 iOS 不同 |
| 6. Apple 專屬 | 5-7 天 | Live Activities / MenuBarExtra 學習曲線 |
| 7. 上架 | 2-3 天 | App Review（特別 Google OAuth 審查） |
| **合計** | **約 3-4 週** | |

## 風險與 Mitigation

| 風險 | 機率 | 影響 | Mitigation |
|------|------|------|-----------|
| WKWebView + Quill 整合（日誌/卡片都吃） | 高 | 高 | Phase 3 前做 spike：WKWebView 載 Quill、iOS/macOS 鍵盤高度、focus、選取、JS bridge。一天內驗證不過改方案（SwiftUI `TextEditor` + Markdown） |
| SwiftData 在 macOS 多視窗共享 store | 中 | 中 | 用 `ModelContainer` singleton + 每 view 自己 `ModelContext`。先跑小 PoC 確認 multi-window 寫入不打架 |
| 拖曳排序跨平台 | 中 | 中 | iOS `.onMove`、macOS `.draggable`/`.dropDestination`——不強求共用，各平台各寫一套但共用 reorder callback |
| Google OAuth on macOS（`ASWebAuthenticationSession` 行為和 iOS 不同）| 中 | 高 | Phase 1 最先驗證；fallback：開預設瀏覽器 + custom URL scheme |
| App Review 駁回（Google OAuth + 日本市場）| 中 | 高 | Privacy manifest、App Privacy 填完整、OAuth 只拿最小 scope。iOS 和 macOS 分別送審要排雙倍時間 |
| Live Activities / Widget 複雜度 | 低 | 中 | Phase 6 才做，無法做也不擋上架 |
| 日文排版（行高、標點） | 低 | 低 | `.xcstrings` + 日文 tester 實機看 |

## 測試策略

- **單元測試**：`NudgeCore`（API client、DTO encode/decode、錯誤處理）、`NudgeData`（Repository 邏輯、cache invalidation）
  - Swift Testing（`@Test`），不用 XCTest
  - API client 用 `URLProtocol` stub，不打真實網路
- **整合測試**：對 Repository 測 "cache miss → fetch → populate → subsequent hit"
- **SwiftUI View 測試**：不寫 snapshot test（維護成本高）；只對複雜邏輯的 ViewModel 測
- **手動測試（必跑，對應 CLAUDE.md 的「完成定義」）**：每個 phase 結束前，iOS 模擬器 + 實機、macOS 實機各跑一次完整使用者流程
- **CI**：先不上 GitHub Actions（一人專案先節省）；Phase 7 上架前再加

## 可觀測性

- 不上 Crashlytics / Firebase
- Apple 內建：**MetricKit** + **OSLog** + Xcode Organizer 看 crash 和效能
- 錯誤上報：server 5xx 本機 log，不自動上傳

## Open Questions（進 plan 前需補）

- `/apple/` 資料夾位置是否真要在 repo 根（或另起 repo）？spec 預設放 monorepo，待 plan 階段再次確認
- 日文市場的日曆格式（週起始日、節日顯示）是否需要 locale-aware 調整
- macOS App Store 送審是否走 Mac App Store 或 Developer ID 直發（此 spec 預設 Mac App Store）
- Swift 域模型命名：`Task` 與 Swift Concurrency 的 `_Concurrency.Task` 衝突，必須改名。候選：`TaskItem` / `TodoItem` / `NudgeTask`。此 spec 的 Repository 範例暫用 `Task` 示意，plan 階段統一更名

## Definition of Done（整個 Swift 重寫計畫）

- `/mobile/` 資料夾從 repo 刪除
- `/apple/` 專案在 iOS 實機 + macOS 實機都能完整跑 Phase 2-5 所有 feature
- iOS + macOS App 都送審通過、上架
- 三端（iOS / macOS / Web）對同一 server 資料保持一致
- 離線時 iOS / macOS App 能讀 cache

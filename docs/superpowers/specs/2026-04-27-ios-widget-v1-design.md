# iOS Widget v1 — 任務快速捕捉

日期：2026-04-27
範圍：iOS（主要）；macOS / Web 不在 v1
目標市場：日本 + 北歐（決定功能取捨優先序），US/EU 為加成

## 動機

Nudge 目前無任何 widget。研究顯示 widget 在目標市場是 install + retention 雙重 driver：

- **JP**：「ホーム画面カスタマイズ」自 2020 起的長尾文化；通勤手機時間長；「一目で分かる」勝過開 App
- **北歐**：「lagom / hygge」— 手機是工具不是娛樂；冬天戴手套常用 Lock Screen + StandBy；安靜、不說教
- **US**：feature parity 敏感、deep-link 不準會被換 app

「為了 widget 才裝 app」的成功案例：Drafts（Lock Screen 快速捕捉）、Streaks、Fantastical、TimeTree（JP 家庭日曆）、Apple Reminders（iOS 17 後的 interactive checkbox）。

v1 anchor 在「**快速捕捉任務**」moment：通勤、走路、開會中突然想到事情，現在因為要解鎖 → 找 App → 進輸入頁 → 打字，最常被忘記。

## v1 範圍：兩個 widget

### Widget A — Quick Add

純按鈕，不顯示資料 → 永不 stale。

**Surface**：
- Home Small
- Lock Screen rectangular

**互動**：
- 點 → 開 App 到 Daily NewTask 輸入框，已 focused，鍵盤已彈

**視覺**：

```
 ┌──────────┐         ┌─────────────────────┐
 │          │         │  ＋  新增任務        │
 │    ＋    │         │     タスク追加       │
 │  新增    │         └─────────────────────┘
 │  タスク  │           Lock Screen rectangular
 └──────────┘
   Home Small
```

**規範**：
- icon + 文字 label（純「＋」在 JP App Store 評論被嫌「これ何？」）
- 文字遵守既有 i18n 三語：zh-Hant / ja / en

### Widget B — Today's 5

顯示當日前 5 任務 + 加號。Interactive checkbox。

**Surface**：
- Home Medium

**互動**：
- 圓圈點擊 → App Intent 直接勾完成 / 取消（不開 App）
- 點任務文字 → 開 App 到該 task 的編輯 sheet（**不是** Today 列表 — 這是研究中第二大 universal 抱怨）
- 點右上「＋」→ 同 Widget A 的 NewTask 目的地

**視覺**：

```
 ┌──────────────────────────────────┐
 │ 4/27 月                       ＋ │
 │ ──────────────────────────────── │
 │ ○  打電話給設計師                │
 │ ○  寫 spec                       │
 │ ✓  跑步                          │
 │ ○  回 X 信                       │
 │ ○  買牛奶                        │
 └──────────────────────────────────┘
   Home Medium
```

**規範**：
- 顯示「今日 + 未完成 overdue」任務（與 Daily tab 內容邏輯一致 — `TaskListView` + `OverdueSectionView` 合併），按 Daily 排序取前 **5 個**
  - 5 的決定原因：JP 嫌 3 個 sparse，北歐能接受 5；3 個是 US 主流但 JP 不夠用
- Overdue 顯示在前（與 Daily 一致）；今日任務在後
- 包含已完成的會顯示在原位置，灰底刪除線；不另外把已完成移到底
- **不顯示**：進度數字（「2/5」）、streak、勵志語（北歐 + JP 反感）
- 任務數 < 5：剩餘空間留白（不放 placeholder 任務）
- 任務數 = 0（今日無任務 + 無 overdue）：顯示一行 fallback 文字「今日無任務 ・ ＋ 新增」+ 加號 → tap 進新增
- 「今日」以裝置本地時區為準（與 App 一致；TimelineProvider 在隔日 00:00 安排換日 reload）

### iOS 版本

Minimum **iOS 17.0**。理由：
- Widget B 的 interactive checkbox 是 iOS 17 才支援
- 2026 滲透率 ~97%，安全
- 研究：iOS 17 後沒推 interactive checkbox 的 app（Things、OmniFocus）被批評「abandoned」

## 資料流（解第一名抱怨：stale data）

```
┌───────────────────────────────────────────────────────────┐
│ Nudge App（iOS）                                          │
│                                                           │
│   TaskRepository.markComplete / markIncomplete /          │
│     create / delete / update                              │
│      │                                                    │
│      ├──► API（既有）                                    │
│      ├──► SwiftData（既有）                              │
│      ├──► WidgetSnapshotStore.write()  ◄── 新增          │
│      │       │                                            │
│      │       ▼                                            │
│      │    Shared App Group container                      │
│      │    /Library/.../snapshot.json                      │
│      │                                                    │
│      └──► WidgetCenter.shared.reloadAllTimelines()       │
│              （新增、由 WidgetSnapshotStore 觸發）        │
└───────────────────────────────────────────────────────────┘
                          │
                          │ 讀
                          ▼
┌───────────────────────────────────────────────────────────┐
│ NudgeWidget（Widget Extension）                           │
│                                                           │
│   TimelineProvider.getTimeline()                          │
│      └─► 讀 snapshot.json → 渲染                         │
│                                                           │
│   ToggleCompletionIntent（App Intent）                    │
│      ├─► APIClient.markComplete(id, !current)             │
│      │     （token 從 Shared Keychain）                  │
│      ├─► 更新 snapshot.json                               │
│      └─► WidgetCenter.reloadAllTimelines()               │
└───────────────────────────────────────────────────────────┘
```

### Snapshot schema

`snapshot.json`（極簡，避免 widget 載入大量資料）：

```json
{
  "date": "2026-04-27",
  "generatedAt": "2026-04-27T14:30:00Z",
  "tasks": [
    { "id": "...", "title": "打電話給設計師", "completed": false },
    { "id": "...", "title": "寫 spec", "completed": false },
    { "id": "...", "title": "跑步", "completed": true }
  ]
}
```

只存 widget 渲染需要的欄位。Tasks 陣列已按 Daily 排序，widget 直接 take(5) 不再排序。

### TimelineProvider 策略

Widget B 的 `TimelineProvider.getTimeline()`：

- 主 entry：當下 snapshot（讀 JSON）
- 次 entry：當天 23:59:59 之後的下一個 entry，其 `date = 隔日 00:00`（讓 widget 在午夜換日）
- 不依賴 system 自動 refresh（budget 不可控）；換日 + task mutation 都靠 `WidgetCenter.reloadAllTimelines()` 主動觸發

### 為何不直接 share SwiftData container

- Widget extension 載入完整 SwiftData stack 對 memory 浪費（widget 有 ~30MB memory limit）
- JSON 讀寫成本最低
- App Group container 即可達成跨 process 共享，不需要 SwiftData 共享
- 樂觀更新失敗 rollback 簡單（重寫 JSON）

## Deep-link

兩種機制各司其職：

### Universal Link / Custom URL Scheme（widget tap → 開 App 到指定頁）

| URL | 行為 |
|-----|------|
| `nudge://daily/new` | 開到 Daily，立刻彈 NewTask sheet 並 focus 鍵盤 |
| `nudge://task/<id>` | 開到該 task 的編輯 sheet（同 Daily tap task 的行為） |

`nudge://` URL scheme 在 `Info.plist` 註冊（如尚未註冊；目前已有 GoogleSignIn callback scheme，需新增獨立 scheme 或共用）。

### App Intent（widget 內互動，不開 App）

`ToggleTaskCompletionIntent: AppIntent`：
- 參數：`taskId: String`
- 執行：呼叫 APIClient.toggleCompletion(taskId)；成功後更新 snapshot + reload timelines
- 失敗（無網路 / 401）：rollback snapshot、reload timelines、不顯示錯誤（widget 沒地方顯示，下次開 App 看狀態）

## i18n + 排版規範

### 三語 keys（沿用既有結構）

新增到 `src/messages/{zh-TW,ja,en}.json` 的 `widget` namespace + 鏡像到 `Localizable.xcstrings`：

| Key | zh-TW | ja | en |
|-----|-------|-----|----|
| `widget.quickAdd.label` | 新增任務 | タスク追加 | New task |
| `widget.quickAdd.iconLabel` | 新增 | 追加 | Add |
| `widget.todayList.title` | 今日 | 今日 | Today |
| `widget.todayList.empty` | 今日無任務 ・ ＋ 新增 | 今日のタスクなし ・ ＋ 追加 | No tasks today · + Add |
| `widget.kind.quickAdd.displayName` | 快速新增任務 | クイック追加 | Quick Add |
| `widget.kind.quickAdd.description` | 一鍵新增今日任務 | ワンタップで今日のタスクを追加 | Add a task in one tap |
| `widget.kind.todayList.displayName` | 今日任務 | 今日のタスク | Today's Tasks |
| `widget.kind.todayList.description` | 顯示今日前 5 個任務 | 今日のタスクを 5 件表示 | Shows your top 5 tasks today |

### 排版測試 gate

- **JA**：5 個任務各長 12-18 個漢字 / 假名 — 確認斷字在字元邊界、不爆 Medium height
- **SV**：用 `livförsäkringsbolagsanställd`（瑞典文 28 字 compound word）測 wrap — 確認不破版
- **超長 title**：> 30 字 → 用 `lineLimit(1) + truncationMode(.tail)`，斷字在字元邊界

## 工程影響面

### 新 target

`NudgeWidget`（Widget Extension）放在 `apple/Nudge-iOS/NudgeWidget/`：

```
NudgeWidget/
├── NudgeWidgetBundle.swift          // @main、組合所有 widgets
├── QuickAddWidget.swift             // Widget A
├── TodayListWidget.swift            // Widget B
├── ToggleTaskCompletionIntent.swift // App Intent
├── WidgetSnapshot.swift             // 共享資料模型（與 App 共用）
├── Info.plist
└── Resources/
    └── Assets.xcassets              // Widget app icon（系統需要）
```

色彩 / 字型 token：透過 SPM 共享 `NudgeUI` 中的 `Color+Nudge.swift`（widget extension 可 import）。

### App Group 設定

新 App Group identifier：`group.tw.nudge.app`

需更新 capability：
- `apple/Nudge-iOS/Nudge-iOS.entitlements`：加 App Group
- `apple/Nudge-iOS/NudgeWidget/NudgeWidget.entitlements`：同 App Group

### Keychain shared

既有 `KeychainStorage(service: "tw.nudge.app")` 改為使用 access group `tw.nudge.app.shared`，讓 widget 也能讀 token。

需更新：
- `apple/NudgeKit/Sources/NudgeCore/KeychainStorage.swift`：建構子接受 access group
- `apple/Nudge-iOS/NudgeiOSApp.swift`：建立 KeychainStorage 時傳入 access group
- 兩個 entitlements 加 `keychain-access-groups`

### TaskRepository hook

`apple/NudgeKit/Sources/NudgeCore/TaskRepository.swift`（與相關 method）每次 mutation 後：

```swift
private func notifyWidget() {
    Task { @MainActor in
        await WidgetSnapshotStore.shared.refresh(from: self.todayTasks())
        WidgetCenter.shared.reloadAllTimelines()
    }
}
```

需要 NudgeCore 知道 widget 概念 — 用 protocol 注入避免直接依賴 WidgetKit：

```swift
public protocol WidgetRefresher: Sendable {
    func refresh(tasks: [TaskDTO]) async
}

// In iOS App init:
TaskRepository.widgetRefresher = WidgetSnapshotStoreImpl()
```

### URL scheme 註冊

`apple/Nudge-iOS/Info.plist` 加 `CFBundleURLSchemes` 含 `nudge`（檢查不與 GoogleSignIn 既有衝突；GoogleSignIn 用的是 reverse client ID，不衝突）。

### Tasks 排序共享

目前 Daily 排序邏輯在 `DailyHostView.swift` 內。為了 widget 與 App 對齊，把排序抽到 `NudgeCore/TaskOrdering.swift`，App 與 Widget 共用。

## 不在 v1 範圍

- **StandBy 模式 widget**：研究顯示訊號太弱、不是 decision driver
- **Lock Screen circular streak ring**：需要 streak 邏輯（目前 App 也沒有 streak），v2
- **Large widget**：ROI 低
- **Live Activities / Dynamic Island**：不同 problem space（時間性事件）
- **Widget 配置 sheet**（讓使用者選 list / project）：v1 都顯示「今日」，避免增加複雜度
- **macOS desktop widget**：留 v2
- **多 widget instance**：iOS 14+ 預設就支援裝多個，這不是新做、不需特別處理；只是不為它調 API
- **Widget configuration AppIntent**（讓使用者在 widget gallery 設定 list / 顏色等）：v1 不需要

## 測試計畫（Definition of Done）

依專案 AGENTS.md：

### 編譯

- [ ] `xcodebuild -scheme Nudge-iOS ... build` 通過（Widget extension target 也一併編）
- [ ] Widget snapshot 測試（SwiftUI Preview snapshot）三語都通過
- [ ] 既有 macOS / Web build 不受影響

### 模擬器實測（必跑）

**Widget A**：
- [ ] Home Small：長按 home → 加 widget → 看到「＋ 新增任務」
- [ ] 點 widget → App 開到 Daily，鍵盤彈出，輸入框 focused
- [ ] Lock Screen rectangular：解鎖前點 → 解鎖後直達 NewTask focused
- [ ] 切日 / EN：label 文字變化正確

**Widget B**：
- [ ] 加 Medium widget → 看到今日 5 任務
- [ ] 點圓圈勾完成 → 圓圈瞬間變勾、不需開 App、灰底刪除線立刻反映
- [ ] 切回 App 看 Daily：該 task 也已完成（資料同步）
- [ ] 點任務文字 → App 開到該 task 編輯 sheet（不是 Today 列表）
- [ ] 點右上「＋」→ NewTask focused
- [ ] 從 App 內勾完成另一 task → widget < 5 秒內反映
- [ ] 任務 = 0（今日全清空）：widget 顯示 empty state「今日無任務 ・ ＋ 新增」
- [ ] 任務 < 5（例如 3 個）：剩餘空間留白
- [ ] 切日：widget 自動換到新一天（隔日凌晨 reloadTimelines）

**Stale data 測試**：
- [ ] App 內快速勾選 5 次 → widget 5 次都正確反映
- [ ] 飛航模式下勾選 widget checkbox → 樂觀更新顯示，再開飛航回網路 → API 同步成功 / 失敗都不破版

**i18n 排版**：
- [ ] JA：5 個任務每個長 12-18 漢字，不爆 height、不破版
- [ ] SV：超長 compound word 不破 layout、字元邊界斷字
- [ ] EN：5 個任務各 30 字，正確 truncate

### macOS / Web

不在範圍，跳過。

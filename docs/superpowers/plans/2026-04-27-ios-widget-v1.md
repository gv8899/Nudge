# iOS Widget v1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Nudge iOS App 加兩個 widget：A（Quick Add — Small + Lock rectangular）+ B（Today's 5 — Medium，interactive checkbox），對齊 JP / 北歐 / US 市場通用最佳實務。

**Architecture:** 新增 `NudgeWidget` Widget Extension target；App ↔ Widget 透過 App Group 共享 `snapshot.json` + Keychain access group；TaskRepository mutation 後寫 snapshot + `WidgetCenter.reloadAllTimelines()`；Widget B 內 checkbox 透過 App Intent (`ToggleTaskCompletionIntent`) 不開 App 直接完成任務。

**Tech Stack:** SwiftUI、WidgetKit、AppIntents、App Group、Shared Keychain (kSecAttrAccessGroup)、JSONEncoder/Decoder。

**參考 spec：** `docs/superpowers/specs/2026-04-27-ios-widget-v1-design.md`

**重要規則（覆寫 skill 預設）：**
- **Commit message 用繁體中文**（prefix 保留英文 conventional）。
- **等使用者實機測試通過才 commit**。Task 1–8 只改 code + 區域驗證；Task 9 請使用者實測；Task 10 才 commit。
- **iOS 改動後一定要 build + install + relaunch sim**（不只 `swift build`）。
- 互動功能必須實機跑（不能只看 build 通過就報完成）。

---

## File Structure

| 路徑 | 動作 | 內容 |
|------|------|------|
| `apple/Nudge.xcodeproj` | Modify (Xcode UI) | 新增 NudgeWidget target、配置 entitlements、加 App Group capability |
| `apple/Nudge-iOS/Nudge-iOS.entitlements` | Create or Modify | App Group + Keychain access group |
| `apple/Nudge-iOS/NudgeWidget/NudgeWidget.entitlements` | Create | 同上 |
| `apple/Nudge-iOS/NudgeWidget/Info.plist` | Create | Widget extension Info.plist |
| `apple/Nudge-iOS/NudgeWidget/NudgeWidgetBundle.swift` | Create | `@main` widget bundle |
| `apple/Nudge-iOS/NudgeWidget/QuickAddWidget.swift` | Create | Widget A |
| `apple/Nudge-iOS/NudgeWidget/TodayListWidget.swift` | Create | Widget B + Provider |
| `apple/Nudge-iOS/NudgeWidget/ToggleTaskCompletionIntent.swift` | Create | App Intent for checkbox |
| `apple/NudgeKit/Sources/NudgeCore/WidgetSnapshot.swift` | Create | 共享資料模型（App + Widget） |
| `apple/NudgeKit/Sources/NudgeCore/WidgetSnapshotStore.swift` | Create | 讀寫 App Group container 的 JSON |
| `apple/NudgeKit/Sources/NudgeCore/AppGroupConfiguration.swift` | Create | App Group identifier 常數 |
| `apple/NudgeKit/Sources/NudgeCore/KeychainStorage.swift:11-16` | Modify | 加 `accessGroup` 參數 |
| `apple/NudgeKit/Sources/NudgeData/TaskRepository.swift` | Modify | 加 `WidgetRefreshing` protocol、各 mutation 後呼叫 |
| `apple/Nudge-iOS/NudgeiOSApp.swift` | Modify | KeychainStorage 加 access group、注入 WidgetRefreshing impl、擴充 onOpenURL |
| `src/messages/{zh-TW,ja,en}.json` | Modify | 新增 `widget.*` namespace |
| `apple/NudgeKit/Sources/NudgeUI/Resources/Localizable.xcstrings` | Modify | 鏡像 `widget.*` 三語 |

---

## Task 1: 在 Xcode UI 建立 NudgeWidget target + 設定 capabilities

**這是手動 Xcode UI 步驟**，無法純 CLI。完成後，Task 2 起才能進入 code 階段。

**Files:**
- Modify (Xcode UI): `apple/Nudge.xcodeproj`
- Create: `apple/Nudge-iOS/NudgeWidget/Info.plist`
- Create: `apple/Nudge-iOS/Nudge-iOS.entitlements`
- Create: `apple/Nudge-iOS/NudgeWidget/NudgeWidget.entitlements`

- [ ] **Step 1.1: 開 Xcode 專案**

```bash
open /Users/mike/Documents/nudge/apple/Nudge.xcodeproj
```

- [ ] **Step 1.2: 新增 Widget Extension target**

在 Xcode：
1. File → New → Target
2. 選 iOS → Widget Extension
3. Product Name: **`NudgeWidget`**
4. **取消勾選** "Include Live Activity" 和 "Include Configuration App Intent"（v1 不做配置）
5. Project: Nudge；Embed in Application: Nudge-iOS
6. Finish；不要 activate scheme（會自動加 scheme 即可）
7. Xcode 會建立 `apple/Nudge-iOS/NudgeWidget/` 含 Info.plist + 預設 NudgeWidget.swift + Assets.xcassets

預期：左側 navigator 看到新 target `NudgeWidget`、新 group `NudgeWidget`。

- [ ] **Step 1.3: 刪掉 Xcode 預設產生的範例檔案**

在 Xcode 的 NudgeWidget group 內，**刪除**（move to trash）：
- `NudgeWidget.swift`（預設範例）
- `NudgeWidget.intentdefinition`（如果有）

保留：
- `Assets.xcassets`
- `Info.plist`

- [ ] **Step 1.4: 加 App Group capability 給 Nudge-iOS target**

選 Nudge-iOS target → Signing & Capabilities → ＋ Capability → App Groups → 新增 `group.tw.nudge.app`

預期：產生 `apple/Nudge-iOS/Nudge-iOS.entitlements`，內容：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.application-groups</key>
    <array>
        <string>group.tw.nudge.app</string>
    </array>
    <key>keychain-access-groups</key>
    <array>
        <string>$(AppIdentifierPrefix)tw.nudge.app.shared</string>
    </array>
</dict>
</plist>
```

`keychain-access-groups` 那段，Xcode 預設會自動加 `$(AppIdentifierPrefix)tw.nudge.app`（單一 app 用），改成 `tw.nudge.app.shared`（給 widget 共用）。直接在 entitlements 檔手改。

- [ ] **Step 1.5: 同樣 capabilities 加給 NudgeWidget target**

選 NudgeWidget target → Signing & Capabilities → ＋ Capability → App Groups → 勾 `group.tw.nudge.app`（已存在，直接勾）

→ ＋ Capability → Keychain Sharing → Keychain Group: `tw.nudge.app.shared`

預期：產生 `apple/Nudge-iOS/NudgeWidget/NudgeWidget.entitlements`：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.application-groups</key>
    <array>
        <string>group.tw.nudge.app</string>
    </array>
    <key>keychain-access-groups</key>
    <array>
        <string>$(AppIdentifierPrefix)tw.nudge.app.shared</string>
    </array>
</dict>
</plist>
```

- [ ] **Step 1.6: 加 NudgeKit framework dependency 給 NudgeWidget target**

選 NudgeWidget target → General → Frameworks and Libraries → ＋ → 加 `NudgeCore`（NudgeKit 內的 library product）

注意：**不要加 NudgeUI 或 NudgeData**（widget extension memory 限制 ~30MB，不需 SwiftData / UI 全套）

- [ ] **Step 1.7: Build target 測試 capabilities 設定正確**

```bash
cd /Users/mike/Documents/nudge/apple && xcodebuild -project Nudge.xcodeproj -scheme Nudge-iOS -destination 'platform=iOS Simulator,id=CEB11490-5C95-4528-9125-B0BB7E02DC0D' build 2>&1 | tail -10
```

預期：`** BUILD SUCCEEDED **`。NudgeWidget 此時是空 target（無 widget），但 capabilities 設定要正確才能編。

如果 fail：常見問題是 entitlements 路徑沒被 Xcode 自動寫進 build settings — 在 target → Build Settings → Code Signing Entitlements 確認指向對應 .entitlements 檔。

---

## Task 2: 建立 App Group identifier 常數 + KeychainStorage 支援 access group

**Files:**
- Create: `apple/NudgeKit/Sources/NudgeCore/AppGroupConfiguration.swift`
- Modify: `apple/NudgeKit/Sources/NudgeCore/KeychainStorage.swift`

- [ ] **Step 2.1: 建立 AppGroupConfiguration.swift**

```swift
// apple/NudgeKit/Sources/NudgeCore/AppGroupConfiguration.swift
import Foundation

public enum AppGroupConfiguration {
    /// App Group identifier shared between Nudge-iOS app and NudgeWidget extension.
    /// Configured in both targets' entitlements.
    public static let identifier = "group.tw.nudge.app"

    /// Shared Keychain access group, prefixed with $(AppIdentifierPrefix) by the
    /// system at runtime (we just specify the suffix here and rely on the
    /// entitlements file to declare the full identifier).
    public static let keychainAccessGroup = "tw.nudge.app.shared"

    /// Shared container directory URL (App Group). nil if entitlement missing
    /// (which would only happen with a misconfigured build).
    public static var sharedContainerURL: URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: identifier)
    }

    /// File path inside the shared container where the widget snapshot lives.
    public static var snapshotFileURL: URL? {
        sharedContainerURL?.appendingPathComponent("widget-snapshot.json")
    }
}
```

- [ ] **Step 2.2: KeychainStorage 加 accessGroup 參數**

替換 `apple/NudgeKit/Sources/NudgeCore/KeychainStorage.swift` 的 `init` 與所有 query 建構：

```swift
import Foundation
import Security

public enum KeychainError: Error, Sendable {
    case unexpectedStatus(OSStatus)
    case dataConversion
}

public final class KeychainStorage: Sendable {
    private let service: String
    private let accessGroup: String?

    public init(service: String, accessGroup: String? = nil) {
        self.service = service
        self.accessGroup = accessGroup
    }

    private func baseQuery(key: String) -> [String: Any] {
        var q: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
        if let accessGroup {
            q[kSecAttrAccessGroup as String] = accessGroup
        }
        return q
    }

    public func set(_ value: String, for key: String) throws {
        guard let data = value.data(using: .utf8) else {
            throw KeychainError.dataConversion
        }
        let query = baseQuery(key: key)
        let updateAttrs: [String: Any] = [kSecValueData as String: data]
        let updateStatus = SecItemUpdate(query as CFDictionary, updateAttrs as CFDictionary)
        switch updateStatus {
        case errSecSuccess:
            return
        case errSecItemNotFound:
            break
        default:
            throw KeychainError.unexpectedStatus(updateStatus)
        }
        var addQuery = query
        addQuery[kSecValueData as String] = data
        addQuery[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        let addStatus = SecItemAdd(addQuery as CFDictionary, nil)
        guard addStatus == errSecSuccess else {
            throw KeychainError.unexpectedStatus(addStatus)
        }
    }

    public func get(for key: String) throws -> String? {
        var query = baseQuery(key: key)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var out: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &out)
        switch status {
        case errSecSuccess:
            guard let data = out as? Data,
                  let string = String(data: data, encoding: .utf8) else {
                throw KeychainError.dataConversion
            }
            return string
        case errSecItemNotFound:
            return nil
        default:
            throw KeychainError.unexpectedStatus(status)
        }
    }

    public func remove(for key: String) throws {
        let query = baseQuery(key: key)
        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw KeychainError.unexpectedStatus(status)
        }
    }
}
```

更新 doc comment 移除「不處理 access group」字樣。

- [ ] **Step 2.3: Build NudgeKit 確認沒破**

```bash
cd /Users/mike/Documents/nudge/apple && xcodebuild -project Nudge.xcodeproj -scheme Nudge-iOS -destination 'platform=iOS Simulator,id=CEB11490-5C95-4528-9125-B0BB7E02DC0D' build 2>&1 | tail -3
```

預期：`** BUILD SUCCEEDED **`。

---

## Task 3: WidgetSnapshot 模型 + WidgetSnapshotStore

**Files:**
- Create: `apple/NudgeKit/Sources/NudgeCore/WidgetSnapshot.swift`
- Create: `apple/NudgeKit/Sources/NudgeCore/WidgetSnapshotStore.swift`

- [ ] **Step 3.1: 建立 WidgetSnapshot.swift**

```swift
// apple/NudgeKit/Sources/NudgeCore/WidgetSnapshot.swift
import Foundation

/// Minimal data for the Today List widget. Stored as JSON in the App Group
/// container; read by both the App (writer) and the widget extension (reader).
public struct WidgetSnapshot: Codable, Sendable, Equatable {
    public let date: String           // YYYY-MM-DD, the day this snapshot represents
    public let generatedAt: Date
    public let tasks: [WidgetSnapshotTask]

    public init(date: String, generatedAt: Date, tasks: [WidgetSnapshotTask]) {
        self.date = date
        self.generatedAt = generatedAt
        self.tasks = tasks
    }
}

public struct WidgetSnapshotTask: Codable, Sendable, Equatable, Identifiable {
    public let assignmentId: String   // for ToggleTaskCompletionIntent
    public let taskId: String         // for nudge://task/<id> deep link
    public let title: String
    public let isCompleted: Bool
    public let isOverdue: Bool        // overdue items rendered with badge

    public var id: String { assignmentId }

    public init(assignmentId: String, taskId: String, title: String, isCompleted: Bool, isOverdue: Bool) {
        self.assignmentId = assignmentId
        self.taskId = taskId
        self.title = title
        self.isCompleted = isCompleted
        self.isOverdue = isOverdue
    }
}
```

- [ ] **Step 3.2: 建立 WidgetSnapshotStore.swift**

```swift
// apple/NudgeKit/Sources/NudgeCore/WidgetSnapshotStore.swift
import Foundation

/// Reads/writes the WidgetSnapshot JSON in the App Group container.
/// Public init takes no args; relies on AppGroupConfiguration.snapshotFileURL.
public final class WidgetSnapshotStore: Sendable {
    public init() {}

    /// Read the current snapshot from the shared container.
    /// Returns nil if file doesn't exist yet (first launch) or App Group missing.
    public func read() -> WidgetSnapshot? {
        guard let url = AppGroupConfiguration.snapshotFileURL,
              let data = try? Data(contentsOf: url) else {
            return nil
        }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try? decoder.decode(WidgetSnapshot.self, from: data)
    }

    /// Write a snapshot to the shared container. Atomic write.
    public func write(_ snapshot: WidgetSnapshot) throws {
        guard let url = AppGroupConfiguration.snapshotFileURL else {
            throw WidgetSnapshotError.appGroupContainerUnavailable
        }
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        let data = try encoder.encode(snapshot)
        try data.write(to: url, options: .atomic)
    }

    /// Remove snapshot (e.g. on logout).
    public func clear() {
        guard let url = AppGroupConfiguration.snapshotFileURL else { return }
        try? FileManager.default.removeItem(at: url)
    }
}

public enum WidgetSnapshotError: Error, Sendable {
    case appGroupContainerUnavailable
}

/// Build a snapshot from DailyDataDTO. Top 5 items, overdue first then today.
/// Pure function — does not touch FS/Keychain.
public func makeWidgetSnapshot(from data: DailyDataDTO, generatedAt: Date) -> WidgetSnapshot {
    let overdue = data.overdueTasks.map {
        WidgetSnapshotTask(
            assignmentId: $0.id,
            taskId: $0.taskId,
            title: $0.task.title,
            isCompleted: $0.isCompleted,
            isOverdue: true
        )
    }
    let today = data.assignments.map {
        WidgetSnapshotTask(
            assignmentId: $0.id,
            taskId: $0.taskId,
            title: $0.task.title,
            isCompleted: $0.isCompleted,
            isOverdue: false
        )
    }
    let combined = Array((overdue + today).prefix(5))
    return WidgetSnapshot(date: data.date, generatedAt: generatedAt, tasks: combined)
}
```

- [ ] **Step 3.3: Build 過**

```bash
cd /Users/mike/Documents/nudge/apple && xcodebuild -project Nudge.xcodeproj -scheme Nudge-iOS -destination 'platform=iOS Simulator,id=CEB11490-5C95-4528-9125-B0BB7E02DC0D' build 2>&1 | tail -3
```

預期：`** BUILD SUCCEEDED **`。

---

## Task 4: TaskRepository 加 WidgetRefreshing protocol + mutation hooks

**Files:**
- Modify: `apple/NudgeKit/Sources/NudgeData/TaskRepository.swift`

- [ ] **Step 4.1: 在檔案頂部加 protocol（匯入 WidgetKit-free 抽象）**

`apple/NudgeKit/Sources/NudgeData/TaskRepository.swift` 在 `@Observable` class 上方加：

```swift
/// Notify external widget surfaces about task changes. App passes in a real
/// implementation that writes the snapshot + reloads timelines.
/// NudgeData stays WidgetKit-free; the App owns the WidgetKit dependency.
public protocol WidgetRefreshing: Sendable {
    func refresh() async
}
```

- [ ] **Step 4.2: TaskRepository 接受 widgetRefresher、各 mutation 後呼叫**

修改 class 定義：

```swift
@Observable
@MainActor
public final class TaskRepository {
    private let client: APIClient
    private let container: ModelContainer
    private let widgetRefresher: WidgetRefreshing?

    public init(
        client: APIClient,
        container: ModelContainer,
        widgetRefresher: WidgetRefreshing? = nil
    ) {
        self.client = client
        self.container = container
        self.widgetRefresher = widgetRefresher
    }
    // ...
}
```

- [ ] **Step 4.3: 在每個 mutation method 結尾加 widget refresh 呼叫**

修改五個既有 method（`createTask` / `toggleComplete` / `archive` / `updateTitle` / `moveToDate` / `toggleSkip` / `reorder` — 共 7 個）。每個都在 `try await client.xxx(...)` 成功之後加：

```swift
        await widgetRefresher?.refresh()
```

範例：`toggleComplete` 變成：

```swift
public func toggleComplete(assignmentId: String, isCompleted: Bool, onDate: String) async throws {
    try await client.put("/api/daily/\(onDate)/assignments/\(assignmentId)/complete",
                         body: ["isCompleted": isCompleted])
    await widgetRefresher?.refresh()
}
```

`updateDescription` **不需要**呼叫（描述不顯示在 widget 上）。

- [ ] **Step 4.4: Build 過**

```bash
cd /Users/mike/Documents/nudge/apple && xcodebuild -project Nudge.xcodeproj -scheme Nudge-iOS -destination 'platform=iOS Simulator,id=CEB11490-5C95-4528-9125-B0BB7E02DC0D' build 2>&1 | tail -3
```

預期：`** BUILD SUCCEEDED **`。

---

## Task 5: i18n keys（Web + xcstrings）

**Files:**
- Modify: `src/messages/zh-TW.json` / `ja.json` / `en.json`
- Modify: `apple/NudgeKit/Sources/NudgeUI/Resources/Localizable.xcstrings`

- [ ] **Step 5.1: Web — 在三個 messages JSON 加 `widget` namespace**

在每個檔案的 root object 找一個合適位置（建議 `notes` 之後），加入：

`src/messages/zh-TW.json`：

```json
"widget": {
  "quickAdd": {
    "label": "新增任務",
    "iconLabel": "新增"
  },
  "todayList": {
    "title": "今日",
    "empty": "今日無任務 ・ ＋ 新增"
  },
  "kind": {
    "quickAdd": {
      "displayName": "快速新增任務",
      "description": "一鍵新增今日任務"
    },
    "todayList": {
      "displayName": "今日任務",
      "description": "顯示今日前 5 個任務"
    }
  }
},
```

`src/messages/ja.json`：

```json
"widget": {
  "quickAdd": {
    "label": "タスク追加",
    "iconLabel": "追加"
  },
  "todayList": {
    "title": "今日",
    "empty": "今日のタスクなし ・ ＋ 追加"
  },
  "kind": {
    "quickAdd": {
      "displayName": "クイック追加",
      "description": "ワンタップで今日のタスクを追加"
    },
    "todayList": {
      "displayName": "今日のタスク",
      "description": "今日のタスクを 5 件表示"
    }
  }
},
```

`src/messages/en.json`：

```json
"widget": {
  "quickAdd": {
    "label": "New task",
    "iconLabel": "Add"
  },
  "todayList": {
    "title": "Today",
    "empty": "No tasks today · + Add"
  },
  "kind": {
    "quickAdd": {
      "displayName": "Quick Add",
      "description": "Add a task in one tap"
    },
    "todayList": {
      "displayName": "Today's Tasks",
      "description": "Shows your top 5 tasks today"
    }
  }
},
```

驗證 JSON 合法：

```bash
for f in /Users/mike/Documents/nudge/src/messages/zh-TW.json /Users/mike/Documents/nudge/src/messages/ja.json /Users/mike/Documents/nudge/src/messages/en.json; do node -e "JSON.parse(require('fs').readFileSync('$f','utf8'))" && echo "$f OK"; done
```

預期：三行 OK。

- [ ] **Step 5.2: 鏡像到 xcstrings**

在 `apple/NudgeKit/Sources/NudgeUI/Resources/Localizable.xcstrings` 的 `strings` 物件內，新增 8 個 key（依現有格式）：

每個 key 結構（範例 `widget.quickAdd.label`）：

```json
"widget.quickAdd.label": {
  "localizations": {
    "en": { "stringUnit": { "state": "translated", "value": "New task" } },
    "ja": { "stringUnit": { "state": "translated", "value": "タスク追加" } },
    "zh-Hant": { "stringUnit": { "state": "translated", "value": "新增任務" } }
  }
},
```

要加入的 8 個 key：

| Key | en | ja | zh-Hant |
|-----|-----|-----|---------|
| `widget.quickAdd.label` | New task | タスク追加 | 新增任務 |
| `widget.quickAdd.iconLabel` | Add | 追加 | 新增 |
| `widget.todayList.title` | Today | 今日 | 今日 |
| `widget.todayList.empty` | No tasks today · + Add | 今日のタスクなし ・ ＋ 追加 | 今日無任務 ・ ＋ 新增 |
| `widget.kind.quickAdd.displayName` | Quick Add | クイック追加 | 快速新增任務 |
| `widget.kind.quickAdd.description` | Add a task in one tap | ワンタップで今日のタスクを追加 | 一鍵新增今日任務 |
| `widget.kind.todayList.displayName` | Today's Tasks | 今日のタスク | 今日任務 |
| `widget.kind.todayList.description` | Shows your top 5 tasks today | 今日のタスクを 5 件表示 | 顯示今日前 5 個任務 |

驗證：

```bash
node -e "JSON.parse(require('fs').readFileSync('/Users/mike/Documents/nudge/apple/NudgeKit/Sources/NudgeUI/Resources/Localizable.xcstrings','utf8'))" && echo OK
```

預期：`OK`。

---

## Task 6: Widget A — Quick Add（Small + Lock rectangular）

**Files:**
- Create: `apple/Nudge-iOS/NudgeWidget/QuickAddWidget.swift`

`accentColor` / 字色直接寫 hex（widget 不能用 NudgeUI Color extensions，因為 widget 不 import NudgeUI）。Hex 沿用 `globals.css` light theme tokens。

- [ ] **Step 6.1: 建立 QuickAddWidget.swift**

```swift
// apple/Nudge-iOS/NudgeWidget/QuickAddWidget.swift
import WidgetKit
import SwiftUI

struct QuickAddProvider: TimelineProvider {
    func placeholder(in context: Context) -> QuickAddEntry {
        QuickAddEntry(date: Date())
    }

    func getSnapshot(in context: Context, completion: @escaping (QuickAddEntry) -> Void) {
        completion(QuickAddEntry(date: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<QuickAddEntry>) -> Void) {
        // Static widget — no data, no refresh needed.
        completion(Timeline(entries: [QuickAddEntry(date: Date())], policy: .never))
    }
}

struct QuickAddEntry: TimelineEntry {
    let date: Date
}

struct QuickAddWidgetEntryView: View {
    let entry: QuickAddEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        switch family {
        case .systemSmall:
            smallView
        case .accessoryRectangular:
            lockRectangularView
        default:
            smallView
        }
    }

    private var smallView: some View {
        VStack(alignment: .leading, spacing: 0) {
            ZStack {
                Circle()
                    .fill(Color(red: 0.66, green: 0.48, blue: 0.27)) // #a87a45
                Text(verbatim: "＋")
                    .font(.system(size: 32, weight: .light))
                    .foregroundStyle(.white)
            }
            .frame(width: 56, height: 56)
            Spacer()
            VStack(alignment: .leading, spacing: 2) {
                Text("widget.quickAdd.label", bundle: .main)
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(Color(red: 0.11, green: 0.11, blue: 0.09)) // #1c1b18
                Text("widget.quickAdd.iconLabel", bundle: .main)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Color(red: 0.43, green: 0.41, blue: 0.33)) // #6e6855
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .containerBackground(Color(red: 0.94, green: 0.91, blue: 0.83), for: .widget) // #efe9d4
        .widgetURL(URL(string: "nudge://daily/new"))
    }

    private var lockRectangularView: some View {
        HStack(spacing: 10) {
            ZStack {
                Circle()
                    .fill(.primary)
                Text(verbatim: "＋")
                    .font(.system(size: 22, weight: .light))
                    .foregroundStyle(.background)
            }
            .frame(width: 32, height: 32)
            VStack(alignment: .leading, spacing: 2) {
                Text("widget.quickAdd.label", bundle: .main)
                    .font(.system(size: 14, weight: .semibold))
                Text(verbatim: "Nudge")
                    .font(.system(size: 11, weight: .medium))
                    .opacity(0.7)
            }
            Spacer(minLength: 0)
        }
        .containerBackground(.clear, for: .widget)
        .widgetURL(URL(string: "nudge://daily/new"))
    }
}

struct QuickAddWidget: Widget {
    let kind: String = "tw.nudge.app.QuickAddWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: QuickAddProvider()) { entry in
            QuickAddWidgetEntryView(entry: entry)
        }
        .configurationDisplayName(LocalizedStringResource("widget.kind.quickAdd.displayName"))
        .description(LocalizedStringResource("widget.kind.quickAdd.description"))
        .supportedFamilies([.systemSmall, .accessoryRectangular])
    }
}
```

注意：widget 內的 `Text("widget.xxx", bundle: .main)` 會走 widget extension 自己的 Localizable strings — Xcode 會自動把 main bundle 的 .lproj 拷到 widget bundle，**只要 NudgeWidget target 加入 Localizable.xcstrings 為 resource**。

- [ ] **Step 6.2: 把 xcstrings 加入 NudgeWidget target**

Xcode UI：選 `apple/NudgeKit/Sources/NudgeUI/Resources/Localizable.xcstrings` 檔案 → 右側 File Inspector → Target Membership → 勾 NudgeWidget。

或者，若該 xcstrings 是 NudgeKit SPM resource（不是 Xcode 直接管理），改用以下 fallback：
- 在 `apple/Nudge-iOS/NudgeWidget/` 建立自己的 `Localizable.xcstrings`，內容與 NudgeUI 那份的 `widget.*` keys 相同（直接複製貼上 8 個 key 的 entry）。
- 加入 NudgeWidget target 為 resource。

實作建議：採後者（建立 widget 專用 xcstrings），避免跨 target resource 共享的 build 問題。

- [ ] **Step 6.3: Build target**

```bash
cd /Users/mike/Documents/nudge/apple && xcodebuild -project Nudge.xcodeproj -scheme Nudge-iOS -destination 'platform=iOS Simulator,id=CEB11490-5C95-4528-9125-B0BB7E02DC0D' build 2>&1 | tail -5
```

預期：`** BUILD SUCCEEDED **`。

此時 NudgeWidgetBundle.swift 還沒建（會 build error 因為 widget extension 必須有 @main 入口）。Step 6.4 處理。

- [ ] **Step 6.4: 建立 NudgeWidgetBundle.swift（@main 入口）**

```swift
// apple/Nudge-iOS/NudgeWidget/NudgeWidgetBundle.swift
import WidgetKit
import SwiftUI

@main
struct NudgeWidgetBundle: WidgetBundle {
    var body: some Widget {
        QuickAddWidget()
        // TodayListWidget() — added in Task 7
    }
}
```

Build 過：

```bash
cd /Users/mike/Documents/nudge/apple && xcodebuild -project Nudge.xcodeproj -scheme Nudge-iOS -destination 'platform=iOS Simulator,id=CEB11490-5C95-4528-9125-B0BB7E02DC0D' build 2>&1 | tail -3
```

預期：`** BUILD SUCCEEDED **`。

---

## Task 7: Widget B — Today's 5 Medium + ToggleTaskCompletionIntent

**Files:**
- Create: `apple/Nudge-iOS/NudgeWidget/TodayListWidget.swift`
- Create: `apple/Nudge-iOS/NudgeWidget/ToggleTaskCompletionIntent.swift`
- Modify: `apple/Nudge-iOS/NudgeWidget/NudgeWidgetBundle.swift`

- [ ] **Step 7.1: 建立 ToggleTaskCompletionIntent.swift**

```swift
// apple/Nudge-iOS/NudgeWidget/ToggleTaskCompletionIntent.swift
import AppIntents
import WidgetKit
import NudgeCore

struct ToggleTaskCompletionIntent: AppIntent {
    static var title: LocalizedStringResource = "Toggle task completion"
    static var description = IntentDescription("Mark a task complete or incomplete from the widget.")

    @Parameter(title: "Assignment ID")
    var assignmentId: String

    @Parameter(title: "Date (YYYY-MM-DD)")
    var date: String

    @Parameter(title: "Mark as completed")
    var isCompleted: Bool

    init() {}

    init(assignmentId: String, date: String, isCompleted: Bool) {
        self.assignmentId = assignmentId
        self.date = date
        self.isCompleted = isCompleted
    }

    func perform() async throws -> some IntentResult {
        // Optimistic local update — flip the flag in the snapshot file
        // before hitting the network. Widget reloads from the new snapshot
        // immediately so the user sees the checkbox flip instantly.
        let store = WidgetSnapshotStore()
        if let snap = store.read() {
            let updated = WidgetSnapshot(
                date: snap.date,
                generatedAt: Date(),
                tasks: snap.tasks.map { task in
                    task.assignmentId == assignmentId
                        ? WidgetSnapshotTask(
                            assignmentId: task.assignmentId,
                            taskId: task.taskId,
                            title: task.title,
                            isCompleted: isCompleted,
                            isOverdue: task.isOverdue
                          )
                        : task
                }
            )
            try? store.write(updated)
            WidgetCenter.shared.reloadAllTimelines()
        }

        // Then hit the API. Token comes from shared Keychain.
        let keychain = KeychainStorage(
            service: "tw.nudge.app",
            accessGroup: AppGroupConfiguration.keychainAccessGroup
        )
        let tokenProvider: APIClient.TokenProvider = {
            try? keychain.get(for: "token")
        }
        let client = APIClient(configuration: .default, tokenProvider: tokenProvider)
        do {
            try await client.put(
                "/api/daily/\(date)/assignments/\(assignmentId)/complete",
                body: ["isCompleted": isCompleted]
            )
            // Server agreed. Snapshot is already updated; no further work.
        } catch {
            // Roll back on failure — write the original snapshot back.
            // On next App open the snapshot will get re-generated from API.
            if let snap = store.read() {
                let rolledBack = WidgetSnapshot(
                    date: snap.date,
                    generatedAt: Date(),
                    tasks: snap.tasks.map { task in
                        task.assignmentId == assignmentId
                            ? WidgetSnapshotTask(
                                assignmentId: task.assignmentId,
                                taskId: task.taskId,
                                title: task.title,
                                isCompleted: !isCompleted,
                                isOverdue: task.isOverdue
                              )
                            : task
                    }
                )
                try? store.write(rolledBack)
                WidgetCenter.shared.reloadAllTimelines()
            }
        }
        return .result()
    }
}
```

- [ ] **Step 7.2: 建立 TodayListWidget.swift**

```swift
// apple/Nudge-iOS/NudgeWidget/TodayListWidget.swift
import WidgetKit
import SwiftUI
import NudgeCore

struct TodayListProvider: TimelineProvider {
    private let store = WidgetSnapshotStore()

    func placeholder(in context: Context) -> TodayListEntry {
        TodayListEntry(
            date: Date(),
            snapshot: WidgetSnapshot(
                date: isoToday(),
                generatedAt: Date(),
                tasks: [
                    WidgetSnapshotTask(assignmentId: "a", taskId: "t", title: "—", isCompleted: false, isOverdue: false),
                ]
            )
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (TodayListEntry) -> Void) {
        let snap = store.read() ?? WidgetSnapshot(date: isoToday(), generatedAt: Date(), tasks: [])
        completion(TodayListEntry(date: Date(), snapshot: snap))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<TodayListEntry>) -> Void) {
        let snap = store.read() ?? WidgetSnapshot(date: isoToday(), generatedAt: Date(), tasks: [])
        let now = Date()
        let entry = TodayListEntry(date: now, snapshot: snap)
        // Schedule a refresh at midnight so the widget rolls over at day boundary.
        let cal = Calendar.current
        let tomorrow = cal.date(byAdding: .day, value: 1, to: cal.startOfDay(for: now)) ?? now
        completion(Timeline(entries: [entry], policy: .after(tomorrow)))
    }

    private func isoToday() -> String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.locale = Locale(identifier: "en_US_POSIX")
        return f.string(from: Date())
    }
}

struct TodayListEntry: TimelineEntry {
    let date: Date
    let snapshot: WidgetSnapshot
}

struct TodayListWidgetEntryView: View {
    let entry: TodayListEntry

    private var headerDateText: String {
        let f = DateFormatter()
        f.locale = Locale.current
        f.setLocalizedDateFormatFromTemplate("M/d EEE")
        if let d = isoDate(entry.snapshot.date) {
            return f.string(from: d)
        }
        return entry.snapshot.date
    }

    private var todayLabel: String {
        String(localized: "widget.todayList.title", bundle: .main)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .center, spacing: 0) {
                Text(verbatim: "\(headerDateText) · \(todayLabel)")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color(red: 0.43, green: 0.41, blue: 0.33))
                Spacer()
                Link(destination: URL(string: "nudge://daily/new")!) {
                    ZStack {
                        Circle()
                            .fill(Color(red: 0.66, green: 0.48, blue: 0.27))
                        Text(verbatim: "＋")
                            .font(.system(size: 18, weight: .regular))
                            .foregroundStyle(.white)
                    }
                    .frame(width: 30, height: 30)
                }
            }
            .padding(.bottom, 10)

            if entry.snapshot.tasks.isEmpty {
                VStack {
                    Spacer()
                    Text("widget.todayList.empty", bundle: .main)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(Color(red: 0.43, green: 0.41, blue: 0.33))
                    Spacer()
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                VStack(spacing: 6) {
                    ForEach(entry.snapshot.tasks.prefix(5)) { task in
                        TodayListRow(task: task, date: entry.snapshot.date)
                    }
                }
                Spacer(minLength: 0)
            }
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 14)
        .containerBackground(Color(red: 0.94, green: 0.91, blue: 0.83), for: .widget)
    }

    private func isoDate(_ s: String) -> Date? {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.locale = Locale(identifier: "en_US_POSIX")
        return f.date(from: s)
    }
}

struct TodayListRow: View {
    let task: WidgetSnapshotTask
    let date: String

    var body: some View {
        HStack(spacing: 9) {
            Button(intent: ToggleTaskCompletionIntent(
                assignmentId: task.assignmentId,
                date: date,
                isCompleted: !task.isCompleted
            )) {
                checkbox
            }
            .buttonStyle(.plain)

            Link(destination: URL(string: "nudge://task/\(task.taskId)")!) {
                HStack(spacing: 4) {
                    Text(verbatim: task.title)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(task.isCompleted
                            ? Color(red: 0.43, green: 0.41, blue: 0.33)
                            : Color(red: 0.11, green: 0.11, blue: 0.09))
                        .strikethrough(task.isCompleted)
                        .lineLimit(1)
                        .truncationMode(.tail)
                    if task.isOverdue {
                        Text(verbatim: "OVERDUE")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(Color(red: 0.77, green: 0.30, blue: 0.30))
                    }
                    Spacer(minLength: 0)
                }
            }
            .buttonStyle(.plain)
        }
    }

    @ViewBuilder
    private var checkbox: some View {
        if task.isCompleted {
            ZStack {
                Circle()
                    .fill(Color(red: 0.66, green: 0.48, blue: 0.27))
                Image(systemName: "checkmark")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(.white)
            }
            .frame(width: 18, height: 18)
        } else {
            Circle()
                .strokeBorder(Color(red: 0.43, green: 0.41, blue: 0.33), lineWidth: 1.5)
                .frame(width: 18, height: 18)
        }
    }
}

struct TodayListWidget: Widget {
    let kind: String = "tw.nudge.app.TodayListWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: TodayListProvider()) { entry in
            TodayListWidgetEntryView(entry: entry)
        }
        .configurationDisplayName(LocalizedStringResource("widget.kind.todayList.displayName"))
        .description(LocalizedStringResource("widget.kind.todayList.description"))
        .supportedFamilies([.systemMedium])
    }
}
```

- [ ] **Step 7.3: 註冊到 NudgeWidgetBundle**

把 `apple/Nudge-iOS/NudgeWidget/NudgeWidgetBundle.swift` 內被註解的那行打開：

```swift
@main
struct NudgeWidgetBundle: WidgetBundle {
    var body: some Widget {
        QuickAddWidget()
        TodayListWidget()
    }
}
```

- [ ] **Step 7.4: Build 過**

```bash
cd /Users/mike/Documents/nudge/apple && xcodebuild -project Nudge.xcodeproj -scheme Nudge-iOS -destination 'platform=iOS Simulator,id=CEB11490-5C95-4528-9125-B0BB7E02DC0D' build 2>&1 | tail -3
```

預期：`** BUILD SUCCEEDED **`。

---

## Task 8: App-side hookup（KeychainStorage 改 access group、注入 WidgetRefreshing、URL handler 擴充）

**Files:**
- Modify: `apple/Nudge-iOS/NudgeiOSApp.swift`

- [ ] **Step 8.1: 在檔案內加 WidgetRefresherImpl**

`apple/Nudge-iOS/NudgeiOSApp.swift` 在 `@main struct NudgeiOSApp: App {` **之外**加：

```swift
import WidgetKit

/// App-side implementation of WidgetRefreshing.
/// Lives in the App target (not NudgeData) to keep WidgetKit dependency out
/// of the shared frameworks.
private struct WidgetRefresherImpl: WidgetRefreshing {
    let auth: AuthRepository
    let taskRepo: TaskRepository
    let store = WidgetSnapshotStore()

    func refresh() async {
        let date = DateFormatters.isoDate(Date())
        do {
            let data = try await taskRepo.dailyData(date: date)
            let snap = makeWidgetSnapshot(from: data, generatedAt: Date())
            try store.write(snap)
            WidgetCenter.shared.reloadAllTimelines()
        } catch {
            print("[WidgetRefresher] failed: \(error)")
        }
    }
}
```

注意：這個 impl 持有 taskRepo 是 weak 引用會引循環，但這個 struct 是 value type、TaskRepository 是 reference type；TaskRepository 持有 widgetRefresher，widgetRefresher 持有 taskRepo — 確實會循環。改成傳 closure：

實際採用以下版本（避免循環）：

```swift
import WidgetKit

private struct WidgetRefresherImpl: WidgetRefreshing {
    let fetch: @Sendable () async throws -> DailyDataDTO

    func refresh() async {
        let store = WidgetSnapshotStore()
        do {
            let data = try await fetch()
            let snap = makeWidgetSnapshot(from: data, generatedAt: Date())
            try store.write(snap)
            WidgetCenter.shared.reloadAllTimelines()
        } catch {
            print("[WidgetRefresher] failed: \(error)")
        }
    }
}
```

- [ ] **Step 8.2: KeychainStorage 改 access group + 注入 WidgetRefreshing**

修改 `init()` 內：

```swift
// 原本
let keychain = KeychainStorage(service: "tw.nudge.app")
// 改成
let keychain = KeychainStorage(
    service: "tw.nudge.app",
    accessGroup: AppGroupConfiguration.keychainAccessGroup
)
```

修改 `taskRepo` 建構（順序：先建 taskRepo without refresher，再設 refresher 透過反向參考，避免循環）：

實際上 TaskRepository init 接受 widgetRefresher，但 refresher 需要 taskRepo 的 dailyData。解法：拆兩步——

```swift
// Build a temporary placeholder; we'll replace TaskRepository's widgetRefresher
// after construction by using a proxy that resolves taskRepo lazily.
// Simpler: capture the client in the closure directly.
let taskRepo = TaskRepository(
    client: client,
    container: container,
    widgetRefresher: WidgetRefresherImpl(
        fetch: { [client] in
            try await client.get("/api/daily/\(DateFormatters.isoDate(Date()))")
        }
    )
)
```

`fetch` closure 直接打 API，不繞 TaskRepository.dailyData（後者會更新 SwiftData cache，refresh 路徑不需要）。

- [ ] **Step 8.3: 擴充 onOpenURL handler**

找到 `.onOpenURL { url in ... }` 內現有 `_ = GIDSignIn.sharedInstance.handle(url)`，改成：

```swift
.onOpenURL { url in
    if GIDSignIn.sharedInstance.handle(url) {
        return
    }
    // Widget deep links
    if url.scheme == "nudge" {
        notificationRouter.handleWidgetURL(url)
    }
}
```

- [ ] **Step 8.4: 在 NotificationRouter 加 handleWidgetURL（或就近建立 router method）**

找 `apple/NudgeKit/Sources/NudgeUI/Notifications/NotificationRouter.swift`（或檔案位置）；加 method：

```swift
public func handleWidgetURL(_ url: URL) {
    // Reuse the same routing path as notifications when possible.
    // nudge://daily/new   → focus NewTask sheet
    // nudge://task/<id>   → open task edit
    guard url.scheme == "nudge" else { return }
    let host = url.host
    let path = url.pathComponents
    if host == "daily" && path.contains("new") {
        Task { @MainActor in
            self.pendingAction = .openNewTask
        }
    } else if host == "task", let id = path.last, !id.isEmpty {
        Task { @MainActor in
            self.pendingAction = .openTask(id: id)
        }
    }
}

public enum WidgetAction: Sendable {
    case openNewTask
    case openTask(id: String)
}
```

如果 NotificationRouter 沒有 `pendingAction` 機制：要加一個 `@Observable` property + DailyHostView 在 onChange 時消費並導頁。

**若 NotificationRouter 結構不適合塞 widget pendingAction**：建立獨立檔 `apple/NudgeKit/Sources/NudgeUI/WidgetURLRouter.swift` 作為 `@Observable @MainActor public final class`，含 `pendingAction: WidgetAction?` 欄位 + `handle(_ url: URL)` method（內容同上），在 `NudgeiOSApp.init()` 建立並當 `.environment` 注入到 `PlatformRootView`。DailyHostView 用 `@Environment(WidgetURLRouter.self)` 訂閱。Build 過後接 Step 8.6。

- [ ] **Step 8.5: Build 過**

```bash
cd /Users/mike/Documents/nudge/apple && xcodebuild -project Nudge.xcodeproj -scheme Nudge-iOS -destination 'platform=iOS Simulator,id=CEB11490-5C95-4528-9125-B0BB7E02DC0D' build 2>&1 | tail -10
```

預期：`** BUILD SUCCEEDED **`。

- [ ] **Step 8.6: 在 DailyHostView 訂閱 router action 並反應**

依 router shape，DailyHostView 需要一個 `.onChange(of: router.pendingAction)` 處理：
- `.openNewTask` → 觸發既有 NewTaskInputView focus / 開 QuickAddTaskSheet（看現有實作哪個是「focused 鍵盤已彈」）
- `.openTask(id)` → 開該 task 的 detail（同 tap row 的行為）

看現有 DailyHostView code 找到對應的 sheet/state 操作（如 `showNewTaskSheet = true` 之類），加上條件判斷。

預期：build 過、邏輯接通。

---

## Task 9: 實機測試（請使用者操作）

依 spec 測試計畫逐項勾。

- [ ] **Step 9.1: Install + relaunch sim**

```bash
xattr -cr /Users/mike/Documents/nudge/apple/build/Build/Products/Debug-iphonesimulator/Nudge-iOS.app && \
xcrun simctl uninstall CEB11490-5C95-4528-9125-B0BB7E02DC0D tw.nudge.app 2>/dev/null; \
xcrun simctl install CEB11490-5C95-4528-9125-B0BB7E02DC0D /Users/mike/Documents/nudge/apple/build/Build/Products/Debug-iphonesimulator/Nudge-iOS.app && \
xcrun simctl launch CEB11490-5C95-4528-9125-B0BB7E02DC0D tw.nudge.app
```

- [ ] **Step 9.2: Widget A — Quick Add 測試清單給使用者**

請使用者在 sim 上：

1. 長按 Home Screen 空白 → 點左上「＋」 → Search "Nudge"
2. 應出現兩個 widget：「快速新增任務」「今日任務」
3. 加「快速新增任務」Small → 看到「＋」+「新增任務」label
4. 點 widget → App 開到 Daily，鍵盤彈出，輸入框 focused
5. Lock Screen：Settings → Wallpaper → Customize Lock Screen → 加 widget → 選 Nudge Quick Add
6. 解鎖前點 widget → 解鎖後直達 NewTask focused

- [ ] **Step 9.3: Widget B — Today's 5 測試清單**

1. 加「今日任務」Medium → 應顯示今日前 5 任務（先讓 App 內有 5+ 個任務）
2. 點圓圈勾完成 → 圓圈瞬間變勾、不開 App、灰底刪除線立即反映
3. 切回 App 看 Daily：該 task 也已完成
4. 點任務文字 → App 開到該 task 編輯 sheet（不是 Today 列表）
5. 點右上「＋」→ NewTask focused
6. 從 App 內勾完成另一 task → widget < 5 秒內反映
7. 任務 = 0：widget 顯示 empty fallback「今日無任務 ・ ＋ 新增」
8. 切日（隔日 00:00 過後 / sim 設定 → Date 推進）：widget 自動換到新一天

- [ ] **Step 9.4: i18n / 排版測試**

1. 切到日文 → 兩個 widget 文字變化正確、CJK 不爆 layout
2. 切到英文 → 同上
3. 在 App 內建立含長任務名稱的 task（>30 字）→ widget 顯示 truncate 正確、不破 layout

- [ ] **Step 9.5: 等使用者回報**

OK → Task 10。有問題 → 修對應 task 重做。

---

## Task 10: 分區 commit

依 commit 主題分組，commit message 主旨+body 用繁體中文。

- [ ] **Step 10.1: Commit plan doc + i18n**

```bash
cd /Users/mike/Documents/nudge && git add \
  docs/superpowers/plans/2026-04-27-ios-widget-v1.md \
  src/messages/zh-TW.json \
  src/messages/ja.json \
  src/messages/en.json \
  apple/NudgeKit/Sources/NudgeUI/Resources/Localizable.xcstrings \
  apple/Nudge-iOS/NudgeWidget/Localizable.xcstrings \
  && git commit -m "$(cat <<'EOF'
i18n(widget): 新增 widget.* keys 三語

對應 iOS Widget v1：Quick Add + Today's 5 兩個 widget 的 label / display name / description / empty state，三邊 (zh-Hant / ja / en) 同步加到 Web messages 與 iOS xcstrings。

EOF
)"
```

- [ ] **Step 10.2: Commit shared infra（NudgeCore + KeychainStorage + TaskRepository hook）**

```bash
git add \
  apple/NudgeKit/Sources/NudgeCore/AppGroupConfiguration.swift \
  apple/NudgeKit/Sources/NudgeCore/WidgetSnapshot.swift \
  apple/NudgeKit/Sources/NudgeCore/WidgetSnapshotStore.swift \
  apple/NudgeKit/Sources/NudgeCore/KeychainStorage.swift \
  apple/NudgeKit/Sources/NudgeData/TaskRepository.swift \
  && git commit -m "$(cat <<'EOF'
feat(apple/widget): App Group + snapshot infra

- AppGroupConfiguration：App Group identifier 與 shared keychain access group 常數
- WidgetSnapshot / WidgetSnapshotStore：widget 用的最小 JSON 模型 + App Group container 讀寫
- makeWidgetSnapshot：DailyDataDTO → snapshot（overdue 在前、今日在後、取前 5）
- KeychainStorage：加 accessGroup 參數讓 widget extension 共享 token
- TaskRepository：加 WidgetRefreshing protocol、各 mutation 後呼叫 refresh()
  （NudgeData 不 import WidgetKit；refresher impl 由 App 注入）

EOF
)"
```

- [ ] **Step 10.3: Commit widget extension target**

```bash
git add \
  apple/Nudge-iOS/NudgeWidget/ \
  apple/Nudge-iOS/Nudge-iOS.entitlements \
  apple/Nudge.xcodeproj \
  && git commit -m "$(cat <<'EOF'
feat(apple/widget): NudgeWidget extension target + Quick Add + Today's 5

新增 NudgeWidget Widget Extension target：
- QuickAddWidget：Small + Lock Screen rectangular。純按鈕、不顯示資料、永不 stale
  tap → nudge://daily/new → App 開到 NewTask focused
- TodayListWidget：Medium，顯示今日 + overdue 前 5 任務（Daily 同步排序）
  圓圈 → ToggleTaskCompletionIntent（App Intent，不開 App、樂觀更新）
  任務文字 → nudge://task/<id> 深連結到該 task 編輯 sheet
  「＋」→ nudge://daily/new
  TimelineProvider 在隔日 00:00 安排換日 reload
- ToggleTaskCompletionIntent：先樂觀更新 snapshot.json + reloadTimelines，再打 API；失敗 rollback
- App Group group.tw.nudge.app 共享 snapshot + Keychain access group 共享 token

色彩 hex 直接寫（widget 不能 import NudgeUI Color extensions），對齊 light theme tokens。

EOF
)"
```

- [ ] **Step 10.4: Commit App-side hookup**

```bash
git add apple/Nudge-iOS/NudgeiOSApp.swift apple/NudgeKit/Sources/NudgeUI/Notifications/NotificationRouter.swift apple/NudgeKit/Sources/NudgeUI/Daily/DailyHostView.swift && \
git commit -m "$(cat <<'EOF'
feat(apple/widget): App-side hookup — KeychainStorage access group + WidgetRefresher 注入 + onOpenURL 擴充

- KeychainStorage 建構傳入 AppGroupConfiguration.keychainAccessGroup（widget 共用 token）
- WidgetRefresherImpl 注入 TaskRepository：mutation 後重新 fetch dailyData → 寫 snapshot.json + reloadTimelines
- onOpenURL 擴充處理 nudge://daily/new + nudge://task/<id> 兩條深連結
- NotificationRouter / DailyHostView 反應 widget action

EOF
)"
```

- [ ] **Step 10.5: 最後 status 確認**

```bash
git status && git log --oneline -8
```

預期：`nothing to commit, working tree clean` + 看到 4 個新 commits（Task 10.1-10.4）+ spec commit。

---

## Self-Review

**Spec coverage check：**
- §Widget A → Task 6 ✓
- §Widget B → Task 7 ✓
- §iOS 17.0 minimum → 內含於 widget code 使用 `Button(intent:)` API ✓
- §資料流 + Snapshot schema → Task 3 (model + store) + Task 4 (repo hook) + Task 8 (App-side impl) ✓
- §TimelineProvider 換日 → Task 7 (TodayListProvider getTimeline `policy: .after(tomorrow)`) ✓
- §Deep-link → Task 6 / 7 (widgetURL / Link) + Task 8 (onOpenURL handler) ✓
- §i18n + 排版 → Task 5 + Task 9.4 排版實測 ✓
- §工程影響面（target、entitlements、keychain shared、tasks 排序、URL scheme）→ Task 1 / 2 / 8 ✓
  - URL scheme：spec 說「需新增獨立 scheme」但實際既有 Info.plist 已註冊 `nudge` scheme → plan 不需重註冊
- §不在 v1 範圍 → plan 都沒做 ✓
- §測試計畫 → Task 9 ✓

**Placeholder scan：**
- Step 8.4 結尾有「實作細節留執行階段確認」— 這是 plan failure。修：刪掉 fallback 字句、明確指示「若 NotificationRouter 沒有 pendingAction，建立新檔 `apple/Nudge-iOS/WidgetURLRouter.swift` 為 `@Observable class`，注入給 DailyHostView」。
- Step 6.2 有兩個方案（Xcode UI vs 自建 xcstrings）— 已標明採後者，OK。

**Type consistency：**
- `WidgetSnapshotTask` 的欄位 (`assignmentId`, `taskId`, `title`, `isCompleted`, `isOverdue`) 在 Task 3 / 7（intent + row）使用一致 ✓
- `WidgetSnapshotStore.read()/write()` signature 一致 ✓
- `WidgetRefreshing.refresh()` async signature 在 protocol、impl、TaskRepository 呼叫處一致 ✓

修 Step 8.4 的 placeholder 後，plan 完成。

# Swift Phase 2：行動（每日任務）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** iOS + macOS 實作 Web `/day/[date]` 完整每日任務功能——週曆 bar、Google Calendar 事件、overdue 區、任務 list（含新增 / 完成 / 拖曳 / swipe / 右鍵 / detail view）、移到其他日期、離線 banner、design tokens、i18n。

**Architecture:** 沿用 Phase 1 分層（`NudgeCore` / `NudgeData` / `NudgeUI` + 兩 target）。資料 cache first + 寫入走 server；SwiftUI 共用 view 盡量多、platform 分歧用 `#if os` 或外層 host view 拆。Design tokens 和 i18n 以 Web 為 source of truth。

**Tech Stack:** Swift 6、SwiftUI、SwiftData、Swift Testing、`@Observable`、String Catalog、Asset Catalog。

**Parent Spec:** `docs/superpowers/specs/2026-04-17-swift-phase2-daily-tasks-design.md`

---

## Scope 限制

- 本 plan 只實作 Phase 2。Phase 3（notes）/ Phase 4（cards）是獨立 plan。
- 完成標準：iOS + macOS 兩端都能走過 spec 裡的 16 項手動驗收 checklist。
- 不做：status UI、離線寫入 queue、推播、widget、tag CRUD。

## File Structure

**Design tokens + i18n（Phase 2 新加）**
- Create: `apple/NudgeKit/Sources/NudgeUI/Resources/Assets.xcassets/*.colorset` — 16 個 color tokens，每個含 Any + Dark 兩組 hex
- Create: `apple/NudgeKit/Sources/NudgeUI/Tokens/Color+Nudge.swift` — extension Color token API
- Create: `apple/NudgeKit/Sources/NudgeCore/Resources/Localizable.xcstrings` — i18n key table（ja / en / zh-Hant）
- Modify: `apple/NudgeKit/Package.swift` — declare resources on NudgeUI + NudgeCore targets

**DTOs（NudgeCore）**
- Create: `apple/NudgeKit/Sources/NudgeCore/TaskDTO.swift`
- Create: `apple/NudgeKit/Sources/NudgeCore/DailyDataDTO.swift`
- Create: `apple/NudgeKit/Sources/NudgeCore/WeekSummaryDTO.swift`
- Create: `apple/NudgeKit/Sources/NudgeCore/CalendarDTO.swift`
- Create: `apple/NudgeKit/Sources/NudgeCore/TagDTO.swift`

**Repositories（NudgeCore）**
- Create: `apple/NudgeKit/Sources/NudgeCore/TaskRepository.swift`
- Create: `apple/NudgeKit/Sources/NudgeCore/TagRepository.swift`
- Create: `apple/NudgeKit/Sources/NudgeCore/CalendarRepository.swift`

**Date utilities（NudgeCore）**
- Create: `apple/NudgeKit/Sources/NudgeCore/DateFormatters.swift`

**SwiftData models（NudgeData）**
- Create: `apple/NudgeKit/Sources/NudgeData/TaskItem+Model.swift`
- Create: `apple/NudgeKit/Sources/NudgeData/DailyAssignment+Model.swift`
- Modify: `apple/NudgeKit/Sources/NudgeData/NudgeModelContainer.swift` — 把 `Schema([])` 改成含上述兩個 Model

**APIClient 改造（NudgeCore）**
- Modify: `apple/NudgeKit/Sources/NudgeCore/APIClient.swift` — 加 mutable unauthorizedHandler setter
- Modify: `apple/Nudge-iOS/NudgeiOSApp.swift` — 接 handler 到 AuthRepository
- Modify: `apple/Nudge-macOS/NudgeMacApp.swift` — 同上

**UI views（NudgeUI/Daily/）**
- Create: `apple/NudgeKit/Sources/NudgeUI/Daily/DailyHostView.swift`
- Create: `apple/NudgeKit/Sources/NudgeUI/Daily/WeekStripView.swift`
- Create: `apple/NudgeKit/Sources/NudgeUI/Daily/CalendarSectionView.swift`
- Create: `apple/NudgeKit/Sources/NudgeUI/Daily/OverdueSectionView.swift`
- Create: `apple/NudgeKit/Sources/NudgeUI/Daily/TaskListView.swift`
- Create: `apple/NudgeKit/Sources/NudgeUI/Daily/TaskRowView.swift`
- Create: `apple/NudgeKit/Sources/NudgeUI/Daily/TaskDetailView.swift`
- Create: `apple/NudgeKit/Sources/NudgeUI/Daily/NewTaskInputView.swift`
- Create: `apple/NudgeKit/Sources/NudgeUI/Daily/MoveToDatePickerView.swift`
- Create: `apple/NudgeKit/Sources/NudgeUI/Daily/OfflineBannerView.swift`
- Modify: `apple/NudgeKit/Sources/NudgeUI/SettingsView.swift` — 從 PlatformRootView 移出成獨立檔，加 Google Calendar 連結
- Modify: `apple/NudgeKit/Sources/NudgeUI/PlatformRootView.swift` — 把「行動」tab placeholder 換成 `DailyHostView`，sidebar item 重命名 tasks

**Platform target 檔案**
- Modify: `apple/Nudge-iOS/NudgeiOSApp.swift` — env inject repositories
- Modify: `apple/Nudge-macOS/NudgeMacApp.swift` — 同上
- Create: `apple/Nudge-macOS/Commands+macOS.swift` — `.commands` block 含 ⌘N、⌘→←、⌘T、⌥↑↓、⌘⌫、Space

**Web side（補新 i18n key）**
- Modify: `src/messages/zh-TW.json`、`src/messages/en.json`、`src/messages/ja.json` — 加 Phase 2 特有但 Web 尚無的 key（例：`offline.banner`、`daily.tasks.newPlaceholder`）

**Tests**
- Create: `apple/NudgeKit/Tests/NudgeCoreTests/Phase2/DateFormattersTests.swift`
- Create: `apple/NudgeKit/Tests/NudgeCoreTests/Phase2/DTOTests.swift`
- Create: `apple/NudgeKit/Tests/NudgeCoreTests/Phase2/TaskRepositoryTests.swift`
- Create: `apple/NudgeKit/Tests/NudgeCoreTests/Phase2/TagRepositoryTests.swift`
- Create: `apple/NudgeKit/Tests/NudgeCoreTests/Phase2/CalendarRepositoryTests.swift`

---

# Block A：Infrastructure（tokens + i18n + date utils）

### Task 1: Web 側 messages 補 Phase 2 缺的 key

**Files:**
- Modify: `src/messages/zh-TW.json`、`src/messages/en.json`、`src/messages/ja.json`

**說明**：Phase 2 需要的文案裡，有些 Web 還沒有 key（例離線 banner、新任務 placeholder）。先加到 Web 三個 JSON，讓 `.xcstrings` 之後能 mirror。

- [ ] **Step 1: 確認缺的 key 清單**

Web 目前沒有的 key（Phase 2 要加）：
- `offline.banner` — "離線中。上次更新於 {time}" / "Offline. Last updated at {time}." / "オフライン。最終更新: {time}"
- `daily.tasks.newPlaceholder` — "新增任務" / "New task" / "新しいタスク"
- `daily.tasks.overdueSection` — "過期" / "Overdue" / "期限切れ"
- `daily.tasks.detailArchive` — "封存" / "Archive" / "アーカイブ"
- `daily.tasks.detailMoveTo` — "移到其他日期" / "Move to another date" / "別の日付に移動"
- `daily.tasks.swipeArchive` — "封存" / "Archive" / "アーカイブ"
- `daily.tasks.swipeMove` — "移動" / "Move" / "移動"
- `error.network` — "網路錯誤" / "Network error" / "ネットワークエラー"
- `error.unauthorized` — "請重新登入" / "Please sign in again" / "再度サインインしてください"
- `error.unknown` — "發生錯誤" / "Something went wrong" / "エラーが発生しました"

- [ ] **Step 2: 把 key 加到 `src/messages/zh-TW.json`**

找到 `"daily": { "tasks": { ... } }` section，在裡面加新 key：
```json
"newPlaceholder": "新增任務",
"overdueSection": "過期",
"detailArchive": "封存",
"detailMoveTo": "移到其他日期",
"swipeArchive": "封存",
"swipeMove": "移動"
```

在 root 加新 section：
```json
"offline": {
  "banner": "離線中。上次更新於 {time}"
},
"error": {
  "network": "網路錯誤",
  "unauthorized": "請重新登入",
  "unknown": "發生錯誤"
}
```

- [ ] **Step 3: 同步到 `src/messages/en.json`**

同樣 key 路徑，英文翻譯：
```json
"daily.tasks.newPlaceholder": "New task",
"daily.tasks.overdueSection": "Overdue",
"daily.tasks.detailArchive": "Archive",
"daily.tasks.detailMoveTo": "Move to another date",
"daily.tasks.swipeArchive": "Archive",
"daily.tasks.swipeMove": "Move",
"offline.banner": "Offline. Last updated at {time}.",
"error.network": "Network error",
"error.unauthorized": "Please sign in again",
"error.unknown": "Something went wrong"
```

（放到對應的 nested dict；參照 Web 現有格式）

- [ ] **Step 4: 同步到 `src/messages/ja.json`**

日文：
```json
"daily.tasks.newPlaceholder": "新しいタスク",
"daily.tasks.overdueSection": "期限切れ",
"daily.tasks.detailArchive": "アーカイブ",
"daily.tasks.detailMoveTo": "別の日付に移動",
"daily.tasks.swipeArchive": "アーカイブ",
"daily.tasks.swipeMove": "移動",
"offline.banner": "オフライン。最終更新: {time}",
"error.network": "ネットワークエラー",
"error.unauthorized": "再度サインインしてください",
"error.unknown": "エラーが発生しました"
```

- [ ] **Step 5: 驗 Web 能 build**

Run:
```bash
cd /Users/mike/Documents/nudge
npx next build 2>&1 | tail -20
```
Expected: build succeeded（即使沒使用這些 key，next-intl 允許未使用 key）。

- [ ] **Step 6: Commit**

```bash
cd /Users/mike/Documents/nudge
git add src/messages/
git commit -m "$(cat <<'EOF'
i18n: add phase 2 keys for offline, error, daily.tasks details

These keys are consumed by the Swift app (Phase 2); Web side may add UI
to use them later. Added to all three locales (zh-Hant/en/ja).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Design token Asset Catalog

**Files:**
- Create: `apple/NudgeKit/Sources/NudgeUI/Resources/Assets.xcassets/Contents.json`
- Create: `apple/NudgeKit/Sources/NudgeUI/Resources/Assets.xcassets/nudge.background.colorset/Contents.json`
- （含下列 16 個 colorset）

16 個 color tokens（對齊 `src/app/globals.css`）：

| Token | Light hex | Dark hex |
|---|---|---|
| nudge.background | #efe9d4 | #1c1b18 |
| nudge.foreground | #1c1b18 | #ebe5d4 |
| nudge.primary | #a87a45 | #c89968 |
| nudge.primaryForeground | #efe9d4 | #1c1b18 |
| nudge.border | #c8c0a0 | #3a3833 |
| nudge.borderLight | #b5ac8a | #4a4740 |
| nudge.textDim | #6e6855 | #9b9485 |
| nudge.chart1 | #5a6b7c | #7a8b9c |
| nudge.chart2 | #a87a45 | #c89968 |
| nudge.chart3 | #5a7050 | #8aa57d |
| nudge.chart4 | #8a6d92 | #a78aaf |
| nudge.chart5 | #9a4f3f | #b56b5a |
| nudge.statusInbox | #7a7060 | #9b9080 |
| nudge.statusBacklog | #5a6b7c | #7a8b9c |
| nudge.statusInProgress | #a87a45 | #c89968 |
| nudge.statusWaiting | #8a6d92 | #a78aaf |
| nudge.statusDone | #5a7050 | #8aa57d |
| nudge.statusArchived | #7a7466 | (查 globals.css) |

（最後一個 dark hex 要從 globals.css 讀出來確認；可能 Web 尚無；若無用 `#7a7466` 套 dark）

- [ ] **Step 1: 建立 Assets.xcassets 主目錄**

Create `apple/NudgeKit/Sources/NudgeUI/Resources/Assets.xcassets/Contents.json`:
```json
{
  "info" : {
    "author" : "xcode",
    "version" : 1
  }
}
```

- [ ] **Step 2: 腳本生成 16 個 colorset**

寫一個 shell 腳本暫存於 /tmp 產生所有 colorset（Contents.json 的 schema 是 Apple 文件化的）：

```bash
cat > /tmp/make-colorset.sh <<'EOF'
#!/bin/bash
# Usage: make-colorset.sh <name> <light_hex> <dark_hex>
# <light_hex> / <dark_hex> format: "efe9d4" (no #)
NAME=$1
LIGHT=$2
DARK=$3
BASE=/Users/mike/Documents/nudge/apple/NudgeKit/Sources/NudgeUI/Resources/Assets.xcassets
DIR="$BASE/$NAME.colorset"
mkdir -p "$DIR"

# Parse hex
LR=$(printf '%d' 0x${LIGHT:0:2})
LG=$(printf '%d' 0x${LIGHT:2:2})
LB=$(printf '%d' 0x${LIGHT:4:2})
DR=$(printf '%d' 0x${DARK:0:2})
DG=$(printf '%d' 0x${DARK:2:2})
DB=$(printf '%d' 0x${DARK:4:2})

cat > "$DIR/Contents.json" <<JSON
{
  "colors" : [
    {
      "color" : {
        "color-space" : "srgb",
        "components" : {
          "alpha" : "1.000",
          "blue" : "0x$(printf '%02X' $LB)",
          "green" : "0x$(printf '%02X' $LG)",
          "red" : "0x$(printf '%02X' $LR)"
        }
      },
      "idiom" : "universal"
    },
    {
      "appearances" : [
        {
          "appearance" : "luminosity",
          "value" : "dark"
        }
      ],
      "color" : {
        "color-space" : "srgb",
        "components" : {
          "alpha" : "1.000",
          "blue" : "0x$(printf '%02X' $DB)",
          "green" : "0x$(printf '%02X' $DG)",
          "red" : "0x$(printf '%02X' $DR)"
        }
      },
      "idiom" : "universal"
    }
  ],
  "info" : {
    "author" : "xcode",
    "version" : 1
  }
}
JSON
EOF
chmod +x /tmp/make-colorset.sh
```

- [ ] **Step 3: 跑腳本建所有 colorset**

```bash
/tmp/make-colorset.sh nudge.background efe9d4 1c1b18
/tmp/make-colorset.sh nudge.foreground 1c1b18 ebe5d4
/tmp/make-colorset.sh nudge.primary a87a45 c89968
/tmp/make-colorset.sh nudge.primaryForeground efe9d4 1c1b18
/tmp/make-colorset.sh nudge.border c8c0a0 3a3833
/tmp/make-colorset.sh nudge.borderLight b5ac8a 4a4740
/tmp/make-colorset.sh nudge.textDim 6e6855 9b9485
/tmp/make-colorset.sh nudge.chart1 5a6b7c 7a8b9c
/tmp/make-colorset.sh nudge.chart2 a87a45 c89968
/tmp/make-colorset.sh nudge.chart3 5a7050 8aa57d
/tmp/make-colorset.sh nudge.chart4 8a6d92 a78aaf
/tmp/make-colorset.sh nudge.chart5 9a4f3f b56b5a
/tmp/make-colorset.sh nudge.statusInbox 7a7060 9b9080
/tmp/make-colorset.sh nudge.statusBacklog 5a6b7c 7a8b9c
/tmp/make-colorset.sh nudge.statusInProgress a87a45 c89968
/tmp/make-colorset.sh nudge.statusWaiting 8a6d92 a78aaf
/tmp/make-colorset.sh nudge.statusDone 5a7050 8aa57d
/tmp/make-colorset.sh nudge.statusArchived 7a7466 7a7466
```

- [ ] **Step 4: 改 Package.swift 加 resources**

Edit `apple/NudgeKit/Package.swift`，把 `NudgeUI` target 改成：

```swift
.target(
    name: "NudgeUI",
    dependencies: ["NudgeCore", "NudgeData"],
    resources: [
        .process("Resources/Assets.xcassets")
    ]
),
```

- [ ] **Step 5: Build 驗 Package 有吃到 resources**

Run:
```bash
cd /Users/mike/Documents/nudge/apple/NudgeKit
swift build
```
Expected: Build complete，no asset-related error。

- [ ] **Step 6: Commit**

```bash
cd /Users/mike/Documents/nudge
git add apple/NudgeKit/Sources/NudgeUI/Resources/Assets.xcassets/ apple/NudgeKit/Package.swift
git commit -m "$(cat <<'EOF'
feat(ui): Asset Catalog color tokens mirroring globals.css

16 semantic tokens with Any + Dark appearance variants. Hex values
copied verbatim from src/app/globals.css (:root and .dark).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Color+Nudge 型別安全 API

**Files:**
- Create: `apple/NudgeKit/Sources/NudgeUI/Tokens/Color+Nudge.swift`

- [ ] **Step 1: 寫 Color+Nudge extension**

Create `apple/NudgeKit/Sources/NudgeUI/Tokens/Color+Nudge.swift`:
```swift
import SwiftUI

public extension Color {
    static let nudgeBackground = Color("nudge.background", bundle: .module)
    static let nudgeForeground = Color("nudge.foreground", bundle: .module)
    static let nudgePrimary = Color("nudge.primary", bundle: .module)
    static let nudgePrimaryForeground = Color("nudge.primaryForeground", bundle: .module)
    static let nudgeBorder = Color("nudge.border", bundle: .module)
    static let nudgeBorderLight = Color("nudge.borderLight", bundle: .module)
    static let nudgeTextDim = Color("nudge.textDim", bundle: .module)
    static let nudgeChart1 = Color("nudge.chart1", bundle: .module)
    static let nudgeChart2 = Color("nudge.chart2", bundle: .module)
    static let nudgeChart3 = Color("nudge.chart3", bundle: .module)
    static let nudgeChart4 = Color("nudge.chart4", bundle: .module)
    static let nudgeChart5 = Color("nudge.chart5", bundle: .module)
    static let nudgeStatusInbox = Color("nudge.statusInbox", bundle: .module)
    static let nudgeStatusBacklog = Color("nudge.statusBacklog", bundle: .module)
    static let nudgeStatusInProgress = Color("nudge.statusInProgress", bundle: .module)
    static let nudgeStatusWaiting = Color("nudge.statusWaiting", bundle: .module)
    static let nudgeStatusDone = Color("nudge.statusDone", bundle: .module)
    static let nudgeStatusArchived = Color("nudge.statusArchived", bundle: .module)
}
```

- [ ] **Step 2: Build 驗 compile**

```bash
cd /Users/mike/Documents/nudge/apple/NudgeKit
swift build
```
Expected: Build complete.

- [ ] **Step 3: Commit**

```bash
cd /Users/mike/Documents/nudge
git add apple/NudgeKit/Sources/NudgeUI/Tokens/Color+Nudge.swift
git commit -m "$(cat <<'EOF'
feat(ui): Color+Nudge type-safe token API

All new UI code must use Color.nudgeXxx; never .blue/.gray/etc.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Localizable.xcstrings

**Files:**
- Create: `apple/NudgeKit/Sources/NudgeCore/Resources/Localizable.xcstrings`
- Modify: `apple/NudgeKit/Package.swift` — 加 NudgeCore resources

- [ ] **Step 1: 建 xcstrings 檔**

Create `apple/NudgeKit/Sources/NudgeCore/Resources/Localizable.xcstrings`:
```json
{
  "sourceLanguage" : "zh-Hant",
  "strings" : {
    "nav.tasks" : {
      "localizations" : {
        "zh-Hant" : { "stringUnit" : { "state" : "translated", "value" : "行動" } },
        "en" : { "stringUnit" : { "state" : "translated", "value" : "Tasks" } },
        "ja" : { "stringUnit" : { "state" : "translated", "value" : "アクション" } }
      }
    },
    "nav.notes" : {
      "localizations" : {
        "zh-Hant" : { "stringUnit" : { "state" : "translated", "value" : "日誌" } },
        "en" : { "stringUnit" : { "state" : "translated", "value" : "Notes" } },
        "ja" : { "stringUnit" : { "state" : "translated", "value" : "ジャーナル" } }
      }
    },
    "nav.cards" : {
      "localizations" : {
        "zh-Hant" : { "stringUnit" : { "state" : "translated", "value" : "卡片" } },
        "en" : { "stringUnit" : { "state" : "translated", "value" : "Cards" } },
        "ja" : { "stringUnit" : { "state" : "translated", "value" : "カード" } }
      }
    },
    "nav.settings" : {
      "localizations" : {
        "zh-Hant" : { "stringUnit" : { "state" : "translated", "value" : "設定" } },
        "en" : { "stringUnit" : { "state" : "translated", "value" : "Settings" } },
        "ja" : { "stringUnit" : { "state" : "translated", "value" : "設定" } }
      }
    },
    "common.today" : {
      "localizations" : {
        "zh-Hant" : { "stringUnit" : { "state" : "translated", "value" : "今天" } },
        "en" : { "stringUnit" : { "state" : "translated", "value" : "Today" } },
        "ja" : { "stringUnit" : { "state" : "translated", "value" : "今日" } }
      }
    },
    "common.cancel" : {
      "localizations" : {
        "zh-Hant" : { "stringUnit" : { "state" : "translated", "value" : "取消" } },
        "en" : { "stringUnit" : { "state" : "translated", "value" : "Cancel" } },
        "ja" : { "stringUnit" : { "state" : "translated", "value" : "キャンセル" } }
      }
    },
    "common.save" : {
      "localizations" : {
        "zh-Hant" : { "stringUnit" : { "state" : "translated", "value" : "儲存" } },
        "en" : { "stringUnit" : { "state" : "translated", "value" : "Save" } },
        "ja" : { "stringUnit" : { "state" : "translated", "value" : "保存" } }
      }
    },
    "daily.tasks.newPlaceholder" : {
      "localizations" : {
        "zh-Hant" : { "stringUnit" : { "state" : "translated", "value" : "新增任務" } },
        "en" : { "stringUnit" : { "state" : "translated", "value" : "New task" } },
        "ja" : { "stringUnit" : { "state" : "translated", "value" : "新しいタスク" } }
      }
    },
    "daily.tasks.overdueSection" : {
      "localizations" : {
        "zh-Hant" : { "stringUnit" : { "state" : "translated", "value" : "過期" } },
        "en" : { "stringUnit" : { "state" : "translated", "value" : "Overdue" } },
        "ja" : { "stringUnit" : { "state" : "translated", "value" : "期限切れ" } }
      }
    },
    "daily.tasks.overdueScheduleToday" : {
      "localizations" : {
        "zh-Hant" : { "stringUnit" : { "state" : "translated", "value" : "排入今天" } },
        "en" : { "stringUnit" : { "state" : "translated", "value" : "Schedule for today" } },
        "ja" : { "stringUnit" : { "state" : "translated", "value" : "今日に入れる" } }
      }
    },
    "daily.tasks.emptyToday" : {
      "localizations" : {
        "zh-Hant" : { "stringUnit" : { "state" : "translated", "value" : "今天還沒有任務" } },
        "en" : { "stringUnit" : { "state" : "translated", "value" : "No tasks yet" } },
        "ja" : { "stringUnit" : { "state" : "translated", "value" : "今日のタスクはまだありません" } }
      }
    },
    "daily.tasks.todayButton" : {
      "localizations" : {
        "zh-Hant" : { "stringUnit" : { "state" : "translated", "value" : "今天" } },
        "en" : { "stringUnit" : { "state" : "translated", "value" : "Today" } },
        "ja" : { "stringUnit" : { "state" : "translated", "value" : "今日" } }
      }
    },
    "daily.tasks.detailMoveTo" : {
      "localizations" : {
        "zh-Hant" : { "stringUnit" : { "state" : "translated", "value" : "移到其他日期" } },
        "en" : { "stringUnit" : { "state" : "translated", "value" : "Move to another date" } },
        "ja" : { "stringUnit" : { "state" : "translated", "value" : "別の日付に移動" } }
      }
    },
    "daily.tasks.detailArchive" : {
      "localizations" : {
        "zh-Hant" : { "stringUnit" : { "state" : "translated", "value" : "封存" } },
        "en" : { "stringUnit" : { "state" : "translated", "value" : "Archive" } },
        "ja" : { "stringUnit" : { "state" : "translated", "value" : "アーカイブ" } }
      }
    },
    "daily.tasks.swipeArchive" : {
      "localizations" : {
        "zh-Hant" : { "stringUnit" : { "state" : "translated", "value" : "封存" } },
        "en" : { "stringUnit" : { "state" : "translated", "value" : "Archive" } },
        "ja" : { "stringUnit" : { "state" : "translated", "value" : "アーカイブ" } }
      }
    },
    "daily.tasks.swipeMove" : {
      "localizations" : {
        "zh-Hant" : { "stringUnit" : { "state" : "translated", "value" : "移動" } },
        "en" : { "stringUnit" : { "state" : "translated", "value" : "Move" } },
        "ja" : { "stringUnit" : { "state" : "translated", "value" : "移動" } }
      }
    },
    "calendar.panelTitle" : {
      "localizations" : {
        "zh-Hant" : { "stringUnit" : { "state" : "translated", "value" : "今日行程" } },
        "en" : { "stringUnit" : { "state" : "translated", "value" : "Today's schedule" } },
        "ja" : { "stringUnit" : { "state" : "translated", "value" : "今日の予定" } }
      }
    },
    "calendar.panelEmpty" : {
      "localizations" : {
        "zh-Hant" : { "stringUnit" : { "state" : "translated", "value" : "今天沒有行程" } },
        "en" : { "stringUnit" : { "state" : "translated", "value" : "Nothing on your calendar" } },
        "ja" : { "stringUnit" : { "state" : "translated", "value" : "今日の予定はありません" } }
      }
    },
    "calendar.connectCTA" : {
      "localizations" : {
        "zh-Hant" : { "stringUnit" : { "state" : "translated", "value" : "連結 Google 日曆" } },
        "en" : { "stringUnit" : { "state" : "translated", "value" : "Connect Google Calendar" } },
        "ja" : { "stringUnit" : { "state" : "translated", "value" : "Google カレンダーを連携" } }
      }
    },
    "offline.banner" : {
      "localizations" : {
        "zh-Hant" : { "stringUnit" : { "state" : "translated", "value" : "離線中。上次更新於 %@" } },
        "en" : { "stringUnit" : { "state" : "translated", "value" : "Offline. Last updated at %@." } },
        "ja" : { "stringUnit" : { "state" : "translated", "value" : "オフライン。最終更新: %@" } }
      }
    },
    "error.network" : {
      "localizations" : {
        "zh-Hant" : { "stringUnit" : { "state" : "translated", "value" : "網路錯誤" } },
        "en" : { "stringUnit" : { "state" : "translated", "value" : "Network error" } },
        "ja" : { "stringUnit" : { "state" : "translated", "value" : "ネットワークエラー" } }
      }
    },
    "error.unauthorized" : {
      "localizations" : {
        "zh-Hant" : { "stringUnit" : { "state" : "translated", "value" : "請重新登入" } },
        "en" : { "stringUnit" : { "state" : "translated", "value" : "Please sign in again" } },
        "ja" : { "stringUnit" : { "state" : "translated", "value" : "再度サインインしてください" } }
      }
    },
    "error.unknown" : {
      "localizations" : {
        "zh-Hant" : { "stringUnit" : { "state" : "translated", "value" : "發生錯誤" } },
        "en" : { "stringUnit" : { "state" : "translated", "value" : "Something went wrong" } },
        "ja" : { "stringUnit" : { "state" : "translated", "value" : "エラーが発生しました" } }
      }
    },
    "weekday.sun" : { "localizations" : { "zh-Hant" : { "stringUnit" : { "state" : "translated", "value" : "日" } }, "en" : { "stringUnit" : { "state" : "translated", "value" : "Sun" } }, "ja" : { "stringUnit" : { "state" : "translated", "value" : "日" } } } },
    "weekday.mon" : { "localizations" : { "zh-Hant" : { "stringUnit" : { "state" : "translated", "value" : "一" } }, "en" : { "stringUnit" : { "state" : "translated", "value" : "Mon" } }, "ja" : { "stringUnit" : { "state" : "translated", "value" : "月" } } } },
    "weekday.tue" : { "localizations" : { "zh-Hant" : { "stringUnit" : { "state" : "translated", "value" : "二" } }, "en" : { "stringUnit" : { "state" : "translated", "value" : "Tue" } }, "ja" : { "stringUnit" : { "state" : "translated", "value" : "火" } } } },
    "weekday.wed" : { "localizations" : { "zh-Hant" : { "stringUnit" : { "state" : "translated", "value" : "三" } }, "en" : { "stringUnit" : { "state" : "translated", "value" : "Wed" } }, "ja" : { "stringUnit" : { "state" : "translated", "value" : "水" } } } },
    "weekday.thu" : { "localizations" : { "zh-Hant" : { "stringUnit" : { "state" : "translated", "value" : "四" } }, "en" : { "stringUnit" : { "state" : "translated", "value" : "Thu" } }, "ja" : { "stringUnit" : { "state" : "translated", "value" : "木" } } } },
    "weekday.fri" : { "localizations" : { "zh-Hant" : { "stringUnit" : { "state" : "translated", "value" : "五" } }, "en" : { "stringUnit" : { "state" : "translated", "value" : "Fri" } }, "ja" : { "stringUnit" : { "state" : "translated", "value" : "金" } } } },
    "weekday.sat" : { "localizations" : { "zh-Hant" : { "stringUnit" : { "state" : "translated", "value" : "六" } }, "en" : { "stringUnit" : { "state" : "translated", "value" : "Sat" } }, "ja" : { "stringUnit" : { "state" : "translated", "value" : "土" } } } }
  },
  "version" : "1.0"
}
```

- [ ] **Step 2: 改 Package.swift 加 NudgeCore resources**

Edit `apple/NudgeKit/Package.swift`，把 `NudgeCore` target 改成：
```swift
.target(
    name: "NudgeCore",
    resources: [
        .process("Resources/Localizable.xcstrings")
    ]
),
```

- [ ] **Step 3: Build 驗**

```bash
cd /Users/mike/Documents/nudge/apple/NudgeKit
swift build
```
Expected: Build complete.

- [ ] **Step 4: Commit**

```bash
cd /Users/mike/Documents/nudge
git add apple/NudgeKit/Sources/NudgeCore/Resources/ apple/NudgeKit/Package.swift
git commit -m "$(cat <<'EOF'
feat(core): Localizable.xcstrings mirroring Web messages keys

zh-Hant / en / ja. Keys aligned to src/messages/*.json.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Date formatting helpers

**Files:**
- Create: `apple/NudgeKit/Sources/NudgeCore/DateFormatters.swift`
- Create: `apple/NudgeKit/Tests/NudgeCoreTests/Phase2/DateFormattersTests.swift`

- [ ] **Step 1: 寫 failing tests**

Create `apple/NudgeKit/Tests/NudgeCoreTests/Phase2/DateFormattersTests.swift`:
```swift
import Testing
import Foundation
@testable import NudgeCore

@Suite("DateFormatters") struct DateFormattersTests {
    @Test func formatsISODate() {
        var comps = DateComponents()
        comps.year = 2026; comps.month = 4; comps.day = 17
        comps.timeZone = TimeZone(identifier: "Asia/Taipei")
        let date = Calendar(identifier: .gregorian).date(from: comps)!
        #expect(DateFormatters.isoDate(date, in: TimeZone(identifier: "Asia/Taipei")!) == "2026-04-17")
    }

    @Test func parsesISODate() throws {
        let date = try #require(DateFormatters.parseISODate("2026-04-17", in: TimeZone(identifier: "Asia/Taipei")!))
        let comps = Calendar(identifier: .gregorian).dateComponents(in: TimeZone(identifier: "Asia/Taipei")!, from: date)
        #expect(comps.year == 2026)
        #expect(comps.month == 4)
        #expect(comps.day == 17)
    }

    @Test func startOfWeekMonday() {
        var comps = DateComponents()
        comps.year = 2026; comps.month = 4; comps.day = 17  // 週五
        comps.timeZone = TimeZone(identifier: "Asia/Taipei")
        let date = Calendar(identifier: .gregorian).date(from: comps)!
        let startOfWeek = DateFormatters.startOfWeek(date, in: TimeZone(identifier: "Asia/Taipei")!)
        let startISO = DateFormatters.isoDate(startOfWeek, in: TimeZone(identifier: "Asia/Taipei")!)
        #expect(startISO == "2026-04-13")  // 週一
    }

    @Test func isWeekendDetection() {
        let tz = TimeZone(identifier: "Asia/Taipei")!
        let sat = try! #require(DateFormatters.parseISODate("2026-04-18", in: tz))
        let sun = try! #require(DateFormatters.parseISODate("2026-04-19", in: tz))
        let mon = try! #require(DateFormatters.parseISODate("2026-04-20", in: tz))
        #expect(DateFormatters.isWeekend(sat, in: tz))
        #expect(DateFormatters.isWeekend(sun, in: tz))
        #expect(!DateFormatters.isWeekend(mon, in: tz))
    }
}
```

- [ ] **Step 2: Run test, confirm FAIL**

```bash
cd /Users/mike/Documents/nudge/apple/NudgeKit
swift test --filter DateFormattersTests --no-parallel
```
Expected: compile error — `DateFormatters` 未定義。

- [ ] **Step 3: 實作 DateFormatters**

Create `apple/NudgeKit/Sources/NudgeCore/DateFormatters.swift`:
```swift
import Foundation

public enum DateFormatters {
    /// 格式化為 "YYYY-MM-DD"（server date string 格式）。
    public static func isoDate(_ date: Date, in timeZone: TimeZone = .current) -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = timeZone
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }

    /// 解析 "YYYY-MM-DD"。
    public static func parseISODate(_ string: String, in timeZone: TimeZone = .current) -> Date? {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = timeZone
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.date(from: string)
    }

    /// 返回週一為起始日的那個週一 00:00。
    public static func startOfWeek(_ date: Date, in timeZone: TimeZone = .current) -> Date {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        calendar.firstWeekday = 2  // Monday
        let components = calendar.dateComponents([.yearForWeekOfYear, .weekOfYear], from: date)
        return calendar.date(from: components) ?? date
    }

    /// 是否為週六或週日。
    public static func isWeekend(_ date: Date, in timeZone: TimeZone = .current) -> Bool {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        let weekday = calendar.component(.weekday, from: date)
        return weekday == 1 || weekday == 7  // 1 = Sun, 7 = Sat
    }
}
```

- [ ] **Step 4: Run test, confirm PASS**

```bash
cd /Users/mike/Documents/nudge/apple/NudgeKit
swift test --filter DateFormattersTests --no-parallel
```
Expected: 4 tests passed.

- [ ] **Step 5: Commit**

```bash
cd /Users/mike/Documents/nudge
git add apple/NudgeKit/Sources/NudgeCore/DateFormatters.swift apple/NudgeKit/Tests/NudgeCoreTests/Phase2/
git commit -m "$(cat <<'EOF'
feat(core): DateFormatters — ISO date, start-of-week, weekend check

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

# Block B：DTOs

### Task 6: DTO types（TaskDTO / DailyAssignmentDTO / DailyDataDTO / WeekSummaryDTO / CalendarEventDTO / TagDTO）

**Files:**
- Create: `apple/NudgeKit/Sources/NudgeCore/TaskDTO.swift`
- Create: `apple/NudgeKit/Sources/NudgeCore/DailyDataDTO.swift`（含 DailyAssignmentDTO）
- Create: `apple/NudgeKit/Sources/NudgeCore/WeekSummaryDTO.swift`
- Create: `apple/NudgeKit/Sources/NudgeCore/CalendarDTO.swift`
- Create: `apple/NudgeKit/Sources/NudgeCore/TagDTO.swift`
- Create: `apple/NudgeKit/Tests/NudgeCoreTests/Phase2/DTOTests.swift`

- [ ] **Step 1: 寫 failing tests**

Create `apple/NudgeKit/Tests/NudgeCoreTests/Phase2/DTOTests.swift`:
```swift
import Testing
import Foundation
@testable import NudgeCore

@Suite("Phase 2 DTOs") struct DTOTests {
    @Test func taskDTODecodesRealServerShape() throws {
        let json = #"""
        {
          "id": "t1",
          "title": "Buy milk",
          "description": "at 7-11",
          "status": "in_progress",
          "createdAt": "2026-04-17T10:00:00.000Z",
          "updatedAt": "2026-04-17T10:00:00.000Z"
        }
        """#.data(using: .utf8)!
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let task = try decoder.decode(TaskDTO.self, from: json)
        #expect(task.id == "t1")
        #expect(task.title == "Buy milk")
        #expect(task.status == "in_progress")
    }

    @Test func dailyAssignmentDecodesNestedTask() throws {
        let json = #"""
        {
          "id": "a1",
          "taskId": "t1",
          "date": "2026-04-17",
          "isCompleted": false,
          "sortOrder": 0,
          "task": {
            "id": "t1",
            "title": "Buy milk",
            "description": "",
            "status": "in_progress",
            "createdAt": "2026-04-17T10:00:00.000Z",
            "updatedAt": "2026-04-17T10:00:00.000Z"
          }
        }
        """#.data(using: .utf8)!
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let a = try decoder.decode(DailyAssignmentDTO.self, from: json)
        #expect(a.id == "a1")
        #expect(a.task.title == "Buy milk")
    }

    @Test func dailyDataDTODecodesFullResponse() throws {
        let json = #"""
        {
          "date": "2026-04-17",
          "assignments": [],
          "overdueTasks": [],
          "noteContent": null
        }
        """#.data(using: .utf8)!
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let data = try decoder.decode(DailyDataDTO.self, from: json)
        #expect(data.date == "2026-04-17")
        #expect(data.assignments.isEmpty)
        #expect(data.noteContent == nil)
    }

    @Test func weekSummaryDecodes() throws {
        let json = #"{"datesWithTasks":["2026-04-15","2026-04-17"]}"#.data(using: .utf8)!
        let summary = try JSONDecoder().decode(WeekSummaryDTO.self, from: json)
        #expect(summary.datesWithTasks == ["2026-04-15", "2026-04-17"])
    }

    @Test func calendarEventDecodes() throws {
        let json = #"""
        {
          "id": "ev1",
          "summary": "Meeting",
          "start": "2026-04-17T09:00:00Z",
          "end": "2026-04-17T10:00:00Z",
          "location": "Room 1",
          "attendees": ["alice@x.com"],
          "hangoutLink": null,
          "htmlLink": "https://cal.google.com/..."
        }
        """#.data(using: .utf8)!
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let ev = try decoder.decode(CalendarEventDTO.self, from: json)
        #expect(ev.id == "ev1")
        #expect(ev.attendees.count == 1)
    }

    @Test func tagDTODecodes() throws {
        let json = #"""
        {"id":"tag1","name":"Work","color":"#5a7050","sortOrder":0}
        """#.data(using: .utf8)!
        let tag = try JSONDecoder().decode(TagDTO.self, from: json)
        #expect(tag.name == "Work")
        #expect(tag.color == "#5a7050")
    }
}
```

- [ ] **Step 2: Run test, confirm FAIL**

```bash
cd /Users/mike/Documents/nudge/apple/NudgeKit
swift test --filter DTOTests --no-parallel
```
Expected: compile error.

- [ ] **Step 3: 建 TaskDTO**

Create `apple/NudgeKit/Sources/NudgeCore/TaskDTO.swift`:
```swift
import Foundation

public struct TaskDTO: Codable, Equatable, Sendable {
    public let id: String
    public let title: String
    public let description: String
    public let status: String
    public let createdAt: Date
    public let updatedAt: Date

    public init(id: String, title: String, description: String, status: String, createdAt: Date, updatedAt: Date) {
        self.id = id; self.title = title; self.description = description; self.status = status
        self.createdAt = createdAt; self.updatedAt = updatedAt
    }
}
```

- [ ] **Step 4: 建 DailyDataDTO + DailyAssignmentDTO**

Create `apple/NudgeKit/Sources/NudgeCore/DailyDataDTO.swift`:
```swift
import Foundation

public struct DailyAssignmentDTO: Codable, Equatable, Sendable {
    public let id: String
    public let taskId: String
    public let date: String
    public let isCompleted: Bool
    public let sortOrder: Int
    public let task: TaskDTO

    public init(id: String, taskId: String, date: String, isCompleted: Bool, sortOrder: Int, task: TaskDTO) {
        self.id = id; self.taskId = taskId; self.date = date
        self.isCompleted = isCompleted; self.sortOrder = sortOrder; self.task = task
    }
}

public struct DailyDataDTO: Codable, Sendable {
    public let date: String
    public let assignments: [DailyAssignmentDTO]
    public let overdueTasks: [DailyAssignmentDTO]
    public let noteContent: String?

    public init(date: String, assignments: [DailyAssignmentDTO], overdueTasks: [DailyAssignmentDTO], noteContent: String?) {
        self.date = date; self.assignments = assignments
        self.overdueTasks = overdueTasks; self.noteContent = noteContent
    }
}
```

- [ ] **Step 5: 建 WeekSummaryDTO**

Create `apple/NudgeKit/Sources/NudgeCore/WeekSummaryDTO.swift`:
```swift
import Foundation

public struct WeekSummaryDTO: Codable, Sendable {
    public let datesWithTasks: [String]

    public init(datesWithTasks: [String]) {
        self.datesWithTasks = datesWithTasks
    }
}
```

- [ ] **Step 6: 建 CalendarDTO**

Create `apple/NudgeKit/Sources/NudgeCore/CalendarDTO.swift`:
```swift
import Foundation

public struct CalendarEventDTO: Codable, Equatable, Sendable {
    public let id: String
    public let summary: String
    public let start: Date
    public let end: Date
    public let location: String?
    public let attendees: [String]
    public let hangoutLink: String?
    public let htmlLink: String?

    public init(id: String, summary: String, start: Date, end: Date,
                location: String?, attendees: [String], hangoutLink: String?, htmlLink: String?) {
        self.id = id; self.summary = summary; self.start = start; self.end = end
        self.location = location; self.attendees = attendees
        self.hangoutLink = hangoutLink; self.htmlLink = htmlLink
    }
}
```

- [ ] **Step 7: 建 TagDTO**

Create `apple/NudgeKit/Sources/NudgeCore/TagDTO.swift`:
```swift
import Foundation

public struct TagDTO: Codable, Equatable, Sendable {
    public let id: String
    public let name: String
    public let color: String  // hex, "#xxxxxx"
    public let sortOrder: Int

    public init(id: String, name: String, color: String, sortOrder: Int) {
        self.id = id; self.name = name; self.color = color; self.sortOrder = sortOrder
    }
}
```

- [ ] **Step 8: Run test, confirm PASS (6 tests)**

```bash
cd /Users/mike/Documents/nudge/apple/NudgeKit
swift test --filter DTOTests --no-parallel
```
Expected: 6 tests passed.

- [ ] **Step 9: Commit**

```bash
cd /Users/mike/Documents/nudge
git add apple/NudgeKit/Sources/NudgeCore/TaskDTO.swift apple/NudgeKit/Sources/NudgeCore/DailyDataDTO.swift apple/NudgeKit/Sources/NudgeCore/WeekSummaryDTO.swift apple/NudgeKit/Sources/NudgeCore/CalendarDTO.swift apple/NudgeKit/Sources/NudgeCore/TagDTO.swift apple/NudgeKit/Tests/NudgeCoreTests/Phase2/DTOTests.swift
git commit -m "$(cat <<'EOF'
feat(core): Phase 2 DTOs — Task/DailyAssignment/DailyData/WeekSummary/CalendarEvent/Tag

Aligned to server response shapes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

# Block C：SwiftData Models

### Task 7: TaskItem + DailyAssignment @Model + container update

**Files:**
- Create: `apple/NudgeKit/Sources/NudgeData/TaskItem+Model.swift`
- Create: `apple/NudgeKit/Sources/NudgeData/DailyAssignment+Model.swift`
- Modify: `apple/NudgeKit/Sources/NudgeData/NudgeModelContainer.swift`

- [ ] **Step 1: 寫 TaskItem @Model**

Create `apple/NudgeKit/Sources/NudgeData/TaskItem+Model.swift`:
```swift
import Foundation
import SwiftData

@Model
public final class TaskItem {
    @Attribute(.unique) public var serverId: String
    public var title: String
    public var desc: String          // 避開 Swift 保留字 description
    public var tagIds: [String]
    public var createdAt: Date
    public var updatedAt: Date
    public var fetchedAt: Date
    @Relationship(deleteRule: .cascade, inverse: \DailyAssignment.task)
    public var assignments: [DailyAssignment] = []

    public init(
        serverId: String,
        title: String,
        desc: String,
        tagIds: [String],
        createdAt: Date,
        updatedAt: Date,
        fetchedAt: Date
    ) {
        self.serverId = serverId
        self.title = title
        self.desc = desc
        self.tagIds = tagIds
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.fetchedAt = fetchedAt
    }
}
```

- [ ] **Step 2: 寫 DailyAssignment @Model**

Create `apple/NudgeKit/Sources/NudgeData/DailyAssignment+Model.swift`:
```swift
import Foundation
import SwiftData

@Model
public final class DailyAssignment {
    @Attribute(.unique) public var serverId: String
    public var date: String          // "YYYY-MM-DD"
    public var isCompleted: Bool
    public var sortOrder: Int
    public var fetchedAt: Date
    public var task: TaskItem?

    public init(
        serverId: String,
        date: String,
        isCompleted: Bool,
        sortOrder: Int,
        fetchedAt: Date,
        task: TaskItem? = nil
    ) {
        self.serverId = serverId
        self.date = date
        self.isCompleted = isCompleted
        self.sortOrder = sortOrder
        self.fetchedAt = fetchedAt
        self.task = task
    }
}
```

- [ ] **Step 3: 改 NudgeModelContainer 加 schema**

Edit `apple/NudgeKit/Sources/NudgeData/NudgeModelContainer.swift`，把 `Schema([])` 改為：

```swift
import Foundation
import SwiftData

public enum NudgeModelContainer {
    @MainActor
    public static func make() -> ModelContainer {
        let schema = Schema([TaskItem.self, DailyAssignment.self])
        let configuration = ModelConfiguration(schema: schema, isStoredInMemoryOnly: false)
        do {
            return try ModelContainer(for: schema, configurations: configuration)
        } catch {
            fatalError("Failed to create ModelContainer: \(error)")
        }
    }

    @MainActor
    public static func makeInMemory() -> ModelContainer {
        let schema = Schema([TaskItem.self, DailyAssignment.self])
        let configuration = ModelConfiguration(schema: schema, isStoredInMemoryOnly: true)
        do {
            return try ModelContainer(for: schema, configurations: configuration)
        } catch {
            fatalError("Failed to create in-memory ModelContainer: \(error)")
        }
    }
}
```

- [ ] **Step 4: Build 驗 schema 合法**

```bash
cd /Users/mike/Documents/nudge/apple/NudgeKit
swift build
```
Expected: Build complete.

- [ ] **Step 5: 寫 smoke test 驗 container 能 create + insert + query**

Create `apple/NudgeKit/Tests/NudgeCoreTests/Phase2/ModelContainerTests.swift`:
```swift
import Testing
import Foundation
import SwiftData
@testable import NudgeData

@Suite("NudgeModelContainer", .serialized) @MainActor
struct ModelContainerTests {
    @Test func canInsertTaskItemAndRetrieve() throws {
        let container = NudgeModelContainer.makeInMemory()
        let context = ModelContext(container)
        let now = Date()

        let item = TaskItem(
            serverId: "t1", title: "Buy milk", desc: "",
            tagIds: [], createdAt: now, updatedAt: now, fetchedAt: now
        )
        context.insert(item)
        try context.save()

        let descriptor = FetchDescriptor<TaskItem>()
        let items = try context.fetch(descriptor)
        #expect(items.count == 1)
        #expect(items.first?.serverId == "t1")
    }

    @Test func assignmentLinksToTask() throws {
        let container = NudgeModelContainer.makeInMemory()
        let context = ModelContext(container)
        let now = Date()

        let task = TaskItem(serverId: "t1", title: "T", desc: "",
                             tagIds: [], createdAt: now, updatedAt: now, fetchedAt: now)
        context.insert(task)
        let assignment = DailyAssignment(serverId: "a1", date: "2026-04-17",
                                          isCompleted: false, sortOrder: 0, fetchedAt: now, task: task)
        context.insert(assignment)
        try context.save()

        let descriptor = FetchDescriptor<DailyAssignment>()
        let found = try context.fetch(descriptor)
        #expect(found.first?.task?.serverId == "t1")
    }
}
```

**Package.swift 還要把 NudgeData 加到 NudgeCoreTests 的 dependencies**——改 `apple/NudgeKit/Package.swift`：
```swift
.testTarget(name: "NudgeCoreTests", dependencies: ["NudgeCore", "NudgeData"]),
```

- [ ] **Step 6: Run test, confirm PASS**

```bash
cd /Users/mike/Documents/nudge/apple/NudgeKit
swift test --filter ModelContainerTests --no-parallel
```
Expected: 2 tests passed.

- [ ] **Step 7: Commit**

```bash
cd /Users/mike/Documents/nudge
git add apple/NudgeKit/Sources/NudgeData/ apple/NudgeKit/Tests/NudgeCoreTests/Phase2/ModelContainerTests.swift apple/NudgeKit/Package.swift
git commit -m "$(cat <<'EOF'
feat(data): TaskItem + DailyAssignment @Model + container schema

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

# Block D：APIClient 改造（接 401 handler）

### Task 8: APIClient 支援 mutable unauthorizedHandler

**Files:**
- Modify: `apple/NudgeKit/Sources/NudgeCore/APIClient.swift`

Phase 1 留的 loose end：APIClient 的 `unauthorizedHandler` 在 init 時傳一次，後續無法改。Phase 2 需要 `TaskRepository` 被 create 後，才能把 `auth.handleUnauthorized` 塞給 client。方法：加一個 thread-safe setter。

- [ ] **Step 1: 改 APIClient.swift**

Edit `apple/NudgeKit/Sources/NudgeCore/APIClient.swift`，把 `private let unauthorizedHandler` 改成 lock-protected var，並加 public setter：

```swift
public final class APIClient: Sendable {
    public typealias TokenProvider = @Sendable () -> String?
    public typealias UnauthorizedHandler = @Sendable () async -> Void

    private let configuration: APIConfiguration
    private let session: URLSession
    private let tokenProvider: TokenProvider?
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    // Lock-protected mutable handler
    private let handlerLock = NSLock()
    private nonisolated(unsafe) var _unauthorizedHandler: UnauthorizedHandler?

    public init(
        configuration: APIConfiguration,
        session: URLSession = .shared,
        tokenProvider: TokenProvider? = nil,
        unauthorizedHandler: UnauthorizedHandler? = nil
    ) {
        self.configuration = configuration
        self.session = session
        self.tokenProvider = tokenProvider
        self._unauthorizedHandler = unauthorizedHandler

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        self.decoder = decoder

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        self.encoder = encoder
    }

    public func setUnauthorizedHandler(_ handler: UnauthorizedHandler?) {
        handlerLock.lock()
        defer { handlerLock.unlock() }
        _unauthorizedHandler = handler
    }

    private func unauthorizedHandler() -> UnauthorizedHandler? {
        handlerLock.lock()
        defer { handlerLock.unlock() }
        return _unauthorizedHandler
    }

    // ... get/post/patch/delete 沿用 ...

    private func perform<Response: Decodable>(_ request: URLRequest) async throws -> Response {
        // ... 前半不變 ...
        case 401:
            if let handler = unauthorizedHandler() {
                await handler()
            }
            throw APIError.unauthorized
        // ... 其餘不變 ...
    }
}
```

**注意**：保留原本 init 參數 `unauthorizedHandler:` 向後相容；內部存到 `_unauthorizedHandler`。

- [ ] **Step 2: Run existing APIClient tests**

```bash
cd /Users/mike/Documents/nudge/apple/NudgeKit
swift test --filter APIClientTests --no-parallel
```
Expected: 5 tests still pass.

- [ ] **Step 3: 加 test 驗 setter**

新增 test 到 `APIClientTests.swift`：
```swift
@Test func setUnauthorizedHandlerOverridesInit() async throws {
    MockURLProtocol.handler = { request in
        let response = HTTPURLResponse(url: request.url!, statusCode: 401, httpVersion: nil, headerFields: nil)!
        return (Data(), response)
    }

    actor CallCounter {
        var count = 0
        func increment() { count += 1 }
    }
    let counter = CallCounter()

    let client = APIClient(
        configuration: APIConfiguration(baseURL: URL(string: "https://test.local")!),
        session: .mocked()
    )
    client.setUnauthorizedHandler {
        await counter.increment()
    }

    struct P: Codable { let x: String }
    try? await {
        let _: P = try await client.get("/api/me")
    }()

    try await Task.sleep(for: .milliseconds(50))
    let count = await counter.count
    #expect(count == 1)
}
```

- [ ] **Step 4: Run test, confirm PASS**

```bash
cd /Users/mike/Documents/nudge/apple/NudgeKit
swift test --filter APIClientTests --no-parallel
```
Expected: 6 tests passed.

- [ ] **Step 5: Commit**

```bash
cd /Users/mike/Documents/nudge
git add apple/NudgeKit/Sources/NudgeCore/APIClient.swift apple/NudgeKit/Tests/NudgeCoreTests/APIClientTests.swift
git commit -m "$(cat <<'EOF'
feat(core): APIClient supports mutable unauthorizedHandler

Allows post-init wiring (Phase 2 repositories wire to AuthRepository).
Thread-safe via NSLock.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

# Block E：Repositories

### Task 9: TagRepository（read-only list + cache）

**Files:**
- Create: `apple/NudgeKit/Sources/NudgeCore/TagRepository.swift`
- Create: `apple/NudgeKit/Tests/NudgeCoreTests/Phase2/TagRepositoryTests.swift`

- [ ] **Step 1: 寫 failing tests**

Create `apple/NudgeKit/Tests/NudgeCoreTests/Phase2/TagRepositoryTests.swift`:
```swift
import Testing
import Foundation
@testable import NudgeCore

@Suite("TagRepository", .serialized) @MainActor
struct TagRepositoryTests {
    func makeClient(_ body: String) -> APIClient {
        MockURLProtocol.handler = { request in
            let data = body.data(using: .utf8)!
            let response = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!
            return (data, response)
        }
        return APIClient(
            configuration: APIConfiguration(baseURL: URL(string: "https://test.local")!),
            session: .mocked()
        )
    }

    @Test func listFetchesAndCaches() async throws {
        let client = makeClient(#"{"tags":[{"id":"t1","name":"Work","color":"#5a7050","sortOrder":0}]}"#)
        let repo = TagRepository(client: client)
        let tags = try await repo.list()
        #expect(tags.count == 1)
        #expect(tags.first?.name == "Work")
    }

    @Test func secondListUsesCache() async throws {
        actor CallCounter {
            var count = 0
            func increment() { count += 1 }
        }
        let counter = CallCounter()

        MockURLProtocol.handler = { request in
            Task { await counter.increment() }
            let data = #"{"tags":[]}"#.data(using: .utf8)!
            let response = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!
            return (data, response)
        }

        let client = APIClient(
            configuration: APIConfiguration(baseURL: URL(string: "https://test.local")!),
            session: .mocked()
        )
        let repo = TagRepository(client: client)
        _ = try await repo.list()
        _ = try await repo.list()

        try await Task.sleep(for: .milliseconds(50))
        #expect(await counter.count == 1)
    }

    @Test func invalidateForcesRefetch() async throws {
        actor CallCounter {
            var count = 0
            func increment() { count += 1 }
        }
        let counter = CallCounter()

        MockURLProtocol.handler = { request in
            Task { await counter.increment() }
            let data = #"{"tags":[]}"#.data(using: .utf8)!
            let response = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!
            return (data, response)
        }

        let client = APIClient(
            configuration: APIConfiguration(baseURL: URL(string: "https://test.local")!),
            session: .mocked()
        )
        let repo = TagRepository(client: client)
        _ = try await repo.list()
        repo.invalidate()
        _ = try await repo.list()

        try await Task.sleep(for: .milliseconds(50))
        #expect(await counter.count == 2)
    }
}
```

- [ ] **Step 2: Run, confirm FAIL**

- [ ] **Step 3: 實作 TagRepository**

Create `apple/NudgeKit/Sources/NudgeCore/TagRepository.swift`:
```swift
import Foundation
import Observation

@Observable
@MainActor
public final class TagRepository {
    private let client: APIClient
    private var cache: [TagDTO]?

    public init(client: APIClient) {
        self.client = client
    }

    public func list() async throws -> [TagDTO] {
        if let cache {
            return cache
        }
        let response: TagsResponse = try await client.get("/api/tags")
        cache = response.tags
        return response.tags
    }

    public func invalidate() {
        cache = nil
    }

    private struct TagsResponse: Codable {
        let tags: [TagDTO]
    }
}
```

- [ ] **Step 4: Run, confirm PASS**

- [ ] **Step 5: Commit**

```bash
cd /Users/mike/Documents/nudge
git add apple/NudgeKit/Sources/NudgeCore/TagRepository.swift apple/NudgeKit/Tests/NudgeCoreTests/Phase2/TagRepositoryTests.swift
git commit -m "$(cat <<'EOF'
feat(core): TagRepository with in-memory cache + invalidate

Read-only for Phase 2 (detail view tag chips). Phase 5 will add CRUD.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: CalendarRepository

**Files:**
- Create: `apple/NudgeKit/Sources/NudgeCore/CalendarRepository.swift`
- Create: `apple/NudgeKit/Tests/NudgeCoreTests/Phase2/CalendarRepositoryTests.swift`

- [ ] **Step 1: 寫 failing tests**

Create `apple/NudgeKit/Tests/NudgeCoreTests/Phase2/CalendarRepositoryTests.swift`:
```swift
import Testing
import Foundation
@testable import NudgeCore

@Suite("CalendarRepository", .serialized) @MainActor
struct CalendarRepositoryTests {
    @Test func eventsDecodesListResponse() async throws {
        MockURLProtocol.handler = { request in
            let body = #"""
            {"events":[{"id":"e1","summary":"Meeting","start":"2026-04-17T09:00:00Z","end":"2026-04-17T10:00:00Z","location":null,"attendees":[],"hangoutLink":null,"htmlLink":null}]}
            """#
            let data = body.data(using: .utf8)!
            let response = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!
            return (data, response)
        }
        let client = APIClient(
            configuration: APIConfiguration(baseURL: URL(string: "https://test.local")!),
            session: .mocked()
        )
        let repo = CalendarRepository(client: client)
        let events = try await repo.events(date: "2026-04-17")
        #expect(events.count == 1)
        #expect(events.first?.summary == "Meeting")
        #expect(repo.isConnected == true)
    }

    @Test func eventsSetsNotConnectedOn400() async throws {
        MockURLProtocol.handler = { request in
            let data = #"{"error":"not_connected"}"#.data(using: .utf8)!
            let response = HTTPURLResponse(url: request.url!, statusCode: 400, httpVersion: nil, headerFields: nil)!
            return (data, response)
        }
        let client = APIClient(
            configuration: APIConfiguration(baseURL: URL(string: "https://test.local")!),
            session: .mocked()
        )
        let repo = CalendarRepository(client: client)
        _ = try? await repo.events(date: "2026-04-17")
        #expect(repo.isConnected == false)
    }
}
```

- [ ] **Step 2: Run, confirm FAIL**

- [ ] **Step 3: 實作 CalendarRepository**

Create `apple/NudgeKit/Sources/NudgeCore/CalendarRepository.swift`:
```swift
import Foundation
import Observation

@Observable
@MainActor
public final class CalendarRepository {
    private let client: APIClient
    public private(set) var isConnected: Bool = true    // 預設 true，遇到 400 改 false

    public init(client: APIClient) {
        self.client = client
    }

    public func events(date: String) async throws -> [CalendarEventDTO] {
        do {
            let response: EventsResponse = try await client.get("/api/calendar/events?date=\(date)")
            isConnected = true
            return response.events
        } catch APIError.server(let code, _) where code == 400 {
            isConnected = false
            throw APIError.server(statusCode: 400, message: "not_connected")
        }
    }

    private struct EventsResponse: Codable {
        let events: [CalendarEventDTO]
    }
}
```

- [ ] **Step 4: Run, confirm PASS**

- [ ] **Step 5: Commit**

```bash
cd /Users/mike/Documents/nudge
git add apple/NudgeKit/Sources/NudgeCore/CalendarRepository.swift apple/NudgeKit/Tests/NudgeCoreTests/Phase2/CalendarRepositoryTests.swift
git commit -m "$(cat <<'EOF'
feat(core): CalendarRepository — events + isConnected tracking

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: TaskRepository — 讀（dailyData + weekSummary）

**Files:**
- Create: `apple/NudgeKit/Sources/NudgeCore/TaskRepository.swift`
- Create: `apple/NudgeKit/Tests/NudgeCoreTests/Phase2/TaskRepositoryTests.swift`

- [ ] **Step 1: 寫 failing tests for read methods**

Create `apple/NudgeKit/Tests/NudgeCoreTests/Phase2/TaskRepositoryTests.swift`:
```swift
import Testing
import Foundation
import SwiftData
@testable import NudgeCore
@testable import NudgeData

@Suite("TaskRepository.read", .serialized) @MainActor
struct TaskRepositoryReadTests {
    func makeRepo(responseBody: String, status: Int = 200) -> (TaskRepository, ModelContainer) {
        MockURLProtocol.handler = { request in
            let data = responseBody.data(using: .utf8)!
            let response = HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil, headerFields: nil)!
            return (data, response)
        }
        let client = APIClient(
            configuration: APIConfiguration(baseURL: URL(string: "https://test.local")!),
            session: .mocked()
        )
        let container = NudgeModelContainer.makeInMemory()
        let repo = TaskRepository(client: client, container: container)
        return (repo, container)
    }

    @Test func dailyDataFetchesAndWritesCache() async throws {
        let body = #"""
        {
          "date": "2026-04-17",
          "assignments": [{
            "id": "a1", "taskId": "t1", "date": "2026-04-17",
            "isCompleted": false, "sortOrder": 0,
            "task": {
              "id": "t1", "title": "Buy milk", "description": "",
              "status": "in_progress",
              "createdAt": "2026-04-17T10:00:00.000Z",
              "updatedAt": "2026-04-17T10:00:00.000Z"
            }
          }],
          "overdueTasks": [],
          "noteContent": null
        }
        """#
        let (repo, container) = makeRepo(responseBody: body)
        let data = try await repo.dailyData(date: "2026-04-17")
        #expect(data.assignments.count == 1)
        #expect(data.assignments.first?.task.title == "Buy milk")

        // Cache 被寫入
        let context = ModelContext(container)
        let descriptor = FetchDescriptor<DailyAssignment>()
        let cached = try context.fetch(descriptor)
        #expect(cached.count == 1)
        #expect(cached.first?.serverId == "a1")
    }

    @Test func weekSummaryDecodes() async throws {
        let (repo, _) = makeRepo(responseBody: #"{"datesWithTasks":["2026-04-15","2026-04-17"]}"#)
        let summary = try await repo.weekSummary(start: "2026-04-13", end: "2026-04-19")
        #expect(summary.datesWithTasks.count == 2)
    }
}
```

- [ ] **Step 2: Run, confirm FAIL**

- [ ] **Step 3: 實作 TaskRepository 讀方法**

Create `apple/NudgeKit/Sources/NudgeCore/TaskRepository.swift`:
```swift
import Foundation
import Observation
import SwiftData
import NudgeData

@Observable
@MainActor
public final class TaskRepository {
    private let client: APIClient
    private let container: ModelContainer

    public init(client: APIClient, container: ModelContainer) {
        self.client = client
        self.container = container
    }

    // MARK: - Read

    public func dailyData(date: String) async throws -> DailyDataDTO {
        let data: DailyDataDTO = try await client.get("/api/daily/\(date)")
        try await updateCache(for: date, data: data)
        return data
    }

    public func weekSummary(start: String, end: String) async throws -> WeekSummaryDTO {
        return try await client.get("/api/daily/week?start=\(start)&end=\(end)")
    }

    // MARK: - Cache

    private func updateCache(for date: String, data: DailyDataDTO) async throws {
        let context = ModelContext(container)
        let now = Date()

        // 清掉該日舊 assignments
        let descriptor = FetchDescriptor<DailyAssignment>(predicate: #Predicate { $0.date == date })
        let stale = try context.fetch(descriptor)
        for item in stale { context.delete(item) }

        // 寫入新的（含關聯 TaskItem）
        for dto in data.assignments + data.overdueTasks {
            let taskDesc = FetchDescriptor<TaskItem>(predicate: #Predicate { $0.serverId == dto.task.id })
            let taskItem: TaskItem
            if let existing = try context.fetch(taskDesc).first {
                existing.title = dto.task.title
                existing.desc = dto.task.description
                existing.updatedAt = dto.task.updatedAt
                existing.fetchedAt = now
                taskItem = existing
            } else {
                taskItem = TaskItem(
                    serverId: dto.task.id,
                    title: dto.task.title,
                    desc: dto.task.description,
                    tagIds: [],
                    createdAt: dto.task.createdAt,
                    updatedAt: dto.task.updatedAt,
                    fetchedAt: now
                )
                context.insert(taskItem)
            }

            let assignment = DailyAssignment(
                serverId: dto.id,
                date: dto.date,
                isCompleted: dto.isCompleted,
                sortOrder: dto.sortOrder,
                fetchedAt: now,
                task: taskItem
            )
            context.insert(assignment)
        }

        try context.save()
    }
}
```

- [ ] **Step 4: Run, confirm PASS**

- [ ] **Step 5: Commit**

```bash
cd /Users/mike/Documents/nudge
git add apple/NudgeKit/Sources/NudgeCore/TaskRepository.swift apple/NudgeKit/Tests/NudgeCoreTests/Phase2/TaskRepositoryTests.swift
git commit -m "$(cat <<'EOF'
feat(core): TaskRepository read — dailyData + weekSummary + cache write

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: TaskRepository — 寫（create/toggleComplete/reorder/moveToDate/archive/updateTitle/updateDescription）

**Files:**
- Modify: `apple/NudgeKit/Sources/NudgeCore/TaskRepository.swift`
- Modify: `apple/NudgeKit/Tests/NudgeCoreTests/Phase2/TaskRepositoryTests.swift`

- [ ] **Step 1: 寫 failing tests for write methods**

加到 `TaskRepositoryTests.swift`（新 `@Suite("TaskRepository.write", .serialized) @MainActor struct`）：
```swift
@Suite("TaskRepository.write", .serialized) @MainActor
struct TaskRepositoryWriteTests {
    func makeRepo(responseBody: String, status: Int = 200) -> (TaskRepository, ModelContainer, String) {
        // 上一段定義過 - 省略，直接複用工具邏輯
        MockURLProtocol.handler = { request in
            let data = responseBody.data(using: .utf8)!
            let response = HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil, headerFields: nil)!
            return (data, response)
        }
        let client = APIClient(
            configuration: APIConfiguration(baseURL: URL(string: "https://test.local")!),
            session: .mocked()
        )
        let container = NudgeModelContainer.makeInMemory()
        let repo = TaskRepository(client: client, container: container)
        return (repo, container, "2026-04-17")
    }

    @Test func createTaskPostsAndReturnsAssignment() async throws {
        let body = #"""
        {"id":"a1","taskId":"t1","date":"2026-04-17","isCompleted":false,"sortOrder":-1}
        """#
        let (repo, _, _) = makeRepo(responseBody: body, status: 201)
        let assignment = try await repo.createTask(date: "2026-04-17", title: "Buy milk")
        #expect(assignment.id == "a1")
    }

    @Test func toggleCompletePatches() async throws {
        let (repo, _, _) = makeRepo(responseBody: "{}")
        try await repo.toggleComplete(assignmentId: "a1", isCompleted: true, onDate: "2026-04-17")
        // 這個 API 回空 object；主要是不 throw
    }

    @Test func reorderPutsOrder() async throws {
        let (repo, _, _) = makeRepo(responseBody: "{}")
        try await repo.reorder(date: "2026-04-17", orderedIds: ["a1", "a2"])
    }

    @Test func archivePatchesStatus() async throws {
        let (repo, _, _) = makeRepo(responseBody: "{}")
        try await repo.archive(taskId: "t1")
    }

    @Test func updateTitlePatches() async throws {
        let (repo, _, _) = makeRepo(responseBody: "{}")
        try await repo.updateTitle(taskId: "t1", title: "New title")
    }
}
```

- [ ] **Step 2: Run, confirm FAIL**

- [ ] **Step 3: 實作寫方法，加到 `TaskRepository.swift` 底部**

```swift
extension TaskRepository {
    // MARK: - Write

    public func createTask(date: String, title: String) async throws -> DailyAssignmentDTO {
        struct Body: Codable { let title: String }
        let response: DailyAssignmentDTO = try await client.post(
            "/api/daily/\(date)/tasks",
            body: Body(title: title)
        )
        return response
    }

    public func toggleComplete(assignmentId: String, isCompleted: Bool, onDate: String) async throws {
        struct Body: Codable { let assignmentId: String; let isCompleted: Bool }
        try await client.postVoid(
            "/api/daily/\(onDate)/tasks",
            body: Body(assignmentId: assignmentId, isCompleted: isCompleted)
        )
    }

    public func reorder(date: String, orderedIds: [String]) async throws {
        struct ReorderItem: Codable { let id: String; let sortOrder: Int }
        struct Body: Codable { let order: [ReorderItem] }
        let order = orderedIds.enumerated().map { ReorderItem(id: $0.element, sortOrder: $0.offset) }
        try await client.postVoid(
            "/api/daily/\(date)/tasks/reorder",
            body: Body(order: order)
        )
    }

    public func moveToDate(assignmentId: String, from: String, to: String) async throws {
        struct Body: Codable { let assignmentId: String; let moveToDate: String }
        try await client.postVoid(
            "/api/daily/\(from)/tasks",
            body: Body(assignmentId: assignmentId, moveToDate: to)
        )
    }

    public func archive(taskId: String) async throws {
        struct Body: Codable { let status: String }
        try await client.postVoid(
            "/api/tasks/\(taskId)/status",
            body: Body(status: "archived")
        )
    }

    public func updateTitle(taskId: String, title: String) async throws {
        struct Body: Codable { let title: String }
        try await client.postVoid(
            "/api/tasks/\(taskId)",
            body: Body(title: title)
        )
    }

    public func updateDescription(taskId: String, description: String) async throws {
        struct Body: Codable { let description: String }
        try await client.postVoid(
            "/api/tasks/\(taskId)",
            body: Body(description: description)
        )
    }
}
```

**注意**：`toggleComplete / moveToDate` 實際是 **PATCH**，`reorder` 是 **PUT**，`updateTitle/Description` 是 **PATCH**。APIClient 目前只有 `postVoid`。**需要加 `patchVoid` 和 `putVoid` 方法**：

Edit `apple/NudgeKit/Sources/NudgeCore/APIClient.swift`，加：
```swift
public func patchVoid<Body: Encodable>(
    _ path: String,
    body: Body
) async throws {
    let request = try buildRequest(method: "PATCH", path: path, body: body)
    let _: Empty = try await perform(request)
}

public func putVoid<Body: Encodable>(
    _ path: String,
    body: Body
) async throws {
    let request = try buildRequest(method: "PUT", path: path, body: body)
    let _: Empty = try await perform(request)
}
```

把上面 write methods 裡的 `postVoid` 改為對應的 `patchVoid` / `putVoid`：
- `toggleComplete`、`moveToDate`：`client.patchVoid("/api/daily/\(date)/tasks", body: ...)`
- `reorder`：`client.putVoid("/api/daily/\(date)/tasks/reorder", body: ...)`
- `archive`：`client.patchVoid("/api/tasks/\(taskId)/status", body: ...)`
- `updateTitle/Description`：`client.patchVoid("/api/tasks/\(taskId)", body: ...)`

- [ ] **Step 4: Run, confirm PASS**

```bash
cd /Users/mike/Documents/nudge/apple/NudgeKit
swift test --filter TaskRepository --no-parallel
```
Expected: 所有 read + write tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/mike/Documents/nudge
git add apple/NudgeKit/Sources/NudgeCore/ apple/NudgeKit/Tests/NudgeCoreTests/Phase2/TaskRepositoryTests.swift
git commit -m "$(cat <<'EOF'
feat(core): TaskRepository write methods + APIClient PATCH/PUT

Added patchVoid/putVoid to APIClient. Repository has
create/toggleComplete/reorder/moveToDate/archive/updateTitle/updateDescription.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

# Block F：UI building blocks（逐一 TDD 不適用，用 build + manual visual check）

### Task 13: TaskRowView（任務單筆列）

**Files:**
- Create: `apple/NudgeKit/Sources/NudgeUI/Daily/TaskRowView.swift`

**說明**：單筆任務 row。checkbox + title + drag handle + 展開 icon。完成 task 淡出 + 刪除線。用 Color.nudgeXxx token。

- [ ] **Step 1: 實作 TaskRowView**

Create `apple/NudgeKit/Sources/NudgeUI/Daily/TaskRowView.swift`:
```swift
import SwiftUI
import NudgeCore

public struct TaskRowView: View {
    public let assignment: DailyAssignmentDTO
    public let onToggleComplete: () -> Void
    public let onTap: () -> Void
    public let onDetailTap: () -> Void

    public init(
        assignment: DailyAssignmentDTO,
        onToggleComplete: @escaping () -> Void,
        onTap: @escaping () -> Void,
        onDetailTap: @escaping () -> Void
    ) {
        self.assignment = assignment
        self.onToggleComplete = onToggleComplete
        self.onTap = onTap
        self.onDetailTap = onDetailTap
    }

    public var body: some View {
        HStack(spacing: 12) {
            // Checkbox
            Button(action: onToggleComplete) {
                Image(systemName: assignment.isCompleted ? "checkmark.circle.fill" : "circle")
                    .font(.title3)
                    .foregroundStyle(assignment.isCompleted ? Color.nudgePrimary : Color.nudgeTextDim)
            }
            .buttonStyle(.plain)

            // Title
            Text(assignment.task.title)
                .strikethrough(assignment.isCompleted)
                .foregroundStyle(assignment.isCompleted ? Color.nudgeTextDim : Color.nudgeForeground)
                .opacity(assignment.isCompleted ? 0.6 : 1.0)
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(Rectangle())
                .onTapGesture(perform: onTap)

            // Description indicator + tap opens detail
            if !assignment.task.description.isEmpty {
                Button(action: onDetailTap) {
                    Image(systemName: "text.alignleft")
                        .foregroundStyle(Color.nudgePrimary)
                }
                .buttonStyle(.plain)
            } else {
                Button(action: onDetailTap) {
                    Image(systemName: "chevron.right")
                        .foregroundStyle(Color.nudgeTextDim)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(Color.nudgeBackground)
    }
}
```

- [ ] **Step 2: Build 驗 compile**

```bash
cd /Users/mike/Documents/nudge/apple/NudgeKit
swift build
```
Expected: Build complete.

- [ ] **Step 3: Commit**

```bash
cd /Users/mike/Documents/nudge
git add apple/NudgeKit/Sources/NudgeUI/Daily/TaskRowView.swift
git commit -m "$(cat <<'EOF'
feat(ui): TaskRowView — checkbox + title + detail icon

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 14: TaskListView（任務列表 + 完成者排到底 + drag reorder）

**Files:**
- Create: `apple/NudgeKit/Sources/NudgeUI/Daily/TaskListView.swift`

**說明**：接收一組 `[DailyAssignmentDTO]`，完成的排到底。iOS `.onMove` enable reorder；macOS 用 `.draggable`/`.dropDestination` 在下一 task 實作。

- [ ] **Step 1: 實作 TaskListView**

Create `apple/NudgeKit/Sources/NudgeUI/Daily/TaskListView.swift`:
```swift
import SwiftUI
import NudgeCore

public struct TaskListView: View {
    public let assignments: [DailyAssignmentDTO]
    public let onToggleComplete: (DailyAssignmentDTO) -> Void
    public let onTap: (DailyAssignmentDTO) -> Void
    public let onDetailTap: (DailyAssignmentDTO) -> Void
    public let onMove: (IndexSet, Int) -> Void

    public init(
        assignments: [DailyAssignmentDTO],
        onToggleComplete: @escaping (DailyAssignmentDTO) -> Void,
        onTap: @escaping (DailyAssignmentDTO) -> Void,
        onDetailTap: @escaping (DailyAssignmentDTO) -> Void,
        onMove: @escaping (IndexSet, Int) -> Void
    ) {
        self.assignments = assignments
        self.onToggleComplete = onToggleComplete
        self.onTap = onTap
        self.onDetailTap = onDetailTap
        self.onMove = onMove
    }

    /// 完成的排到最後（沿用 Web 行為）。
    private var sorted: [DailyAssignmentDTO] {
        let pending = assignments.filter { !$0.isCompleted }.sorted { $0.sortOrder < $1.sortOrder }
        let done = assignments.filter { $0.isCompleted }.sorted { $0.sortOrder < $1.sortOrder }
        return pending + done
    }

    public var body: some View {
        List {
            ForEach(sorted, id: \.id) { assignment in
                TaskRowView(
                    assignment: assignment,
                    onToggleComplete: { onToggleComplete(assignment) },
                    onTap: { onTap(assignment) },
                    onDetailTap: { onDetailTap(assignment) }
                )
                .listRowInsets(EdgeInsets())
                .listRowBackground(Color.nudgeBackground)
            }
            .onMove(perform: onMove)
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .background(Color.nudgeBackground)
    }
}
```

- [ ] **Step 2: Build 驗 compile**

```bash
cd /Users/mike/Documents/nudge/apple/NudgeKit
swift build
```

- [ ] **Step 3: Commit**

```bash
cd /Users/mike/Documents/nudge
git add apple/NudgeKit/Sources/NudgeUI/Daily/TaskListView.swift
git commit -m "$(cat <<'EOF'
feat(ui): TaskListView — completed-last sort + onMove reorder hook

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 15: WeekStripView（週曆 bar）

**Files:**
- Create: `apple/NudgeKit/Sources/NudgeUI/Daily/WeekStripView.swift`

- [ ] **Step 1: 實作 WeekStripView**

Create `apple/NudgeKit/Sources/NudgeUI/Daily/WeekStripView.swift`:
```swift
import SwiftUI
import NudgeCore

public struct WeekStripView: View {
    public let selectedDate: String       // "YYYY-MM-DD"
    public let datesWithTasks: Set<String>
    public let onSelectDate: (String) -> Void
    public let onTapToday: () -> Void
    public let onWeekOffset: (Int) -> Void

    public init(
        selectedDate: String,
        datesWithTasks: Set<String>,
        onSelectDate: @escaping (String) -> Void,
        onTapToday: @escaping () -> Void,
        onWeekOffset: @escaping (Int) -> Void
    ) {
        self.selectedDate = selectedDate
        self.datesWithTasks = datesWithTasks
        self.onSelectDate = onSelectDate
        self.onTapToday = onTapToday
        self.onWeekOffset = onWeekOffset
    }

    public var body: some View {
        VStack(spacing: 8) {
            HStack {
                Button(action: { onWeekOffset(-1) }) {
                    Image(systemName: "chevron.left")
                }
                .buttonStyle(.plain)

                Spacer()

                Button(action: onTapToday) {
                    Text("daily.tasks.todayButton", bundle: .module)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(Color.nudgePrimary)
                }
                .buttonStyle(.plain)

                Spacer()

                Button(action: { onWeekOffset(1) }) {
                    Image(systemName: "chevron.right")
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 16)

            HStack(spacing: 4) {
                ForEach(currentWeekDates(), id: \.self) { dateString in
                    dayCell(dateString)
                }
            }
            .padding(.horizontal, 8)
        }
        .padding(.vertical, 12)
        .background(Color.nudgeBackground)
    }

    private func currentWeekDates() -> [String] {
        guard let date = DateFormatters.parseISODate(selectedDate) else { return [] }
        let startOfWeek = DateFormatters.startOfWeek(date)
        let calendar = Calendar(identifier: .gregorian)
        return (0..<7).compactMap { offset in
            calendar.date(byAdding: .day, value: offset, to: startOfWeek).map(DateFormatters.isoDate)
        }
    }

    @ViewBuilder
    private func dayCell(_ date: String) -> some View {
        let isSelected = date == selectedDate
        let hasTasks = datesWithTasks.contains(date)
        let dayNumber = date.split(separator: "-").last.map(String.init) ?? ""

        Button(action: { onSelectDate(date) }) {
            VStack(spacing: 4) {
                Text(weekdayKey(date))
                    .font(.caption2)
                    .foregroundStyle(Color.nudgeTextDim)
                Text(dayNumber)
                    .font(.headline)
                    .foregroundStyle(isSelected ? Color.nudgePrimaryForeground : Color.nudgeForeground)

                Circle()
                    .fill(hasTasks ? Color.nudgePrimary : Color.clear)
                    .frame(width: 4, height: 4)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
            .background(isSelected ? Color.nudgePrimary : Color.clear)
            .cornerRadius(8)
        }
        .buttonStyle(.plain)
    }

    private func weekdayKey(_ dateString: String) -> LocalizedStringKey {
        guard let date = DateFormatters.parseISODate(dateString) else { return "weekday.mon" }
        let calendar = Calendar(identifier: .gregorian)
        let weekday = calendar.component(.weekday, from: date)
        // 1 = Sun, 2 = Mon, ..., 7 = Sat
        let keys: [LocalizedStringKey] = [
            "weekday.sun", "weekday.mon", "weekday.tue", "weekday.wed",
            "weekday.thu", "weekday.fri", "weekday.sat"
        ]
        return keys[weekday - 1]
    }
}
```

- [ ] **Step 2: Build 驗**

- [ ] **Step 3: Commit**

```bash
cd /Users/mike/Documents/nudge
git add apple/NudgeKit/Sources/NudgeUI/Daily/WeekStripView.swift
git commit -m "$(cat <<'EOF'
feat(ui): WeekStripView — week bar with dots, today button, offset controls

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 16: CalendarSectionView（Google Calendar 當日事件 + 未連結 CTA）

**Files:**
- Create: `apple/NudgeKit/Sources/NudgeUI/Daily/CalendarSectionView.swift`

- [ ] **Step 1: 實作**

Create `apple/NudgeKit/Sources/NudgeUI/Daily/CalendarSectionView.swift`:
```swift
import SwiftUI
import NudgeCore

public struct CalendarSectionView: View {
    public let events: [CalendarEventDTO]
    public let isConnected: Bool
    public let onConnectTapped: () -> Void

    @State private var isExpanded: Bool = false

    public init(events: [CalendarEventDTO], isConnected: Bool, onConnectTapped: @escaping () -> Void) {
        self.events = events
        self.isConnected = isConnected
        self.onConnectTapped = onConnectTapped
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("calendar.panelTitle", bundle: .module)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Color.nudgeTextDim)
                Spacer()
                if isConnected && !events.isEmpty {
                    Button(action: { isExpanded.toggle() }) {
                        Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                            .foregroundStyle(Color.nudgeTextDim)
                    }
                    .buttonStyle(.plain)
                }
            }

            if !isConnected {
                Button(action: onConnectTapped) {
                    HStack {
                        Image(systemName: "calendar.badge.plus")
                        Text("calendar.connectCTA", bundle: .module)
                    }
                    .padding()
                    .frame(maxWidth: .infinity)
                    .background(Color.nudgePrimary.opacity(0.1))
                    .cornerRadius(8)
                }
                .buttonStyle(.plain)
            } else if events.isEmpty {
                Text("calendar.panelEmpty", bundle: .module)
                    .font(.footnote)
                    .foregroundStyle(Color.nudgeTextDim)
            } else if isExpanded {
                ForEach(events, id: \.id) { event in
                    eventRow(event)
                }
            } else {
                Text(verbatim: String(format: NSLocalizedString("calendar.mobileCollapsedCount", bundle: .module, comment: ""), events.count))
                    .font(.footnote)
                    .foregroundStyle(Color.nudgeTextDim)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(Color.nudgeBackground)
    }

    @ViewBuilder
    private func eventRow(_ event: CalendarEventDTO) -> some View {
        HStack {
            VStack(alignment: .leading) {
                Text(event.summary)
                    .font(.body)
                    .foregroundStyle(Color.nudgeForeground)
                HStack {
                    Text(timeRange(event))
                        .font(.caption)
                        .foregroundStyle(Color.nudgeTextDim)
                    if let location = event.location {
                        Text("·")
                        Text(location)
                            .font(.caption)
                            .foregroundStyle(Color.nudgeTextDim)
                            .lineLimit(1)
                    }
                }
            }
            Spacer()
        }
        .padding(.vertical, 4)
    }

    private func timeRange(_ event: CalendarEventDTO) -> String {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        return "\(formatter.string(from: event.start)) - \(formatter.string(from: event.end))"
    }
}
```

**注意**：`calendar.mobileCollapsedCount` key 在 Web 有，xcstrings 還沒加（Task 4 xcstrings 裡沒列）。**補加到 Task 4 的 xcstrings**，或在此 Task 開頭補加一個 step：

- [ ] **Step 1.5**: 在 `Localizable.xcstrings` 加入：
```json
"calendar.mobileCollapsedCount" : {
  "localizations" : {
    "zh-Hant" : { "stringUnit" : { "state" : "translated", "value" : "今日行程 · %d 件" } },
    "en" : { "stringUnit" : { "state" : "translated", "value" : "%d events today" } },
    "ja" : { "stringUnit" : { "state" : "translated", "value" : "今日の予定 · %d 件" } }
  }
}
```

- [ ] **Step 2: Build + Commit**

```bash
cd /Users/mike/Documents/nudge
git add apple/NudgeKit/Sources/NudgeUI/Daily/CalendarSectionView.swift apple/NudgeKit/Sources/NudgeCore/Resources/Localizable.xcstrings
git commit -m "$(cat <<'EOF'
feat(ui): CalendarSectionView — events list + connect CTA

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 17: OverdueSectionView

**Files:**
- Create: `apple/NudgeKit/Sources/NudgeUI/Daily/OverdueSectionView.swift`

- [ ] **Step 1: 實作**

Create `apple/NudgeKit/Sources/NudgeUI/Daily/OverdueSectionView.swift`:
```swift
import SwiftUI
import NudgeCore

public struct OverdueSectionView: View {
    public let overdueTasks: [DailyAssignmentDTO]
    public let onScheduleToday: (DailyAssignmentDTO) -> Void
    public let onMoveTo: (DailyAssignmentDTO) -> Void
    public let onArchive: (DailyAssignmentDTO) -> Void

    @State private var isExpanded: Bool = true

    public init(
        overdueTasks: [DailyAssignmentDTO],
        onScheduleToday: @escaping (DailyAssignmentDTO) -> Void,
        onMoveTo: @escaping (DailyAssignmentDTO) -> Void,
        onArchive: @escaping (DailyAssignmentDTO) -> Void
    ) {
        self.overdueTasks = overdueTasks
        self.onScheduleToday = onScheduleToday
        self.onMoveTo = onMoveTo
        self.onArchive = onArchive
    }

    public var body: some View {
        if overdueTasks.isEmpty {
            EmptyView()
        } else {
            VStack(alignment: .leading, spacing: 8) {
                Button(action: { isExpanded.toggle() }) {
                    HStack {
                        Image(systemName: isExpanded ? "chevron.down" : "chevron.right")
                            .font(.caption)
                        Text("daily.tasks.overdueSection", bundle: .module)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Color.nudgeChart5)   // 紅橘警示色
                        Text("(\(overdueTasks.count))")
                            .font(.caption)
                            .foregroundStyle(Color.nudgeTextDim)
                        Spacer()
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)

                if isExpanded {
                    ForEach(overdueTasks, id: \.id) { task in
                        overdueRow(task)
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .onAppear {
                // Weekend 預設收合
                let today = DateFormatters.isoDate(Date())
                if let date = DateFormatters.parseISODate(today),
                   DateFormatters.isWeekend(date) {
                    isExpanded = false
                }
            }
        }
    }

    @ViewBuilder
    private func overdueRow(_ task: DailyAssignmentDTO) -> some View {
        HStack {
            Circle()
                .fill(Color.nudgeChart5)
                .frame(width: 4, height: 4)
            Text(task.task.title)
                .foregroundStyle(Color.nudgeForeground)
            Spacer()
            Menu {
                Button(action: { onScheduleToday(task) }) {
                    Text("daily.tasks.overdueScheduleToday", bundle: .module)
                }
                Button(action: { onMoveTo(task) }) {
                    Text("daily.tasks.detailMoveTo", bundle: .module)
                }
                Button(role: .destructive, action: { onArchive(task) }) {
                    Text("daily.tasks.detailArchive", bundle: .module)
                }
            } label: {
                Image(systemName: "ellipsis")
                    .foregroundStyle(Color.nudgeTextDim)
            }
        }
        .padding(.vertical, 4)
    }
}
```

- [ ] **Step 2: Build + Commit**

```bash
cd /Users/mike/Documents/nudge
git add apple/NudgeKit/Sources/NudgeUI/Daily/OverdueSectionView.swift
git commit -m "$(cat <<'EOF'
feat(ui): OverdueSectionView — collapsible with schedule/move/archive menu

Weekend default collapsed. Menu per task.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 18: NewTaskInputView + MoveToDatePickerView + OfflineBannerView + TaskDetailView

這四個 view 相對簡單，可併一次 commit。

**Files:**
- Create: `apple/NudgeKit/Sources/NudgeUI/Daily/NewTaskInputView.swift`
- Create: `apple/NudgeKit/Sources/NudgeUI/Daily/MoveToDatePickerView.swift`
- Create: `apple/NudgeKit/Sources/NudgeUI/Daily/OfflineBannerView.swift`
- Create: `apple/NudgeKit/Sources/NudgeUI/Daily/TaskDetailView.swift`

- [ ] **Step 1: NewTaskInputView**

```swift
import SwiftUI
import NudgeCore

public struct NewTaskInputView: View {
    @State private var text: String = ""
    @FocusState private var isFocused: Bool
    public let onSubmit: (String) -> Void
    public let focusTrigger: () -> Bool?   // 給 macOS ⌘N 外部觸發焦點用

    public init(onSubmit: @escaping (String) -> Void, focusTrigger: @escaping () -> Bool? = { nil }) {
        self.onSubmit = onSubmit
        self.focusTrigger = focusTrigger
    }

    public var body: some View {
        HStack {
            TextField(text: $text) {
                Text("daily.tasks.newPlaceholder", bundle: .module)
            }
            .focused($isFocused)
            .textFieldStyle(.plain)
            .onSubmit {
                let trimmed = text.trimmingCharacters(in: .whitespaces)
                guard !trimmed.isEmpty else { return }
                onSubmit(trimmed)
                text = ""
            }
            .padding(12)
            .background(Color.nudgeBackground)
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(Color.nudgeBorder, lineWidth: 1)
            )
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
        }
        .background(Color.nudgeBackground)
    }
}
```

- [ ] **Step 2: MoveToDatePickerView**

```swift
import SwiftUI
import NudgeCore

public struct MoveToDatePickerView: View {
    @State private var pickedDate: Date = Date()
    public let initialDate: String
    public let onPick: (String) -> Void
    public let onCancel: () -> Void

    public init(initialDate: String, onPick: @escaping (String) -> Void, onCancel: @escaping () -> Void) {
        self.initialDate = initialDate
        self.onPick = onPick
        self.onCancel = onCancel
    }

    public var body: some View {
        VStack {
            DatePicker(
                "daily.tasks.detailMoveTo",
                selection: $pickedDate,
                displayedComponents: [.date]
            )
            .datePickerStyle(.graphical)
            .onAppear {
                if let d = DateFormatters.parseISODate(initialDate) {
                    pickedDate = d
                }
            }

            HStack {
                Button(action: onCancel) {
                    Text("common.cancel", bundle: .module)
                }
                Spacer()
                Button(action: {
                    onPick(DateFormatters.isoDate(pickedDate))
                }) {
                    Text("common.save", bundle: .module)
                        .fontWeight(.medium)
                }
            }
            .padding()
        }
        .padding()
    }
}
```

- [ ] **Step 3: OfflineBannerView**

```swift
import SwiftUI

public struct OfflineBannerView: View {
    public let lastUpdated: String

    public init(lastUpdated: String) {
        self.lastUpdated = lastUpdated
    }

    public var body: some View {
        HStack {
            Image(systemName: "wifi.slash")
                .foregroundStyle(Color.nudgeChart5)
            Text(verbatim: String(format: NSLocalizedString("offline.banner", bundle: .module, comment: ""), lastUpdated))
                .font(.footnote)
                .foregroundStyle(Color.nudgeForeground)
            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(Color.nudgeChart4.opacity(0.2))
    }
}
```

- [ ] **Step 4: TaskDetailView**

```swift
import SwiftUI
import NudgeCore

public struct TaskDetailView: View {
    public let assignment: DailyAssignmentDTO
    public let tags: [TagDTO]   // resolved from tagIds before passed in
    public let onUpdateTitle: (String) -> Void
    public let onUpdateDescription: (String) -> Void
    public let onMoveTo: () -> Void
    public let onArchive: () -> Void

    @State private var title: String
    @State private var description: String

    public init(
        assignment: DailyAssignmentDTO,
        tags: [TagDTO],
        onUpdateTitle: @escaping (String) -> Void,
        onUpdateDescription: @escaping (String) -> Void,
        onMoveTo: @escaping () -> Void,
        onArchive: @escaping () -> Void
    ) {
        self.assignment = assignment
        self.tags = tags
        self.onUpdateTitle = onUpdateTitle
        self.onUpdateDescription = onUpdateDescription
        self.onMoveTo = onMoveTo
        self.onArchive = onArchive
        _title = State(initialValue: assignment.task.title)
        _description = State(initialValue: assignment.task.description)
    }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                TextField("", text: $title)
                    .font(.title2.weight(.semibold))
                    .onSubmit { onUpdateTitle(title) }

                TextEditor(text: $description)
                    .frame(minHeight: 120)
                    .padding(8)
                    .background(Color.nudgeBackground)
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(Color.nudgeBorder, lineWidth: 1)
                    )
                    .onChange(of: description) { _, newValue in
                        onUpdateDescription(newValue)
                    }

                if !tags.isEmpty {
                    HStack {
                        ForEach(tags, id: \.id) { tag in
                            Text(tag.name)
                                .font(.caption)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(Color(hex: tag.color) ?? Color.nudgePrimary)
                                .cornerRadius(6)
                        }
                    }
                }

                Button(action: onMoveTo) {
                    HStack {
                        Image(systemName: "calendar")
                        Text("daily.tasks.detailMoveTo", bundle: .module)
                    }
                }
                .buttonStyle(.bordered)

                Button(role: .destructive, action: onArchive) {
                    HStack {
                        Image(systemName: "archivebox")
                        Text("daily.tasks.detailArchive", bundle: .module)
                    }
                }
                .buttonStyle(.borderedProminent)
            }
            .padding()
        }
        .background(Color.nudgeBackground)
    }
}

private extension Color {
    init?(hex: String) {
        let hex = hex.replacingOccurrences(of: "#", with: "")
        guard hex.count == 6,
              let value = UInt32(hex, radix: 16) else { return nil }
        let r = Double((value >> 16) & 0xff) / 255.0
        let g = Double((value >> 8) & 0xff) / 255.0
        let b = Double(value & 0xff) / 255.0
        self.init(red: r, green: g, blue: b)
    }
}
```

- [ ] **Step 5: Build + Commit 四個 view**

```bash
cd /Users/mike/Documents/nudge/apple/NudgeKit
swift build
```

```bash
cd /Users/mike/Documents/nudge
git add apple/NudgeKit/Sources/NudgeUI/Daily/NewTaskInputView.swift apple/NudgeKit/Sources/NudgeUI/Daily/MoveToDatePickerView.swift apple/NudgeKit/Sources/NudgeUI/Daily/OfflineBannerView.swift apple/NudgeKit/Sources/NudgeUI/Daily/TaskDetailView.swift
git commit -m "$(cat <<'EOF'
feat(ui): NewTaskInput, MoveToDatePicker, OfflineBanner, TaskDetail views

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

# Block G：Host view + platform integration

### Task 19: DailyHostView（根 view，整合所有子 view）

**Files:**
- Create: `apple/NudgeKit/Sources/NudgeUI/Daily/DailyHostView.swift`

**說明**：DailyHostView 是真正整合 Repository + 所有子 view 的「屋頂」。iOS 和 macOS 用 `#if os` 分歧 layout；共用資料獲取邏輯。

這個 Task 程式碼較長（~200+ 行），完整代碼會寫入檔案。關鍵邏輯：

1. `@State` 管 selectedDate、navigationPath、presentedDetail、moveSheetTarget、etc
2. `@Environment(TaskRepository.self)` 取 repo
3. `.task(id: selectedDate)` 觸發 dailyData 重拉
4. iOS: `NavigationStack` + `ScrollView` + NewTaskInputView 底部 fixed
5. macOS: 用 `HStack(CalendarSectionView, VStack(WeekStripView, OverdueSectionView, TaskListView, NewTaskInputView))`
6. 點任務 → iOS push，macOS 設 detail pane state

Create `apple/NudgeKit/Sources/NudgeUI/Daily/DailyHostView.swift` (詳細省略，長 ~300 行；實作者依上面描述 + 共用子 view 組合，沿用 Phase 1 的 `@Environment` 注入模式)。

- [ ] **Step 1: 實作**（實作者展開編寫，參考各子 view 接口）

- [ ] **Step 2: Build**
- [ ] **Step 3: Commit**

---

### Task 20: 更新 PlatformRootView 把「行動」tab 接 DailyHostView + 環境注入

**Files:**
- Modify: `apple/NudgeKit/Sources/NudgeUI/PlatformRootView.swift`

核心改動：
1. 把 `PlaceholderTab(title: "行動", ...)` 換成 `DailyHostView()`
2. Tab label 使用 `Text("nav.tasks", bundle: .module)`
3. iOS sidebar / TabView 換成 i18n key

- [ ] **Step 1-3**: 實作 + build + commit

---

### Task 21: iOS App entry — 注入 TaskRepository / TagRepository / CalendarRepository

**Files:**
- Modify: `apple/Nudge-iOS/NudgeiOSApp.swift`

加 Repository 建立 + `.environment` 注入；用 Task 8 的 `setUnauthorizedHandler` 接 auth.handleUnauthorized。

- [ ] Step 1-3

---

### Task 22: macOS App entry + Commands

**Files:**
- Modify: `apple/Nudge-macOS/NudgeMacApp.swift`
- Create: `apple/Nudge-macOS/Commands+macOS.swift`

macOS `.commands` block 實作 ⌘N、⌘→/⌘←、⌘T、⌥↑/⌥↓、⌘⌫、Space。用 `@FocusState` + NotificationCenter（或 `EnvironmentObject` 的 trigger flag）把按鍵事件傳給 DailyHostView。

- [ ] Step 1-3

---

### Task 23: SettingsView 擴展含 Google Calendar 連結

**Files:**
- Modify / Create: `apple/NudgeKit/Sources/NudgeUI/SettingsView.swift`

擴展原 SettingsPlaceholder：加「連結 Google Calendar」/「解除連結」按鈕，狀態從 CalendarRepository.isConnected 讀。連結 flow 打 `GET /api/calendar/connect` 取得 OAuth URL + 用 `ASWebAuthenticationSession` 開啟。

- [ ] Step 1-3

---

# Block H：Drag reorder + platform-specific interactions

### Task 24: macOS .draggable / .dropDestination 拖曳排序

**Files:** Modify `apple/NudgeKit/Sources/NudgeUI/Daily/TaskListView.swift` + `TaskRowView.swift`

macOS 用 `.draggable` 包 row、`.dropDestination` 接收 drop，計算新 sortOrder 呼叫 `onMove`。iOS `.onMove` 已內建。

- [ ] Step 1-3

---

### Task 25: iOS swipe actions

**Files:** Modify `TaskRowView.swift` 或 TaskListView

iOS 用 `.swipeActions(edge:)` on List row：leading = Archive，trailing = Move to date。

- [ ] Step 1-3

---

### Task 26: Context menu（iOS 長按 / macOS 右鍵）

**Files:** Modify `TaskRowView.swift`

```swift
.contextMenu {
    Button("完成") { onToggleComplete() }
    Button("移到…") { onMoveTo() }
    Button(role: .destructive) { onArchive() } label: { Text("封存") }
    Button("編輯") { onDetailTap() }
}
```

- [ ] Step 1-3

---

# Block I：手動驗收

### Task 27: 手動驗收 iOS + macOS

**Files:** 無 code change。對照 spec 的 16 項 checklist 全走過。

- [ ] iOS 全部 feature 跑過
- [ ] macOS 全部 feature 跑過
- [ ] Empty commit 記錄：

```bash
cd /Users/mike/Documents/nudge
git commit --allow-empty -m "$(cat <<'EOF'
chore(apple): Phase 2 manual verification passed

Verified on:
- iOS iPhone 17 Pro simulator
- macOS host

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2 Definition of Done

- `swift test --no-parallel` 全綠（新增 15+ test）
- iOS + macOS 兩端 16 項 checklist 全走過
- 所有 commit 都在 test 通過後才 commit
- Web + iOS + macOS 三端打同 server 資料一致
- Light + dark mode 兩邊顏色正確
- i18n zh-Hant / en / ja 三語切換 UI 文字都正確

## 後續

Phase 2 完後下一步：
- Phase 3（日誌）：Notes feature、WKWebView + Quill editor
- 或補 Phase 2 沒做的：離線寫入 queue、推播提醒

# App 進前景刷新日曆 + 修復編輯器 placeholder 不顯示

日期：2026-04-27
範圍：iOS（主要）、macOS（順帶）、Web（i18n 鏡像）
影響檔案：少量、定點修改

## 動機

兩個獨立但都屬「使用者第一眼會看到」的小問題，併成一份 spec 處理：

1. 將 App 切到背景幾小時/隔天回前景時，日曆 tab 還是顯示舊資料；要回切日期或檢視模式才會重抓。
2. 日誌 (`NotesCanvasView`) 與任務描述編輯器在 iOS / macOS 上 **完全沒有 placeholder**，空白頁讓使用者不知道可以做什麼。文案在 i18n 中其實有，但因 bug 從未下達到 WebView。

## 1. 日曆回前景時刷新

### 現況

`CalendarHostView` (`apple/NudgeKit/Sources/NudgeUI/Calendar/CalendarHostView.swift:58`) 用：

```swift
.task(id: rangeKey) { await reload() }
```

`rangeKey` 是 `mode|start|end`。`task(id:)` modifier 只在 view 第一次 appear、或 `id` 變動時才重跑。所以 App 切背景再回前景，日曆 events 不會重抓。

`NudgeiOSApp.swift:99-103` 已有 `scenePhase` observer，但只用來重排通知 (`rescheduleNotifications()`)，沒觸發任何 view 層的 reload。

### 設計

在 `CalendarHostView` 注入 `@Environment(\.scenePhase)`，加 `.onChange(of: scenePhase)`，當變 `.active` 時呼叫現有的 `reload()`。

```swift
@Environment(\.scenePhase) private var scenePhase

// 在 body 的 NavigationStack 上：
.onChange(of: scenePhase) { _, phase in
    if phase == .active {
        Task { await reload() }
    }
}
```

### 為何放在 view-level，不放在 App root

放 view-level 有兩個好處：

- **只有 Calendar tab mount 時才 reload**：使用者在 Daily / Notes tab 時不需要拉 events。
- **不用拉一個「全 App 都聽 scenePhase 然後分發給各 repo」的中央 dispatcher**：本次只有日曆有需求，做最小變動。

之後若 Daily / Notes 也要 foreground refresh，再考慮抽中央層。

### 邊界

- 第一次 launch：原本的 `.task(id: rangeKey)` 已經會抓，`.onChange` 不會被首次 active 觸發（onChange 只看後續變化），不會雙抓。
- iPad split-view inactive → active：會觸發 reload。可接受，使用者本來就期待回前景看到新資料。
- macOS：`Scene` 在 macOS 上同樣有 `scenePhase`，這段 code 不需要 `#if os(iOS)` 包，順帶一起得益。

### 不做

- 定時 polling
- pull-to-refresh
- 重抓 token / 重新 OAuth（與本次無關）

## 2. 修編輯器 placeholder bug

### 現況（三層共謀）

1. **JS bundle**：`apple/NudgeEditor/src/main.ts:286` 在模組載入時呼叫 `createEditor("")`，Placeholder extension 用空字串初始化 → `data-placeholder=""` → CSS `:before` 抓不到內容。
2. **JS API**：`NudgeEditorAPI` 只有 `setTheme` / `setLabels`，沒有 `setPlaceholder`。
3. **Swift 端**：`EditorCoordinator` (`apple/NudgeKit/Sources/NudgeUI/Components/EditorBridge.swift:75`) 把 `placeholder` 字串收下來存著，但從來沒下發給 webView。

CSS 規則本身是對的：`apple/NudgeKit/Sources/NudgeUI/Resources/Editor/editor.css:1`

```css
.ProseMirror .is-editor-empty:first-child:before {
    content: attr(data-placeholder);
    color: var(--nudge-text-dim);
    float: left;
    pointer-events: none;
    height: 0;
}
```

只要 `data-placeholder` 有東西就會顯示。

### 設計

比照現有 `setTheme` / `setLabels` 的下發 pattern。

#### JS（`apple/NudgeEditor/src/main.ts`）

`NudgeEditorAPI` 介面與實作各加一個方法：

```typescript
interface NudgeEditorAPI {
  // ... existing
  setPlaceholder(text: string): void;
}

const api: NudgeEditorAPI = {
  // ... existing
  setPlaceholder(text: string) {
    if (!editor) return;
    const ext = editor.extensionManager.extensions.find(
      (e) => e.name === "placeholder",
    );
    if (!ext) return;
    ext.options.placeholder = text;
    // Force ProseMirror to re-run decorations so the new attr is rendered.
    editor.view.dispatch(editor.state.tr);
  },
};
```

Build 完要重生 `apple/NudgeKit/Sources/NudgeUI/Resources/Editor/editor.js`（跑 `apple/NudgeEditor/build.sh`）。

#### Swift（`apple/NudgeKit/Sources/NudgeUI/Components/EditorBridge.swift`）

`EditorCoordinator` 加 `pushPlaceholder()`，在 `.ready` callback 內、`pushLabels()` 之後呼叫：

```swift
func pushPlaceholder() {
    guard isReady, let webView else { return }
    guard let data = try? JSONSerialization.data(
        withJSONObject: [placeholder], options: [.fragmentsAllowed]
    ),
          let json = String(data: data, encoding: .utf8) else { return }
    let arg = json.trimmingCharacters(in: CharacterSet(charactersIn: "[]"))
    webView.evaluateJavaScript("NudgeEditor.setPlaceholder(\(arg))")
}
```

在 `.ready` 訊息處理內：

```swift
case .ready:
    // ...
    isReady = true
    pushLabels()
    pushPlaceholder()  // ← 新增
    if let scheme = currentScheme { pushTheme(scheme: scheme) }
    // ...
```

placeholder 在 RichTextEditor init 時已經傳給 coordinator（line 109），所以這裡直接讀 `self.placeholder` 即可。

### 影響範圍

`RichTextEditor` 目前 4 處被呼叫：

| 檔案 | 用途 | placeholder key |
|------|------|----------------|
| `Notes/NotesCanvasView.swift:49` | 日誌 | `notes.canvasPlaceholder` |
| `Cards/CardDetailView.swift:165` | 卡片詳情描述 | `cardDetail.editorPlaceholder` |
| `Daily/DailyHostView.swift:1289` | Daily 任務描述 | `cardDetail.editorPlaceholder` |
| `Daily/TaskPopoverView.swift:160` | Popover 任務描述 | `cardDetail.editorPlaceholder` |

四處都會自動受惠，不需另外改 call site。

### 邊界

- placeholder 在 editor 有內容時自動隱藏（TipTap Placeholder extension 標準行為，靠 `is-editor-empty` class 切換）。
- 切換不同日期/卡片時，因 `RichTextEditor.id(date)` / `.id(card.id)` 強制 remount，每次都會走 `.ready` → `pushPlaceholder()`，placeholder 會正確重設。

## 3. 文案調整

### 三邊對齊原則（依 AGENTS.md）

> **先查 Web 有沒有；有就沿用，沒有才在 Web 新增再 mirror。**

`notes.canvasPlaceholder` 與 `cardDetail.editorPlaceholder` Web 都已存在，所以三邊文案都更新（一起換掉，不保留舊文案）。

### 文案決策

| Key | zh-TW（新） | ja（新） | en（新） |
|-----|------------|---------|---------|
| `notes.canvasPlaceholder` | 今天怎麼樣？ | 今日はどうでしたか？ | How was your day? |
| `cardDetail.editorPlaceholder` | 補充細節⋯⋯ | 詳細を追加... | Add details... |

舊文案（會被取代）：

- `notes.canvasPlaceholder` 舊：「寫點什麼⋯⋯」/「何か書いてみましょう...」/「Write something...」— 太空泛。
- `cardDetail.editorPlaceholder` 舊：「打 / 插入標題、清單…」/「/ を入力して見出しやリストを挿入…」/「Type / to insert headings, lists…」— **誤導**：iOS 編輯器目前 slash command 還是 disabled (`apple/NudgeEditor/src/main.ts:146-150`)，使用者打 `/` 沒反應。

### 已知邊界（spec 階段已被使用者接受）

- 日誌的「今天怎麼樣？」在使用者瀏覽過往日期且該日空白時，文字上會略不一致（指的是過去那一天）。實務上 `NotesFeedView` 只列已存在的日記，幾乎走不到「過往日期 + 空白」這條 path，**接受邊界、不為它另起一個 i18n key**。

### 更新位置

#### Web

- `src/messages/zh-TW.json`：`notes.canvasPlaceholder`、`cardDetail.editorPlaceholder`
- `src/messages/ja.json`：同上
- `src/messages/en.json`：同上

#### iOS / macOS

- `apple/NudgeKit/Sources/NudgeUI/Resources/Localizable.xcstrings`：
  - `notes.canvasPlaceholder` → 三語 localization 全更新
  - `cardDetail.editorPlaceholder` → 三語 localization 全更新

## 測試計畫（Definition of Done）

依專案 AGENTS.md 與全域 memory「Swift 改動後 build + install + relaunch sim」：

### 編譯

- [ ] `apple/NudgeEditor/build.sh` 跑過、產出新 `editor.js`
- [ ] `xcodebuild -scheme Nudge-iOS ... build` 通過（不僅 `swift build`）
- [ ] `xcodebuild -scheme Nudge-macOS ... build` 通過

### iOS 模擬器實測

- [ ] 開 App、第一次進日曆 tab：看到今天的 events
- [ ] 把 App 切到背景、等 30 秒、回前景：日曆 events 重抓（看 console log `[CalendarHost] reload`）
- [ ] 進日誌 tab、空白頁：看到 placeholder「今天怎麼樣？」
- [ ] 在日誌打字：placeholder 消失
- [ ] 清空日誌內容：placeholder 重新出現
- [ ] 點 Daily 任務、開啟描述編輯器（空白）：看到 placeholder「補充細節⋯⋯」
- [ ] 切語言到 ja / en，重複以上：placeholder 文字隨之變化

### macOS 實測

- [ ] 日誌 / 卡片描述 placeholder 顯示正確
- [ ] 日曆 tab 切換 App 不同 window focus → focus 回 Nudge：events reload（macOS scenePhase 行為）

### Web

- [ ] `npx next build` 通過
- [ ] 日誌頁面打開空白：placeholder 顯示新文案
- [ ] 任務描述編輯器空白：placeholder 顯示新文案
- [ ] 三語切換無誤

## 不在範圍

- 定時 polling 日曆、pull-to-refresh
- iOS slash-command extension 重啟用（另案 — 本次只是不再「廣告」它）
- Daily / Notes tab 的 foreground refresh（非本次需求）
- Placeholder 依時段／是否第一次寫等情境變化（D 方向，使用者選 B）

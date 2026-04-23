# iOS / macOS TipTap Rich-Text Editor 設計文件

**Date**: 2026-04-23
**Status**: 設計定稿，待實作計畫
**Scope**: iOS + macOS `CardDetailView` 富文本編輯體驗升級

---

## 目標

把目前 `apple/NudgeKit/Sources/NudgeUI/Components/RichTextEditor.swift` 基於 `NSAttributedString` HTML roundtrip 的實作，替換成 **WKWebView 嵌 TipTap** 架構，達成：

1. **Web 功能 100% 對齊**：支援 H1/H2/H3、項目符號、數字清單、checkbox、code block、slash command、block drag — iOS / macOS / Web 三端輸出 HTML byte-identical。
2. **行動端手感接近 Heptabase**：順暢捲動、鍵盤上方 toolbar、native 選字選單、無明顯 web view 感。
3. **Offline-first**：Editor bundle 裝進 app，不依賴 server。

## 非目標

- 取代任務列 `TaskRowView` 或其他非 Card 場域的文字編輯
- 手寫筆 / 繪圖 / 嵌入附件 / 圖片貼上（留待後續 phase）
- 多人協作 cursors（目前 app 無此需求）
- 改變 server 儲存格式（仍為 HTML string）

---

## 架構

### 分層

```
┌─────────────────────────────────────────────────┐
│  Swift SwiftUI wrapper (RichTextEditor.swift)   │ ← Binding<String> html
│  + EditorToolbar.swift (7 按鈕，鍵盤上方 / macOS 頂)│
└──────────────────┬──────────────────────────────┘
                   │ WKWebView
                   │ evaluateJavaScript / WKScriptMessageHandler
┌──────────────────┴──────────────────────────────┐
│  editor.html + bridge.ts                        │
│  window.NudgeEditor = { load, getHTML, exec,    │
│                         focus, setTheme }       │
└──────────────────┬──────────────────────────────┘
                   │ TipTap commands
┌──────────────────┴──────────────────────────────┐
│  TipTap (共用 src/components/editor/* 既有 ext)  │
│  StarterKit + TaskList + Placeholder            │
│  + SplitTaskList + SlashCommand                 │
└─────────────────────────────────────────────────┘
```

### 檔案結構

```
/apple/NudgeEditor/                    ← 新增，獨立 Vite 子專案
  package.json                         (依賴 @tiptap/core 等)
  vite.config.ts                       (output: 單檔 bundle)
  index.html                           (entry, body 只一個 #editor div)
  src/
    main.ts                            (TipTap init + window.NudgeEditor 掛)
    bridge.ts                          (native↔JS message glue)
    theme.css                          (Nudge CSS vars 配置)
    slash-menu.ts                      (iOS 用的 plain-DOM slash menu)
  build.sh                             (vite build + 複製 dist → NudgeKit Resources)
  .gitignore                           (node_modules/, dist/)
  README.md                            (build 說明 + 與 web 的共用關係)

/apple/NudgeKit/Sources/NudgeUI/
  Resources/Editor/                    ← 由 build.sh 產生，gitignored
    editor.html
    editor.js
    editor.css
  Components/
    RichTextEditor.swift               ← 改寫（WKWebView 版）
    EditorToolbar.swift                ← 新增

/src/components/editor/                ← 既有，Vite 子專案透過 relative import 引用
  editor-extensions.ts
  slash-command-extension.ts
  slash-command-items.ts
  (不改動 web 側)
```

### 共用策略

`apple/NudgeEditor/src/main.ts` 以 **relative import** 直接引用既有 `src/components/editor/*`：

```ts
import { createEditorExtensions } from "../../../src/components/editor/editor-extensions";
```

Web 側 React-specific 的部分（`@tiptap/react`、`ReactNodeViewRenderer`、`useSlashCommandItems`）**不進 iOS bundle**。iOS 版用 `@tiptap/core` + `EditorView` 裸建、slash menu 以 plain DOM 實作（在 `apple/NudgeEditor/src/slash-menu.ts`）。

`createEditorExtensions()` 的 `slashItems` 參數改成純資料（不含 React component），iOS / web 兩邊各自渲染。

---

## Module 職責

### `apple/NudgeEditor/src/main.ts`

- 建 TipTap `Editor` 實例
- 掛到 `#editor` div
- 暴露 `window.NudgeEditor` 命名空間給 Swift 呼叫：
  - `load(html: string)` — setContent（不觸發 onUpdate）
  - `getHTML(): string`
  - `exec(command: string, args?: object)` — 執行 TipTap command（`toggleHeading` / `toggleBulletList` / `toggleOrderedList` / `toggleTaskList` / `undo` / `redo` / `blur`）
  - `focus()`
  - `setTheme(tokens: Record<string, string>)` — 寫 `:root` CSS vars
- 綁 TipTap event，透過 `bridge.ts` 回報給 Swift

### `apple/NudgeEditor/src/bridge.ts`

Native ↔ JS 訊息 glue。

**JS → Native** (`window.webkit.messageHandlers.editor.postMessage`)：
- `{kind: "change", html}` — onUpdate 時
- `{kind: "selection", active: {heading?: 1|2|3, bulletList?: bool, orderedList?: bool, taskList?: bool}}` — 游標位置改變 / selection 改變
- `{kind: "height", value}` — content resize（for auto-sizing frame）
- `{kind: "focus", focused: bool}`
- `{kind: "ready"}` — bundle 載入完成，可以 load content

**Native → JS**：透過 `evaluateJavaScript` 直接呼叫 `NudgeEditor.*`。

### `apple/NudgeKit/Sources/NudgeUI/Components/RichTextEditor.swift`（改寫）

公開 API **不變**，`CardDetailView` 呼叫方式不用改：

```swift
public struct RichTextEditor: View {
    @Binding var html: String
    let placeholder: String
    public init(html: Binding<String>, placeholder: String = "")
}
```

內部改為：
- iOS: `UIViewRepresentable` 包 `WKWebView`
- macOS: `NSViewRepresentable` 包 `WKWebView`
- `Coordinator` 實作 `WKScriptMessageHandler`、管 ready / theme / focus 狀態

移除：
- `HTMLAttributed` enum
- `UIKitRichTextEditor` struct
- `AppKitRichTextEditor` struct

### `apple/NudgeKit/Sources/NudgeUI/Components/EditorToolbar.swift`（新增）

SwiftUI view，7 個按鈕（見下）。

Props:
```swift
struct EditorToolbar: View {
    let activeMarks: ActiveMarks  // 當前 selection 的格式狀態
    let onCommand: (EditorCommand) -> Void
    let onDismissKeyboard: () -> Void
}

struct ActiveMarks: Equatable {
    var heading: Int?       // 1/2/3 or nil
    var bulletList = false
    var orderedList = false
    var taskList = false
    var canUndo = false
    var canRedo = false
}

enum EditorCommand {
    case undo, redo
    case toggleHeading  // 循環 H1→H2→H3→body
    case toggleBulletList, toggleOrderedList, toggleTaskList
}
```

---

## Data Flow

### 初始 load

```
1. CardDetailView 建 RichTextEditor(html: $descriptionHTML, ...)
2. Wrapper makeUIView: 建 WKWebView, 設 scriptMessageHandler
3. webView.loadFileURL(editor.html, ...) (bundle resource)
4. editor.html DOMContentLoaded → main.ts 建 Editor →
   bridge.postMessage({kind:"ready"})
5. Coordinator 收到 ready → evaluateJavaScript(
      "NudgeEditor.setTheme(<tokens>)"
   ) then "NudgeEditor.load(<escaped html>)"
```

### 使用者輸入

```
TipTap onUpdate → bridge.postMessage({kind:"change", html})
→ WKScriptMessageHandler didReceive → 
   coordinator.lastEmittedHTML = html
   parent.html = html  (updates @Binding)
→ Binding 傳到 CardDetailView → debouncedSaveDescription(html)
→ 0.5s 後 PATCH /api/tasks/{id}
```

### Swift 側觸發格式

```
Toolbar H1 tap → onCommand(.toggleHeading)
→ RichTextEditor Coordinator → 
   evaluateJavaScript("NudgeEditor.exec('toggleHeading', {level: 1})")
→ main.ts → editor.chain().focus().toggleHeading({level: 1}).run()
→ onUpdate → change event → parent.html 更新
```

### Selection 狀態 → Toolbar 高亮

```
TipTap onSelectionUpdate / onUpdate → bridge 計算 activeMarks
→ postMessage({kind:"selection", active: {...}})
→ Coordinator 更新 @State activeMarks
→ EditorToolbar re-render 時用 activeMarks 決定哪顆按鈕高亮
```

---

## Theme 注入

### `theme.css` 設計

所有顏色值用 CSS 變數：

```css
:root {
    --nudge-background: #ffffff;      /* default, overridden by setTheme */
    --nudge-foreground: #1a1a1a;
    --nudge-primary: #8b6f47;
    --nudge-text-dim: #8a8a8a;
    --nudge-border: #d0d0d0;
    --nudge-border-light: #e0e0e0;
}

body {
    background: var(--nudge-background);
    color: var(--nudge-foreground);
    font-family: -apple-system, BlinkMacSystemFont, ...;
}

h1, h2, h3 { color: var(--nudge-foreground); }
ul[data-type="taskList"] li[data-checked="true"] { color: var(--nudge-text-dim); }
/* ... */
```

### Swift 側同步

`RichTextEditor.swift` 的 Coordinator：

```swift
@MainActor
func syncTheme(colorScheme: ColorScheme) {
    let tokens: [String: String] = [
        "background": Color.nudgeBackground.cssHex(for: colorScheme),
        "foreground": Color.nudgeForeground.cssHex(for: colorScheme),
        "primary": Color.nudgePrimary.cssHex(for: colorScheme),
        "textDim": Color.nudgeTextDim.cssHex(for: colorScheme),
        "border": Color.nudgeBorder.cssHex(for: colorScheme),
        "borderLight": Color.nudgeBorderLight.cssHex(for: colorScheme),
    ]
    let json = try! JSONSerialization.data(withJSONObject: tokens)
    let js = "NudgeEditor.setTheme(\(String(data: json, encoding: .utf8)!))"
    webView.evaluateJavaScript(js)
}
```

`Color.cssHex(for:)` 是新增 helper，把 Color token 解析成 `#RRGGBB`。

觸發時機：
- `onAppear`
- `.onChange(of: colorScheme)` — 系統切換深色模式
- `.onChange(of: Environment(\.nudgeTheme))` — 未來如果加 app-level theme

---

## Toolbar 設計

### iOS

鍵盤上方用 SwiftUI `.safeAreaInset(edge: .bottom)` 疊加，而非 UIKit `inputAccessoryView`（後者 WKWebView 客製困難）。透過 keyboard observer 偵測鍵盤可見性決定 toolbar 顯示 / 隱藏。

**按鈕順序**（左到右）：

```
[↶ undo] [↷ redo] │ [Aa 標題*] [•] [1.] [☑] │ ─────── [⌨︎ 收鍵盤]
```

- `↶ undo` (`arrow.uturn.backward`) — disabled 若 canUndo=false
- `↷ redo` (`arrow.uturn.forward`) — disabled 若 canRedo=false
- divider（`Divider()`）
- `Aa` 標題循環（`textformat.size`）— tap 順序：body → H1 → H2 → H3 → body；activeMarks.heading 呈現當前狀態（顯示 "Aa₁" / "Aa₂" / "Aa₃"）
- `•` 項目符號（`list.bullet`）— activeMarks.bulletList 時高亮
- `1.` 數字清單（`list.number`）
- `☑` checkbox（`checkmark.square`）
- Spacer
- `⌨︎⇩` 收鍵盤（`keyboard.chevron.compact.down`）

每顆 44×44 hit target（遵守 AGENTS.md 的設計系統規範），icon 用 SF Symbols。顏色：正常 `.nudgeTextDim`、active / 高亮 `.nudgePrimary`、disabled 50% opacity。

粗體 / 斜體 / 底線 **不放 toolbar** — 走 iOS 系統選字選單（長按 / 雙擊選字彈出 Copy / Paste / B I U 那排）。

### macOS

detail view 頂端水平 bar（不是鍵盤上方，macOS 沒鍵盤概念）。同一套按鈕，排列一致。

按鍵 shortcut：TipTap StarterKit 內建以下，不需額外處理：
- `Cmd+B` 粗體、`Cmd+I` 斜體
- `Cmd+Z` / `Cmd+Shift+Z` undo/redo
- `Cmd+Alt+1/2/3` H1/H2/H3
- `Cmd+Shift+7` 數字清單、`Cmd+Shift+8` 項目符號

---

## 鍵盤處理

### iOS

1. **WKWebView 自身的 scroll 禁用**：`webView.scrollView.isScrollEnabled = false`、`bounces = false`
2. **Content 自動長高**：`main.ts` 用 `ResizeObserver` 偵測 body scrollHeight → bridge `{kind:"height", value}` → Swift `.frame(height: measuredHeight)` → 外層 `ScrollView` 接手所有捲動
3. **鍵盤避讓**：SwiftUI ScrollView 在 iOS 16+ 自動有 keyboard avoidance；CardDetailView 本來就是 ScrollView，無需額外處理
4. **焦點追蹤**：TipTap focus event → bridge `{kind:"focus", focused:true}` → Coordinator 通知 CardDetailView 可能 scroll 到可見區

### macOS

無鍵盤概念，直接 `webView.scrollView.isScrollEnabled = false` + auto-height 同上，外層 `NSScrollView` 管捲動。

---

## Slash command

iOS 版 slash menu 用 plain DOM 實作（`apple/NudgeEditor/src/slash-menu.ts`）：

- TipTap 的 `SlashCommandExtension`（既有）偵測到 `/` + 輸入時 call render
- iOS 版 render 是 plain DOM：`<div class="slash-menu">` 絕對定位在 cursor 下方，列出 items
- 鍵盤可見時 positioning 要考量鍵盤高度（bridge 傳給 main.ts）
- 每個 item click → 執行對應 TipTap command → 關 menu
- Items：Heading 1 / 2 / 3、Bullet list、Numbered list、Task list、Code block、Divider（和 web 同步 — slash items 資料從 `src/components/editor/slash-command-items.ts` import，React 部分剔除）

---

## 舊內容相容

由 TipTap DOM parser 自動處理：
- `<p>`、`<strong>`、`<em>`、`<b>`、`<i>`、`<u>`、`<ul>`、`<li>`、`<a href>` — 全部保留
- `<span style="font-size: 20px">` 之類 inline style — 丟掉（ProseMirror schema 不支援任意字體大小）
- 整段 `<p style="margin: 0; font-family: ...">` — style 丟、`<p>` 結構保留
- `<font color=...>` — 丟

使用者第一次編輯儲存後，HTML 自動變 clean TipTap 格式。

**風險緩解**：
- 切換前先在 dev 帳號做一輪真實資料測試
- server 先 dump 一份 full backup（SQL export）
- 上線後加個 feature flag（`ENABLE_TIPTAP_EDITOR`）供萬一需要 rollback

---

## 測試策略

### 自動化

- **既有 Vitest 測試**：`SplitTaskList`、slash-command-extension 的邏輯測試在 web 側已有，iOS 共用同一份 source，不需複製
- **Vite build smoke test**：CI 加一步 `cd apple/NudgeEditor && ./build.sh`，確保 bundle 建得起來、沒 type error
- **Swift side**：`RichTextEditor.swift` wrapper 主要是 WebView glue，很難 unit test；依賴 manual DoD

### Manual DoD

iOS + macOS 各一輪，依序驗證：

1. 開舊卡片（存有 verbose NSAttributedString HTML）→ 內文正確渲染、粗體 / 斜體等保留
2. Toolbar H1 → 當前段變 H1；連按 → H1 → H2 → H3 → body 循環
3. Toolbar 項目符號 / 數字清單 / checkbox → block 切換正確
4. 輸入 `/` → slash menu 出現在 cursor 下方；選 checkbox → 變 checkbox
5. checkbox 輸入內容按 Enter → 新建下一個 checkbox（不是 nested list）
6. 空 checkbox 按 Enter → 退回 paragraph
7. 選字長按 → 系統 B I U 選單出現；套用 → 格式正確
8. 切換深色模式 → editor 背景 / 文字 / 游標色即時更新
9. 儲存後 web 打開 → HTML 結構和 web 原生輸出一致（visual diff 相同）
10. 飛航模式 → 開卡片、編輯可用（PATCH queue 等網，UI 無卡住）
11. Rotate 旋轉 → layout 不壞，toolbar 跟著鍵盤
12. 長內容（10+ 頁）→ 捲動流暢，無明顯 lag
13. iOS：鍵盤彈出/收起 → cursor 永遠在可見區
14. macOS：`Cmd+B` / `Cmd+Alt+1` 等 shortcut 有效
15. Undo / Redo → state 正確回復
16. Undo disabled 狀態（開卡片剛 load）→ 按鈕 50% opacity

---

## 風險與對策

| 風險 | 可能性 | 影響 | 對策 |
|------|--------|------|------|
| Vite + 跨目錄 import (`../../src/components/editor/`) 卡 resolver | 中 | 實作時間 +2 天 | 第一階段先做 proof-of-concept 成功引用 `editor-extensions.ts`；失敗就改 pnpm workspace 或 `file:../../src` dep |
| WKWebView 鍵盤頂掉內容 / cursor 跑位 | 中 | UX 差 | WKWebView `isScrollEnabled=false` + 外層 SwiftUI ScrollView；若 iOS 鍵盤 avoidance 不夠，補 `keyboardHeightPublisher` 主動 scroll |
| 舊 `NSAttributedString` HTML 某些樣式 TipTap 不認 | 低 | 個別卡片丟樣式 | Dev 帳號 pilot；DB 先備份；加 feature flag 可 rollback |
| Bundle 尺寸超 500KB | 低 | app size 漲 | TipTap core + ext 大約 200-300KB gzipped；若超標可用 tree-shaking / 拿掉 lowlight 語法 lib |
| 每次 web editor 改動要 rebuild iOS editor bundle | 中 | 維護成本 | `build.sh` + CI pre-commit hook check bundle 是否最新；README 寫清楚流程 |
| iOS slash menu positioning bug（鍵盤遮住） | 中 | UX | main.ts 算 `visualViewport.height`，menu 在鍵盤遮蔽時往上翻 |
| TipTap 在 WKWebView 長按選字觸發 iOS 原生選單有 conflict | 中 | 選字體驗差 | editor.css 設 `-webkit-touch-callout: default` 和 `-webkit-user-select: text`；測試後微調 |
| Focus 切換（app background/foreground）丟 cursor 位置 | 低 | 小 | 記 selection state，`applicationDidBecomeActive` 時 restore |

---

## Rollout 計畫（概略，實作計畫細化）

1. **Phase 1**: Vite sub-project scaffold + build.sh + 能 import 既有 `editor-extensions.ts`
2. **Phase 2**: `editor.html` + `main.ts` + bridge，在瀏覽器直接開能跑
3. **Phase 3**: Swift `RichTextEditor.swift` 改寫為 WKWebView wrapper，跑 load/change flow
4. **Phase 4**: Theme 注入 + placeholder
5. **Phase 5**: `EditorToolbar.swift` + activeMarks wire-up（command → JS）
6. **Phase 6**: Slash menu plain-DOM 實作
7. **Phase 7**: Manual DoD + 修 bug
8. **Phase 8**: CI bundle build smoke test + README

---

## Definition of Done

- 全部 Manual DoD 清單通過
- iOS + macOS build 無 warning
- Vite bundle CI smoke test 通過
- Dev 帳號 pilot 一週，舊卡片無異常回報
- 從 web 看 iOS 存的 HTML，和 web 自己存的 byte-identical（用 visual diff 工具）
- App size delta < 500KB

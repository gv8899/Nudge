# Handoff: Mac Daily 分隔線 resize 游標不出現

## 症狀（已由使用者實機確認）
- macOS「今天/任務」頁，任務清單 ↔ 右側面板之間的垂直分隔線（`ResizeHandle`）。
- **可以正常拖曳改欄寬**（hit-testing 沒問題）。
- **但 ↔ resize 游標不會穩定出現**：
  - 原始 `.onHover { NSCursor.set() }` 版：游標「偶爾才出現、感應區感覺很小」。
  - 換 `.pointerStyle` 版：游標**完全不出現**。
  - 關鍵觀察：**拖曳當下游標會穩定顯示；純 hover 時會「閃一下又變回箭頭」**。
  - 用紅色 debug 塗滿感應區確認：**滑到紅色感應區正中央，游標仍是箭頭**（→ 不是位置/寬度問題）。
- **對照組**：完全相同的 `ResizeHandle` 元件用在 **Notes**（`NotesFeedView.macOSLayout`）分隔線上**是正常的**。

## 已確認的機制（高信心）
競爭者在 **AppKit 權威的 `cursorUpdate` 步驟**贏過我們。`cursorUpdate` 在所有 SwiftUI 宣告式游標設定「之後」跑，所以任何 SwiftUI 層的做法都會被它蓋掉；拖曳時因為沒有 `cursorUpdate`，我們的 set 才會 stick。競爭者極可能是這一區底下某個 **WKWebView 的 tracking area**（卡片編輯器 `RichTextEditor`/`AppKitEditor` 是 WKWebView；而且 `MacSidebarRoot` 用 ZStack **常駐 mount 全部 5 個分頁**，inactive 分頁的 WKWebView 雖 `opacity(0)`+`allowsHitTesting(false)`，但那**不會**移除它的 NSView / tracking area）。

## 已經試過、全部失敗（請勿重試）
1. `.onHover { NSCursor.resizeLeftRight.set() / .arrow.set() }` — 原始寫法，flaky。
2. 自製 `NSViewRepresentable` cursor-rect（`addCursorRect`/`resetCursorRects`）— 游標完全不出現。
3. macOS 15 原生 `.pointerStyle(.columnResize)`（SDK 確認存在、@available(macOS 15)）— 完全不出現。
4. `.onContinuousHover` 每個 move 重新 `NSCursor.set()` — hover 仍閃回箭頭（輸 cursorUpdate）。
5. 把 handle 移出 `.clipped()`/`.blur()` 的 rasterize 子樹、改用 `.overlay` 畫（理由：clipped/blur 會 rasterize 掉 pointer region）— 游標開始「接近時出現、更近變回箭頭」，代表**不只是 rasterize** 的問題。
6. 加寬感應區 8pt→20pt→40pt、`.trailing`/置中對齊、`.offset` 讓 handle straddle seam — 無效（正中央仍箭頭）。
7. 把 `.blur(radius:0)` 改成條件式（只在 dim 時掛）— 無效（`.clipped()` 是第二個 rasterizer，但這條也不是根因）。
8. **`NSViewRepresentable` + `NSTrackingArea(.cursorUpdate)` override `cursorUpdate` 直接 set resize，drag 也用同一個 NSView 的 mouse events** — **仍然無效**。這點很重要：連「自己當 cursorUpdate owner」都沒贏，代表那個 overlay NSView **可能根本沒被當成 hit view / 沒收到 cursorUpdate**（SwiftUI 對 NSViewRepresentable 在 overlay 的 hosting 方式，或競爭者的 tracking area 在 AppKit 階層更上層）。

## 建議下一步（不要再盲測改 code → 丟 build）
1. **開 Xcode View Debugger**（或 `Debug View Hierarchy`）實際看這一區的 **NSView 階層**：哪個 WKWebView / 哪個 tracking area 蓋在分隔線 x 上、它跟我們的 handle 誰在上層。
2. 驗證假設：把 `MacSidebarRoot` inactive 分頁（尤其含 WKWebView 的 Cards/Notes）暫時 **完全不 mount**（不是 opacity 0），看 Daily 分隔線游標是否恢復 → 若恢復，root cause = 常駐 WKWebView 的 tracking area。
3. 若確認是 WKWebView：讓 inactive/覆蓋區的 WKWebView **不要管游標**（例如 inactive 時真的移除、或在其上蓋一個 `.cursorUpdate` 會贏的 AppKit view 並確認它真的收到 cursorUpdate）。
4. 為什麼 **Notes 正常、Daily 不正常** 是最關鍵的對照 —— 找出兩者 NSView 階層/覆蓋關係的差異，答案就在那。

## ✅ 已解決（2026-07-05，使用者實機確認）

**Root cause**：`MacSidebarRoot` 常駐 mount 全部 5 個分頁，Notes canvas 的
WKWebView **永遠活著、位置在視窗右半邊，正好蓋住 Daily 分隔線座標**。
SwiftUI 的 `opacity(0)` + `allowsHitTesting(false)` 只作用在 SwiftUI 層，
**藏不掉 NSView 的 NSTrackingArea** —— WebKit 每次 mouseMoved 都把游標重設
回箭頭。且 **tracking area 事件是直接派送給 owner 的、跟視圖疊放順序無關**，
所以上面 8 條「讓 handle 打贏」的嘗試（含蓋 cursorUpdate NSView）注定全輸。

**修法**（把競爭者請出場，而不是跟它打）：
- `MacDetailActive.swift`：新 environment key `nudgeMacDetailActive`。
- `PlatformRootView.detailHost`：注入 `isActive`。
- `RichTextEditor` / `AppKitEditor`：inactive 時 `webView.isHidden = true`
  （AppKit 層隱藏 = 不參與 hitTest、tracking area 不派送；本來就 opacity 0，
  視覺零差異）。`ResizeHandle` 原始碼一行未改。

**通則教訓（對齊 feedback_swiftui_appkit_hybrid_controls）**：ZStack 常駐
mount + opacity 隱藏的架構，對 AppKit-backed view（WKWebView / NSTextView
等）**必須另外做 AppKit 層的 isHidden**，否則 tracking area / cursor /
scroll 事件都還活著，會隔空干擾其他分頁。

## 當時 git 狀態（歷史紀錄）
分隔線相關已**全部還原成原始 baseline**（`ResizeHandle.swift` = 原版；`DailyHostView.dashboardContent` = 原版 inline handle）。
工作區還有兩組**未 commit** 的獨立修正，跟這題無關、請保留：
- `NudgeCore/RecurrenceCalculator.swift`：iOS 重複任務時區 off-by-one（全部運算釘 UTC；單元測試跨時區綠）。
- `NudgeUI/Daily/DailyHostView.swift`：點通知進卡片（iOS `pendingTaskId` 加 `initial: true`；macOS 補 `pendingTaskId` observer + 右欄開卡片）。

備註：`DailyHostView.swift` 第 14–16 行等 SourceKit 紅字是**既有的假警告**（full xcodebuild 綠），不是這次改壞的。

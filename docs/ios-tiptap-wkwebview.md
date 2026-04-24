# SwiftUI + WKWebView + TipTap 富文本編輯器：從踩坑到可用

> 這份是文章草稿。實際發表前再改寫一遍。

## 一、題目設定

目標：在 iOS / macOS SwiftUI App 裡嵌入跟 Web 版（Next.js + TipTap）**同一份** rich-text editor，讓跨平台體驗一致（Heptabase 手機版那種流暢度），同時：

- iOS / macOS / Web 三邊共用 TipTap extensions 的 source（`src/components/editor/`）
- bundle 到 App 裡離線可用（不連網站）
- 支援 heading / bullet / ordered list / task list / slash command
- dark mode

技術堆疊：

- **WKWebView** 承載 TipTap（純 ProseMirror，不要 React）
- **Vite IIFE lib mode** 打包 editor.js 成單檔，WKWebView 走 `loadFileURL` 從 app bundle 讀
- **Swift ↔ JS bridge**：`WKScriptMessageHandler` + `evaluateJavaScript` 雙向
- **EditorAccessoryView (UIKit)** 當 `inputAccessoryView`，不用 SwiftUI

---

## 二、最終架構（what actually works）

### 1. Bundle 打包策略

**不要** 讓 iOS bundle 走 Web 版的 `editor-extensions.ts`。它 transitively 會 import React（`ReactNodeViewRenderer`、`lucide-react`、`@tiptap/react`），打出來 bundle 780 KB 且 runtime 會噴 `ReferenceError: Can't find variable: process`。

**要做的**：

- 把純 ProseMirror 的 extensions（例：`SplitTaskList`）抽出獨立檔，三邊共用
- `apple/NudgeEditor/src/main.ts` 直接 `import StarterKit`、`TaskList`、`TaskItem` 等 TipTap packages，完全不碰 React 那條 dependency chain
- Vite `build.lib.formats: ["iife"]` + `rollupOptions.output.inlineDynamicImports: true` — 打成**單一 IIFE script**，`file://` 下的 WKWebView 可以用 `<script src="">` 直接載（WKWebView 對 `<script type="module">` from file:// 有 CORS 限制）

Bundle 大小：780 KB → 491 KB（`process.` references 從 12 → 0）。

### 2. SwiftUI view 配置

**Title 要放 view body，不是 `ToolbarItem(placement: .principal)`**：

```swift
// ❌ 壞掉的模式
.toolbar {
    ToolbarItem(placement: .principal) {
        TextField("title", text: $title)
    }
}

// ✅ 正確
VStack {
    TextField("title", text: $title)
        .font(.title2.weight(.semibold))
    RichTextEditor(...)
}
```

放在 NavigationStack toolbar 裡的可編輯 TextField，會把 iOS 的 `UITextInput` session 鎖在 toolbar 上。即使你在 WKWebView 的 contenteditable 顯示了 caret，keystroke 仍會被路由到 toolbar TextField。症狀：editor 出現 caret、畫面看起來有 focus，但打字實際進到 title（或哪都沒去），而且 navigation bar 那個 TextField 會進入「點不到」的 zombie 狀態。

**editor 不要包進 SwiftUI `ScrollView`**：

```swift
// ❌ 壞掉
ScrollView {
    RichTextEditor(...)
}

// ✅ 正確
VStack {
    // tag row fixed 在頂
    RichTextEditor(...)
        .frame(maxHeight: .infinity)
}
```

外層 SwiftUI `ScrollView` 的 deferred tap gesture（iOS 約 150ms delay）會吃掉 `pointerdown/touchstart`，ProseMirror 的 focus 路徑斷掉，鍵盤不彈。Notes / Heptabase 都是讓 WKWebView 自己管 scroll：

```swift
webView.scrollView.isScrollEnabled = true
webView.scrollView.delaysContentTouches = false
```

### 3. Toolbar = `inputAccessoryView`（UIKit，不要 SwiftUI）

Rich editor 標準 iOS 模式是把 toolbar 做成 keyboard 的 input accessory view。這有兩個好處：

- 按 toolbar 按鈕**不會 resign first responder**（keyboard 不 dismiss，editor 保持 focus，format command 才會真的 apply）
- iOS 自動用你的 accessory view **取代預設的 `^ v / Done` form-assistant bar**，不會兩條疊在一起

WKWebView 不給你直接 override `inputAccessoryView` 的 public API（它是內部 WKContentView 決定的）。有兩條路：

- **iOS 13+ subclass WKWebView 官方路徑**：文件說可以，但我查到的 report 是「sometimes silently ignored」
- **Runtime 動態 subclass WKContentView**（Bear / Mast / Spatial 用的招）：

```swift
guard let target = webView.scrollView.subviews.first(where: {
    String(describing: type(of: $0)).contains("WKContent")
}) else { return }
// 建新 subclass，override inputAccessoryView getter 回傳你的 view
// object_setClass 換掉 target 的 class
target.reloadInputViews()
```

**Accessory view 本體用純 UIKit**（`UIStackView` + `UIButton`）**，不要 SwiftUI**。我試過 SwiftUI + UIHostingController 當 accessory view：toolbar 顯示出來、tint 切換也 work（ObservableObject sink），但 **Button tap 的 closure 永遠不 fire**。Root cause：UIHostingController 沒被 add 成 child view controller（accessory view 不在正常 view-controller hierarchy），SwiftUI Button 的 responder chain 斷了。拆掉整塊換 UIKit 之後立刻全好。

### 4. Bridge 的黃金規則：**editor 是 source of truth**

這是 iOS 端最大的坑，web 版 commit `cfdcda2` 就踩過，我跟著踩了一次。架構長這樣：

```
User 打字
 → editor.onUpdate fires
 → postToNative({kind: "change", html: ed.getHTML()})
 → Swift 收到，更新 @Binding html
 → SwiftUI re-render RichTextEditor
 → UIViewRepresentable.updateUIView called
 → applyIncomingHTMLIfNeeded()  ← 危險點
```

自然的寫法是在 `applyIncomingHTMLIfNeeded` 裡比對 `binding.wrappedValue != lastEmitted`，不等就 `NudgeEditor.load(html)`。看起來很合理 — 但 load 實際上是 `editor.commands.setContent(html)`，**setContent 會把 ProseMirror selection 重置到 doc-end**。

結果：

- 每次打字 → setContent → selection 跳 doc-end → 下個字 insert 在底部 → 使用者看到「打字跳到最底」
- tap 進 bullet → 剛設好的 selection 被下次 updateUIView 的 setContent 抹掉 → tap 沒反應
- 按 toolbar 按鈕 → toggle 作用點被 setContent 推到 doc-end 的空 block → 看起來按鈕無效

這個 bug 在有 server revalidation / SWR / 任何 back-sync path 的 app 都會撞到：只要 server 回來的 HTML 跟 editor 自己 `getHTML()` 差一個 whitespace / attribute 順序，dedup 就失敗、setContent 就跑。

**正確做法**（對齊 web commit cfdcda2）：

```swift
func applyIncomingHTMLIfNeeded() {
    guard isReady else {
        pendingLoadHTML = binding.wrappedValue   // ready 前記起來，ready 時用
        return
    }
    // ready 後：no-op。editor is source of truth.
}
```

切換到不同 card 的內容，用 **SwiftUI view identity remount**：

```swift
RichTextEditor(html: $desc, ...)
    .id(card.id)   // 對齊 web 的 <TiptapEditor key={task.id}>
```

### 5. Focus / keyboard 讓 ProseMirror 自己處理

我試過很多 focus hack，沒一個是對的：

- ❌ native side `webView.becomeFirstResponder()`
- ❌ `UITapGestureRecognizer` 在 WKWebView 上手動 call focus
- ❌ `evaluateJavaScript("NudgeEditor.focus()")` — iOS 不認這個為 user gesture，keyboard 不彈
- ❌ JS 端 `pointerdown` capture listener call `editor.commands.focus()` — dispatch transaction race ProseMirror 自己的 tap-selection transaction，selection 被設到舊位置 → tap 進 bullet 沒反應
- ❌ JS 端 `pointerdown` capture listener call `editor.view.focus()` — DOM focus 但沒建 selection → 打字進不了 ProseMirror

**只要上面 (1)(2) 做對（title 在 view body、不包 ScrollView）**，WKWebView + ProseMirror 自己的 tap handler 就能：tap → 彈 keyboard → 設 selection 到 tap 位置 → 接 keystroke。不需要任何 native/JS focus hack。

### 6. Theme / dark mode

`currentScheme` 要在 `guard isReady` **之前**就記起來：

```swift
func pushTheme(scheme: ColorScheme) {
    currentScheme = scheme              // 先記
    guard isReady, let webView else { return }
    if lastSentScheme == scheme { return }
    lastSentScheme = scheme
    // send JS
}
```

常見寫法會把 `currentScheme = scheme` 放在 `guard isReady` 後面 — 但 `makeUIView` 時 `isReady = false`（editor bundle 還沒 ready 事件）直接 return，currentScheme 永遠 nil。`.ready` 事件 replay 時看 `if let scheme = currentScheme` 就 nil → 永遠沒 push theme → editor CSS vars 永遠是預設 light mode → dark mode 下 `#1a1a1a` 文字在黑底**看不見**（使用者以為卡片空的，其實字在那，剛好黑底黑字）。

---

## 三、要避免的坑（完整清單）

### Bundle 打包

1. 讓 iOS bundle 透過 `editor-extensions.ts` 引入 → 拉進 React → `ReferenceError: process` → 整個 editor 起不來
2. 用 `<script type="module">` from `file://` → WKWebView CORS 拒載 → 一樣起不來
3. 用 `.gitkeep` 佔位 Resources/Editor 目錄：xcodegen + Swift Package `resources:` 會認得它、copy 進 bundle 汙染檔案列表

### WKWebView 生命週期

4. `webView.loadFileURL(url, allowingReadAccessTo: url)` → iOS 26.4 Beta 起不允許同一個 path 當 read-access root，要傳 `url.deletingLastPathComponent()`
5. WKContentView 在 `makeUIView` 時不存在 → 此時 install input accessory view 會 no-op。要等 `didFinish navigation` 再裝

### Error handling

6. 加 `window.addEventListener("error", ev => postToNative({kind:"change", html: "[ERROR] "+ev.message}))` 當 debug tool → 任何一個 runtime error 都會把 stack trace **當 description 寫回 server** → 污染卡片。我們有一批卡在 debug 過程被這條 handler 蓋掉描述，無法救回（沒 history table）

### SwiftUI 佈局

7. 把 editor 的 TextField 放 `NavigationStack toolbar principal` → UITextInput session lock → editor contenteditable 收不到 input
8. `ScrollView { RichTextEditor(...) }` → 外層 deferred tap gesture 吃 touch → keyboard 不彈
9. `.safeAreaInset(edge: .bottom) { if keyboardVisible { EditorToolbar() } }` + `onReceive(keyboardWillShow/Hide)` → layout 變動被 iOS 誤判為 input view change → keyboard flicker / dismiss mid-typing
10. `html, body { height: 100dvh }` → WKWebView viewport 不等於 dvh（已扣 safe area / toolbar），over-size 截切 content

### Toolbar

11. 用 SwiftUI + UIHostingController 當 `inputAccessoryView` → view 顯示得出來、state 更新得動，但 **Button tap 永遠不 fire**（responder chain 斷）。全 UIKit
12. 把 EditorToolbar 放在 SwiftUI `safeAreaInset` 常駐 → 按下去會 resign first responder → editor 失 focus → toolbar command 的 `editor.chain().focus()` 雖然能拿 focus 回來但 via `evaluateJavaScript`（non-user-gesture）→ iOS 不彈鍵盤
13. 嘗試 `webView.inputAssistantItem.leadingBarButtonGroups = []` 移除 `^ v` bar → 無效。真正的 `inputAssistantItem` 在 WKContentView 身上，要 runtime subclass

### JS focus 行為

14. 從 Swift `evaluateJavaScript` call `editor.commands.focus()` → 不算 iOS user gesture → 鍵盤不彈（[ProseMirror forum #3372](https://discuss.prosemirror.net/t/cant-focus-on-ios/3372) 有詳盡討論）
15. JS 端加 `pointerdown` listener call `editor.commands.focus()` → dispatch transaction 跟 ProseMirror 自己的 tap transaction race，selection 被設到 null 或舊位置 → tap 進 content 沒反應
16. 改 call `editor.view.focus()` → 只 DOM focus、不建 selection → 鍵盤彈但打字進不了 editor

### Content sync（最大的坑）

17. **`updateUIView` 裡 sync binding → editor**：每次 SwiftUI re-render 都比對 HTML 不等就 setContent → selection reset → caret 跳底。**正確：ready 後不 sync，切卡片用 `.id(card.id)`**

### Theme

18. `pushTheme` 裡 `guard isReady` 在 `currentScheme = scheme` 之前 → initial push 被 skip 且 scheme 沒記 → `.ready` replay 拿不到 scheme → 永不 push theme → dark mode 黑底黑字看不見

### Simulator 干擾（非 app bug 但會誤導診斷）

19. Connect Hardware Keyboard（預設 ON）→ Mac 鍵盤 keystroke 走硬體鍵盤路徑進 WKWebView contenteditable → iOS 26 上有 input race bug → 字打了又消失。實機沒這問題
20. `^v / Done` form assistant bar 只在 hardware keyboard 連著時出現（iOS 覺得你需要 form navigation）→ 以為是 app bug，其實 simulator 專屬

### 診斷誤區

21. iOS simulator 預設硬體鍵盤連著，tap text field 只彈 assistant bar 不彈軟鍵盤 → 以為 editor 不能 focus。`Cmd+K` 切軟鍵盤、或 `defaults write com.apple.iphonesimulator ConnectHardwareKeyboard -bool NO` + reboot sim
22. `hapticpatternlibrary.plist` 找不到一大串 error log → 每個 iOS dev 在 sim 都會噴，跟你的 code 完全無關，別浪費時間追
23. SourceKit 的「Cannot find type ActiveMarks in scope」在 `#if os(iOS) / #if os(macOS)` 跨平台 branch 裡是**正常雜訊**（SourceKit 單平台掃），只看 `xcodebuild` 結果

---

## 四、診斷方法論

這題我來來回回大概 8 個版本才真正解，寫下幾個大教訓：

### 1. 不要假設 root cause，先做可驗證的二分

每個「看起來」的 symptom 背後可能有多個 cause，交叉出來就是 2^N 種狀態。我花了很長時間在「toolbar 按鈕沒反應」亂改（換 SwiftUI → UIKit），結果真正 root cause 是打字進不了 editor，toolbar 其實有反應只是 toggle 在空 block。

好的二分法：**問一個能 yes/no 的問題，每個答案縮小一半的 hypothesis space**。我最後一次問使用者「鍵盤上方是 A/B/C」、「打字跳下方是 D/E/F」、「bullet 不反應是 G/H/I」，答對了才精準往 cfdcda2 的方向查。

### 2. 相信證據，不要相信命名

`commandBus.send(.toggleTaskList)` → check 按鈕 tint 變 orange 了 → 證實 toolbar 的 target/action 路徑通。這是 **證據**。我之前假設「SwiftUI Button 吃 tap」是憑感覺，沒證據。有了 orange 變色這個證據就能直接排除 SwiftUI Button 嫌疑，省下一整輪瞎改。

### 3. 找「之前 Web 也有過這問題」是金礦

使用者提醒 web 也有過 cursor 跳底的問題。一句 `git log --all --oneline --grep="cursor\|跳"` 找到 `cfdcda2`，**commit message 已經寫好 root cause 和 fix**。

平常 commit message 寫清楚 "為什麼" 的好處就在這。跨平台場景更是 — iOS / web 共享 editor code 的時候，web 已經踩過的坑如果沒 propagate，另一平台一定會再踩一次。

### 4. 區分「app bug」和「環境 bug」

iOS simulator 有一堆自己的 quirk（hardware keyboard、hapticpatternlibrary、form assistant bar 只在 sim 出現），debug 時 **早點推 TestFlight 到實機驗一次**，能立刻排除一大串。我中間有好幾版其實 real device 就 work，但 simulator 上看起來壞（hardware keyboard 路徑 bug），繼續亂改反而壞掉 real device 上也 work 的部分。

### 5. 「不要自己想 去查資料」的價值

使用者這句話擋下我好幾次瞎猜。Apple Developer Forums、openradar、ProseMirror discuss、Hacking with Swift 論壇都有大量前人踩過的 report，大部分我遇到的問題別人都遇過。搜 10 分鐘查到的 insight，比自己改 2 小時 code 有用。

### 6. 「止血 > 救援」原則

debug 過程我加的 `window.onerror` → postToNative change 這條 handler 直接把 error stack 當 description 寫回 server，污染了一批卡片。這種 side-effect 明顯的 debug aid 一定要第一時間拿掉，即使救援手段（DB backup / SWR cache 回復）都沒了，至少別繼續加劇。

---

## 五、核心 takeaway 給後面的讀者

**一句話總結**：SwiftUI + WKWebView 嵌 TipTap rich editor 最大的坑是**同步方向搞反**。Web 端能靠 React controlled component + SWR 雙向同步的 pattern，到了 WKWebView + ProseMirror + SwiftUI `@Binding` 這個組合會爆炸：**editor 內部的 ProseMirror state 永遠是 source of truth，Swift 端只接收不回推**。切內容用 `.id(key)` remount，不用 content sync。

Web commit `cfdcda2` 的十行修正解掉了我三天踩的七八個表面症狀 — 因為那就是同一個 root cause 在不同框架下的不同表現。

---

## 參考連結

- [ProseMirror forum: Can't focus on iOS](https://discuss.prosemirror.net/t/cant-focus-on-ios/3372)
- [Apple forum: iOS 26 WKWebView keyboard bug](https://developer.apple.com/forums/thread/802159)
- [Apple forum: iOS 26.4 Beta loadFileURL regression](https://developer.apple.com/forums/thread/817245)
- [Apple forum: WKWebView keyboard not showing on contenteditable](https://developer.apple.com/forums/thread/656467)
- [openradar #15840: WKWebView does not scroll on contenteditable caret](https://github.com/lionheart/openradar-mirror/issues/15840)
- [Swift Swizzling WKWebView — Robots & Pencils](https://robopress.robotsandpencils.com/swift-swizzling-wkwebview-168d7e657106)

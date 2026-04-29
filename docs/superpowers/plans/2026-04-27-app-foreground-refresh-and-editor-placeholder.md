# App 進前景刷新日曆 + 編輯器 placeholder bug — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修兩個小 bug — 日曆 tab 切背景再回前景不會 reload；iOS/macOS 編輯器（日誌 + 任務描述）的 placeholder 完全沒顯示。順帶換掉誤導性文案。

**Architecture:** Swift 端在 `CalendarHostView` 加 `scenePhase` observer；JS bundle (`NudgeEditor`) 加 `setPlaceholder()` API、Swift `EditorCoordinator` 在 `.ready` 下發 placeholder 字串；i18n 三邊（Web JSON + iOS xcstrings）一起更新文案。

**Tech Stack:** SwiftUI、TipTap (`@tiptap/extension-placeholder`)、Vite (lib mode)、vitest、Next.js i18n。

**重要規則（來自使用者全域 memory，覆寫 skill 預設）：**
- **Commit message 用繁體中文**（prefix 可保留英文 conventional commits）。
- **等使用者實機測試通過才 commit**。所以 Task 1–5 只做改 code + 區域驗證，**Task 6 才請使用者 sim 測試**，Task 7 才 commit。
- **iOS 改動後一定要 build + install + relaunch sim**（不只 `swift build`）。
- **UI 改 placeholder/scenePhase 屬於互動功能**：build 過 ≠ 完成，必須實機跑。

**參考 spec：** `docs/superpowers/specs/2026-04-27-app-foreground-refresh-and-editor-placeholder-design.md`

---

## File Structure

| 檔案 | 動作 | 內容 |
|------|------|------|
| `apple/NudgeKit/Sources/NudgeUI/Calendar/CalendarHostView.swift` | Modify | 加 `@Environment(\.scenePhase)` + `.onChange(of:)` reload |
| `src/messages/zh-TW.json` | Modify | `notes.canvasPlaceholder`、`cardDetail.editorPlaceholder` 換文案 |
| `src/messages/ja.json` | Modify | 同上 |
| `src/messages/en.json` | Modify | 同上 |
| `apple/NudgeKit/Sources/NudgeUI/Resources/Localizable.xcstrings` | Modify | 上述兩 key 三語 localization 更新 |
| `apple/NudgeEditor/src/main.ts` | Modify | `NudgeEditorAPI` 加 `setPlaceholder()`；介面與實作 |
| `apple/NudgeKit/Sources/NudgeUI/Resources/Editor/editor.js` | Regenerate | `apple/NudgeEditor/build.sh` 產出，**不要手改** |
| `apple/NudgeKit/Sources/NudgeUI/Resources/Editor/editor.css` | Regenerate | 同上（如有變動） |
| `apple/NudgeKit/Sources/NudgeUI/Components/EditorBridge.swift` | Modify | `EditorCoordinator` 加 `pushPlaceholder()`，`.ready` 內呼叫 |

不新建任何檔案。

---

## Task 1: 日曆回前景時 reload（`CalendarHostView`）

**Files:**
- Modify: `apple/NudgeKit/Sources/NudgeUI/Calendar/CalendarHostView.swift`

- [ ] **Step 1.1: 加 `@Environment(\.scenePhase)` 屬性**

在 `CalendarHostView` 內、現有的 `@AppStorage` 屬性下方加：

```swift
@Environment(\.scenePhase) private var scenePhase
```

放在 `apple/NudgeKit/Sources/NudgeUI/Calendar/CalendarHostView.swift:9`（`@AppStorage(...) private var modeRaw...` 那行）下面。

- [ ] **Step 1.2: 在 `body` 加 `.onChange(of: scenePhase)`**

找到 `apple/NudgeKit/Sources/NudgeUI/Calendar/CalendarHostView.swift:58` 的 `.task(id: rangeKey) { await reload() }`，在它 **下方** 加：

```swift
.onChange(of: scenePhase) { _, phase in
    if phase == .active {
        Task { await reload() }
    }
}
```

完整片段（前後文）會長這樣：

```swift
        .task(id: rangeKey) { await reload() }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active {
                Task { await reload() }
            }
        }
        .sheet(item: $selectedEvent) { event in
            // ...
        }
```

- [ ] **Step 1.3: Build 通過**

```bash
xcodebuild -scheme Nudge-iOS -destination 'platform=iOS Simulator,name=iPhone 16 Pro' build 2>&1 | tail -20
```

預期：`** BUILD SUCCEEDED **`。

不在這一步做模擬器實測 — 留到 Task 6 一起跑。

- [ ] **Step 1.4: 不 commit**

依使用者規則，等 Task 6 使用者實測通過才 commit。

---

## Task 2: Web i18n 文案更新

**Files:**
- Modify: `src/messages/zh-TW.json:233`、`src/messages/zh-TW.json:247`
- Modify: `src/messages/ja.json:233`、`src/messages/ja.json:247`
- Modify: `src/messages/en.json:233`、`src/messages/en.json:247`

- [ ] **Step 2.1: 更新 zh-TW.json**

`src/messages/zh-TW.json:233`：

```json
"editorPlaceholder": "打 / 插入標題、清單…",
```

改為：

```json
"editorPlaceholder": "補充細節⋯⋯",
```

`src/messages/zh-TW.json:247`：

```json
"canvasPlaceholder": "寫點什麼⋯⋯",
```

改為：

```json
"canvasPlaceholder": "今天怎麼樣？",
```

- [ ] **Step 2.2: 更新 ja.json**

`src/messages/ja.json:233`：

```json
"editorPlaceholder": "/ を入力して見出しやリストを挿入…",
```

改為：

```json
"editorPlaceholder": "詳細を追加...",
```

`src/messages/ja.json:247`：

```json
"canvasPlaceholder": "何か書いてみましょう...",
```

改為：

```json
"canvasPlaceholder": "今日はどうでしたか？",
```

- [ ] **Step 2.3: 更新 en.json**

`src/messages/en.json:233`：

```json
"editorPlaceholder": "Type / to insert headings, lists…",
```

改為：

```json
"editorPlaceholder": "Add details...",
```

`src/messages/en.json:247`：

```json
"canvasPlaceholder": "Write something...",
```

改為：

```json
"canvasPlaceholder": "How was your day?",
```

- [ ] **Step 2.4: 驗證 JSON 合法 + Web build 過**

```bash
cd /Users/mike/Documents/nudge && for f in src/messages/zh-TW.json src/messages/ja.json src/messages/en.json; do node -e "JSON.parse(require('fs').readFileSync('$f','utf8'))" && echo "$f OK"; done
```

預期：三行 OK。

```bash
cd /Users/mike/Documents/nudge && npx next build 2>&1 | tail -10
```

預期：build 成功。

- [ ] **Step 2.5: 不 commit**

留到 Task 7。

---

## Task 3: iOS xcstrings 文案更新

**Files:**
- Modify: `apple/NudgeKit/Sources/NudgeUI/Resources/Localizable.xcstrings:708-728`（`cardDetail.editorPlaceholder`）
- Modify: `apple/NudgeKit/Sources/NudgeUI/Resources/Localizable.xcstrings:2682-2702`（`notes.canvasPlaceholder`）

- [ ] **Step 3.1: 更新 `cardDetail.editorPlaceholder` 三語**

在 `apple/NudgeKit/Sources/NudgeUI/Resources/Localizable.xcstrings` 找到 `"cardDetail.editorPlaceholder"` 區塊（line 708），將三個 `value` 字串改為：

- `en` → `"Add details..."`（原本 `"Type / to insert headings, lists…"`）
- `ja` → `"詳細を追加..."`（原本 `"/ を入力して見出しやリストを挿入…"`）
- `zh-Hant` → `"補充細節⋯⋯"`（原本 `"打 / 插入標題、清單…"`）

注意：xcstrings 用 `zh-Hant`（不是 Web 的 `zh-TW`）。`state` 維持 `"translated"`。

- [ ] **Step 3.2: 更新 `notes.canvasPlaceholder` 三語**

在 `apple/NudgeKit/Sources/NudgeUI/Resources/Localizable.xcstrings` 找到 `"notes.canvasPlaceholder"` 區塊（line 2682），將三個 `value` 改為：

- `en` → `"How was your day?"`（原本 `"Write something..."`）
- `ja` → `"今日はどうでしたか？"`（原本 `"何か書いてみましょう..."`）
- `zh-Hant` → `"今天怎麼樣？"`（原本 `"寫點什麼⋯⋯"`）

- [ ] **Step 3.3: 驗證 JSON 合法**

```bash
node -e "JSON.parse(require('fs').readFileSync('/Users/mike/Documents/nudge/apple/NudgeKit/Sources/NudgeUI/Resources/Localizable.xcstrings','utf8'))" && echo OK
```

預期：`OK`。

- [ ] **Step 3.4: 不 commit**

留到 Task 7。

---

## Task 4: JS `setPlaceholder` API + bundle rebuild

**Files:**
- Modify: `apple/NudgeEditor/src/main.ts:214-282`（介面 + 實作）
- Regenerate: `apple/NudgeKit/Sources/NudgeUI/Resources/Editor/editor.js`（透過 build.sh）

不寫 vitest unit test：setPlaceholder 需要真實 ProseMirror view 才能驗 decorations 重跑，現有 vitest 配置沒 jsdom 相關設定（`bridge.test.ts` 都是純 mock 邏輯）。setPlaceholder 行為靠 Task 6 的模擬器實測驗證。

- [ ] **Step 4.1: 在 `NudgeEditorAPI` 介面加 `setPlaceholder`**

`apple/NudgeEditor/src/main.ts:214-221` 目前介面：

```typescript
interface NudgeEditorAPI {
  load(html: string): void;
  getHTML(): string;
  exec(command: string, args?: Record<string, unknown>): void;
  focus(): void;
  setTheme(tokens: Record<string, string>): void;
  setLabels(dict: LabelDict): void;
}
```

在 `setLabels` 下方加一行：

```typescript
  setPlaceholder(text: string): void;
```

- [ ] **Step 4.2: 在 `api` 物件加 `setPlaceholder` 實作**

`apple/NudgeEditor/src/main.ts:223-282` 的 `api` 物件，在 `setLabels(...)` 後面加：

```typescript
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
```

完整片段（要看出位置）：

```typescript
  setLabels(dict: LabelDict) {
    labels = dict;
  },
  setPlaceholder(text: string) {
    if (!editor) return;
    const ext = editor.extensionManager.extensions.find(
      (e) => e.name === "placeholder",
    );
    if (!ext) return;
    ext.options.placeholder = text;
    editor.view.dispatch(editor.state.tr);
  },
};
```

- [ ] **Step 4.3: TypeScript 型別檢查**

```bash
cd /Users/mike/Documents/nudge/apple/NudgeEditor && npx tsc --noEmit 2>&1 | tail -10
```

預期：無錯誤輸出（或只剩既有 warning）。

- [ ] **Step 4.4: Rebuild bundle**

```bash
cd /Users/mike/Documents/nudge/apple/NudgeEditor && bash build.sh 2>&1 | tail -10
```

預期：最後一行 `✓ editor bundle copied`。

驗證 `editor.js` 有更新：

```bash
grep -c setPlaceholder /Users/mike/Documents/nudge/apple/NudgeKit/Sources/NudgeUI/Resources/Editor/editor.js
```

預期：≥ 1。

- [ ] **Step 4.5: 不 commit**

留到 Task 7。

---

## Task 5: Swift `pushPlaceholder` + 在 `.ready` 呼叫

**Files:**
- Modify: `apple/NudgeKit/Sources/NudgeUI/Components/EditorBridge.swift:236-241`（加方法）
- Modify: `apple/NudgeKit/Sources/NudgeUI/Components/EditorBridge.swift:276-289`（`.ready` 內呼叫）

- [ ] **Step 5.1: 加 `pushPlaceholder()` 方法**

在 `apple/NudgeKit/Sources/NudgeUI/Components/EditorBridge.swift:236-241` 的 `pushLabels()` 方法**下方**加：

```swift
    /// Push the SwiftUI-supplied placeholder string into the JS bundle so
    /// TipTap's Placeholder extension can render `data-placeholder`.
    /// Called after `.ready` because the editor doesn't exist before then.
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

完整前後文：

```swift
    func pushLabels() {
        guard isReady, let webView else { return }
        guard let data = try? JSONSerialization.data(withJSONObject: labels),
              let json = String(data: data, encoding: .utf8) else { return }
        webView.evaluateJavaScript("NudgeEditor.setLabels(\(json))")
    }

    func pushPlaceholder() {
        guard isReady, let webView else { return }
        guard let data = try? JSONSerialization.data(
            withJSONObject: [placeholder], options: [.fragmentsAllowed]
        ),
              let json = String(data: data, encoding: .utf8) else { return }
        let arg = json.trimmingCharacters(in: CharacterSet(charactersIn: "[]"))
        webView.evaluateJavaScript("NudgeEditor.setPlaceholder(\(arg))")
    }

    func exec(_ command: EditorCommand) {
        // ...
```

- [ ] **Step 5.2: 在 `.ready` handler 內呼叫**

`apple/NudgeKit/Sources/NudgeUI/Components/EditorBridge.swift:276-289` 的 `.ready` case，目前是：

```swift
        case .ready:
            print("[EditorCoordinator] ready")
            isReady = true
            pushLabels()
            if let scheme = currentScheme {
                pushTheme(scheme: scheme)
            }
            let initial = pendingLoadHTML ?? htmlBinding.wrappedValue
            // ...
```

在 `pushLabels()` 下方加 `pushPlaceholder()`：

```swift
        case .ready:
            print("[EditorCoordinator] ready")
            isReady = true
            pushLabels()
            pushPlaceholder()
            if let scheme = currentScheme {
                pushTheme(scheme: scheme)
            }
            let initial = pendingLoadHTML ?? htmlBinding.wrappedValue
            // ...
```

- [ ] **Step 5.3: iOS Build 過**

```bash
xcodebuild -scheme Nudge-iOS -destination 'platform=iOS Simulator,name=iPhone 16 Pro' build 2>&1 | tail -20
```

預期：`** BUILD SUCCEEDED **`。

- [ ] **Step 5.4: macOS Build 過**

```bash
xcodebuild -scheme Nudge-macOS build 2>&1 | tail -20
```

預期：`** BUILD SUCCEEDED **`。

- [ ] **Step 5.5: Install + relaunch iOS sim**

```bash
xcrun simctl install booted /Users/mike/Documents/nudge/apple/build/Build/Products/Debug-iphonesimulator/Nudge.app 2>/dev/null \
  || xcodebuild -scheme Nudge-iOS -destination 'platform=iOS Simulator,name=iPhone 16 Pro' -derivedDataPath /Users/mike/Documents/nudge/apple/build install 2>&1 | tail -5
xcrun simctl launch booted tw.nudge.app
```

（指令會 fall through — 第一個 install 若沒找到 app 包，跑 xcodebuild 重 install。）

預期：模擬器啟動 Nudge App 到首頁。

- [ ] **Step 5.6: 不 commit**

留到 Task 7。

---

## Task 6: 整合實測（請使用者操作）

**這一步停下來請使用者驗收**，依 spec 測試計畫逐項勾。

- [ ] **Step 6.1: 列出 sim 實測項目給使用者**

請使用者在 booted sim 上跑：

1. **日曆 foreground reload**
   - 開 Nudge → 切到日曆 tab → 看到 events
   - 把 App 切到背景（按 home 鍵）等 30 秒
   - 回前景 → console log 應出現 `[CalendarHost] reload`（或 events 視覺上重抓）
2. **日誌 placeholder**
   - 切到日誌 tab、空白頁 → 看到「今天怎麼樣？」
   - 在編輯器打字 → placeholder 消失
   - 全選刪除 → placeholder 重現
3. **任務描述 placeholder**
   - 從 Daily 點任意任務開描述編輯器（空白）→ 看到「補充細節⋯⋯」
4. **語言切換**
   - 設定 → 切到日文 → 重新打開上述兩處 → 顯示「今日はどうでしたか？」與「詳細を追加...」
   - 切到英文 → 顯示「How was your day?」與「Add details...」

- [ ] **Step 6.2: 等使用者回 OK 或回報問題**

若使用者回報問題：定位、修、回到對應 Task 重做、再請使用者測。

若 OK：往 Task 7。

- [ ] **Step 6.3: macOS 抽測**

請使用者在 macOS App（如有環境）抽測：
- 日誌與卡片 placeholder 顯示正確
- 切換 App focus 出/入 Nudge → 日曆 events 重抓

非阻塞 — macOS 若沒環境可跳過，留 PR 描述標註。

---

## Task 7: 分區 commit

**Files:** 無新改動 — 將 Task 1–5 的工作分三個 commit。

依 commit 主題分組（commit message 主旨+body 用繁體中文，prefix 保留英文 conventional commits）：

- [ ] **Step 7.1: Commit 文案更新（Web + iOS）**

```bash
cd /Users/mike/Documents/nudge && git add \
  src/messages/zh-TW.json \
  src/messages/ja.json \
  src/messages/en.json \
  apple/NudgeKit/Sources/NudgeUI/Resources/Localizable.xcstrings \
  && git commit -m "$(cat <<'EOF'
i18n(notes,cardDetail): placeholder 文案改為「今天怎麼樣？」「補充細節⋯⋯」

- 日誌：「寫點什麼⋯⋯」→「今天怎麼樣？」（zh-TW / ja / en 三邊同步）
- 任務描述：「打 / 插入標題、清單…」→「補充細節⋯⋯」
  原文案宣傳 slash command，但 iOS bundle 目前 disable 中（main.ts:146-150），會誤導使用者

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 7.2: Commit 編輯器 placeholder bug 修復**

```bash
cd /Users/mike/Documents/nudge && git add \
  apple/NudgeEditor/src/main.ts \
  apple/NudgeKit/Sources/NudgeUI/Resources/Editor/editor.js \
  apple/NudgeKit/Sources/NudgeUI/Resources/Editor/editor.css \
  apple/NudgeKit/Sources/NudgeUI/Components/EditorBridge.swift \
  && git commit -m "$(cat <<'EOF'
fix(apple/editor): placeholder 字串原本沒下發到 WebView

bug 三層共謀：
1. NudgeEditor 模組載入時就 createEditor("")，Placeholder ext 拿到空字串
2. JS API 沒有 setPlaceholder()
3. Swift EditorCoordinator 存了 placeholder 卻從沒呼叫 evaluateJavaScript

修法：
- JS NudgeEditorAPI 加 setPlaceholder(text)，更新 ext.options.placeholder 並 dispatch 空 transaction 重跑 decorations
- Swift EditorCoordinator 加 pushPlaceholder()，在 .ready callback 內 pushLabels() 之後呼叫
- Rebuild editor bundle

影響 4 處 RichTextEditor 用例：NotesCanvasView / CardDetailView / DailyHostView / TaskPopoverView

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 7.3: Commit 日曆回前景刷新**

```bash
cd /Users/mike/Documents/nudge && git add \
  apple/NudgeKit/Sources/NudgeUI/Calendar/CalendarHostView.swift \
  && git commit -m "$(cat <<'EOF'
fix(apple/calendar): App 回前景時 reload events

CalendarHostView 原本只在 .task(id: rangeKey) 抓資料，rangeKey 是 mode|start|end，scenePhase 變化不會觸發 reload。切背景幾小時再回前景看到的還是舊 events。

view-level 加 @Environment(\.scenePhase) + .onChange，.active 時呼叫現有 reload()。維持在 view 層而非 App root，避免其他 tab 也跑（之後若需要 Daily/Notes refresh 再抽中央層）。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 7.4: 確認 git 狀態乾淨**

```bash
cd /Users/mike/Documents/nudge && git status && git log --oneline -5
```

預期：`nothing to commit, working tree clean` + 看到三個新 commits（連同 spec commit 共四個）。

---

## Self-Review

- **Spec coverage**：§1（Task 1）、§2 JS+Swift（Task 4+5）、§3 文案三邊（Task 2+3）、測試計畫（Task 5.3-5.5 build / 6 sim 實測）、不在範圍（plan 沒擴入 polling / pull-to-refresh / slash-command / 其他 tab refresh）。✓
- **Placeholder scan**：無 TBD/TODO；每段 code 都完整貼出；commands 含預期輸出。✓
- **Type consistency**：`setPlaceholder(text: string)` 在 JS 介面、實作、Swift `pushPlaceholder()` evaluateJavaScript 字串都一致；`NudgeEditor.setPlaceholder(...)` 命名前後對齊。✓

---

**Plan complete and saved to `docs/superpowers/plans/2026-04-27-app-foreground-refresh-and-editor-placeholder.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — 每個 Task 派一個 fresh subagent，task 之間 review、加快迭代。
**2. Inline Execution** — 在這個 session 內執行，按 checkpoint 暫停 review。

依你過去傾向（autonomous_execution feedback：批次執行不停下問權限），加上這個案子改動點都很小、且 Task 6 一定要停下來等實測，**我建議 Inline Execution**：直接從 Task 1 跑到 Task 5，停在 Task 6 給你測，OK 後我再做 Task 7 的三個 commit。

要這樣跑嗎？還是你要我換 Subagent-Driven？

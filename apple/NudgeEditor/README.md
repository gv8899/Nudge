# Nudge Editor Bundle

獨立的 Vite 子專案，把 TipTap 編輯器（連同 `src/components/editor/` 裡的 extensions）打包成單一 HTML / JS / CSS bundle，供 iOS / macOS `RichTextEditor.swift` 的 WKWebView 載入。

## 為什麼要獨立一個 workspace

- Web 端 TipTap 依賴 React (`@tiptap/react`)；WKWebView 不需要 React runtime
- Bundle 要離線 ship 在 app 裡，需要明確的 build output（`editor.html` / `editor.js` / `editor.css`）
- 主 Next.js build 不適合 tree-shake 出一個子 bundle，Vite 對這種單檔場景簡單得多

## 共用的東西

`vite.config.ts` 的 `resolve.alias` 把 `@web-editor/*` 指到 `../../src/components/editor/`，所以：

- `editor-extensions.ts`（StarterKit + TaskList + SplitTaskList 等）
- `slash-command-defs.ts`（slash items 純資料，Task 1 從 `slash-command-items.tsx` 抽出來）

這些檔 iOS 和 web 共用。Web 改動會影響 iOS，**記得 rebuild bundle**（見下）。

不共用的：

- Slash menu UI（web 用 React、iOS 用 plain DOM，見 `src/slash-menu.ts`）
- Slash command extension 本體（web 的 `slash-command-extension.ts` 把 React renderer bake 進 `addProseMirrorPlugins`，iOS 在 `src/main.ts` 用 `Extension.create + @tiptap/suggestion` 重寫一份）
- Placeholder / i18n 文字（iOS 由 Swift 透過 `setLabels` 注入）

## Build / Development

### 第一次 setup

```bash
cd apple/NudgeEditor
npm install --legacy-peer-deps
```

`--legacy-peer-deps` 是為了繞過 TipTap 3.22.x 生態系的 peer dep 版本衝突（`extension-code-block-lowlight@3.22.3` 要 `core@3.22.3`，但部分 ext 鎖在 `^3.22.2` 會拉 `3.22.4`）。`build.sh` 也會帶這個 flag。

### 重 build（每次改 `src/components/editor/*` 或 `apple/NudgeEditor/src/*` 後）

```bash
apple/NudgeEditor/build.sh
```

輸出會複製到 `apple/NudgeKit/Sources/NudgeUI/Resources/Editor/`，Swift Package 的 `NudgeUI` target 用 `.copy("Resources/Editor")` 把整個目錄包進 app bundle。

### Dev mode（用瀏覽器開發 bundle 本身）

```bash
cd apple/NudgeEditor
npm run dev
```

開 `http://localhost:5173`，`#editor` 會有可用的 TipTap — 但 `postToNative` 全部 no-op，適合驗 UI / 排版。

### Tests

```bash
cd apple/NudgeEditor
npm test
```

目前 `bridge.test.ts` 兩個 test 跑 vitest + jsdom env。

## CI

`.github/workflows/editor-bundle.yml` 在 push / PR 觸及 `apple/NudgeEditor/` 或 `src/components/editor/` 時跑 `npm ci + npm run build + npm test`，確保 bundle 隨時建得起來。

## Bundle size note

目前 `editor.js` 約 717 KB（gzipped ~230 KB）。大小受制於透過 `editor-extensions.ts` 傳遞進來的 React / lucide-react / lowlight / tippy.js import chain — 即使 iOS runtime 不用 React，static import 還是進 bundle。未來若要瘦身，需要把 web 的 `editor-extensions.ts` 拆成 React-free 核心 + web-only node views（現階段接受）。

## Troubleshooting

**Vite build 失敗找不到 `@web-editor/*`**
檢查 `vite.config.ts` 的 alias 和 `tsconfig.json` 的 paths 是否一致，且 `../../src/components/editor/<name>.ts` 檔案存在。

**iOS / macOS load 出空白**
1. `ls apple/NudgeKit/Sources/NudgeUI/Resources/Editor/` 有沒有 `editor.html`、`editor.js`、`editor.css`
2. `apple/NudgeKit/Package.swift` 的 `NudgeUI` target resources 是否包含 `.copy("Resources/Editor")`
3. Swift 有沒有用 `webView.loadFileURL(url, allowingReadAccessTo: editorDir)`（單檔 load 會被 WKWebView 擋掉 relative CSS/JS import）
4. 深色模式看不到文字：檢查 Swift 有沒有在 `ready` 後呼叫 `NudgeEditor.setTheme(...)`

**`npm install` peer dep error**
TipTap 生態系小版本衝突，一律加 `--legacy-peer-deps`。

**TipTap 版本漂移**
`apple/NudgeEditor/package.json` 的 `@tiptap/*` 版本要和根目錄 `package.json` 解析後的版本**完全一致**（pin exact，不要 `^`）。檢查：

```bash
diff <(node -e "const l=require('./package-lock.json');['@tiptap/core','@tiptap/pm','@tiptap/starter-kit'].forEach(p=>console.log(p,l.packages['node_modules/'+p].version));") \
     <(cd apple/NudgeEditor && node -e "const l=require('./package-lock.json');['@tiptap/core','@tiptap/pm','@tiptap/starter-kit'].forEach(p=>console.log(p,l.packages['node_modules/'+p].version));")
```

兩邊輸出要一模一樣。

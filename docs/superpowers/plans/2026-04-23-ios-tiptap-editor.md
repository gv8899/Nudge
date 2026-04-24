# iOS / macOS TipTap Rich-Text Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 iOS / macOS 的 `RichTextEditor` 從 `NSAttributedString`-based 替換成 WKWebView 嵌 TipTap，共用 web 的 TipTap extensions，達成 H1 / bullet / checkbox / slash command / 鍵盤上方 toolbar。

**Architecture:** 新增獨立 Vite 子專案 `apple/NudgeEditor/`，透過 `resolve.alias` 引用既有 `src/components/editor/` 的 TipTap extensions；build 出 `editor.html` + `editor.js` + `editor.css` 複製到 `NudgeKit/Sources/NudgeUI/Resources/Editor/`。Swift 側 `RichTextEditor` 改為 `WKWebView` wrapper，透過 `evaluateJavaScript` / `WKScriptMessageHandler` 和 JS 溝通。公開 SwiftUI API (`@Binding var html: String`) 不變。

**Tech Stack:** Vite 5、TipTap 3.22+（現有 web 版本）、`@tiptap/core`（不用 `@tiptap/react`）、WKWebView、SwiftUI `UIViewRepresentable` / `NSViewRepresentable`、Swift 6 strict concurrency、Vitest。

**Parent Spec:** `docs/superpowers/specs/2026-04-23-ios-tiptap-editor-design.md`

---

## Scope 限制

本 plan 只實作 spec 所述編輯器替換，不改 server schema、不處理附件 / 圖片 / 協作 cursor。rollout feature flag 留給後續 ops 工作，不在此 plan。

## File Structure

**新增 JS / HTML / CSS**
- Create: `apple/NudgeEditor/package.json`
- Create: `apple/NudgeEditor/vite.config.ts`
- Create: `apple/NudgeEditor/tsconfig.json`
- Create: `apple/NudgeEditor/index.html`
- Create: `apple/NudgeEditor/.gitignore`
- Create: `apple/NudgeEditor/README.md`
- Create: `apple/NudgeEditor/build.sh`
- Create: `apple/NudgeEditor/src/main.ts`
- Create: `apple/NudgeEditor/src/bridge.ts`
- Create: `apple/NudgeEditor/src/bridge.test.ts`
- Create: `apple/NudgeEditor/src/theme.css`
- Create: `apple/NudgeEditor/src/slash-menu.ts`

**共用資料抽出（web 側小幅重構）**
- Create: `src/components/editor/slash-command-defs.ts`（抽出 `SLASH_COMMAND_DEFS` 陣列 + `filterSlashItems`，純資料無 React）
- Modify: `src/components/editor/slash-command-items.tsx`（從新的 defs 檔 re-export + 包裝翻譯）

**Swift 側**
- Modify: `apple/NudgeKit/Package.swift`（加 `Resources/Editor` 到 NudgeUI target）
- Create: `apple/NudgeKit/Sources/NudgeUI/Resources/Editor/.gitkeep`（bundle 輸出目錄，內容由 build.sh 產生）
- Create: `apple/NudgeKit/Sources/NudgeUI/Tokens/Color+Hex.swift`（`Color.cssHex(for:)` helper）
- Rewrite: `apple/NudgeKit/Sources/NudgeUI/Components/RichTextEditor.swift`
- Create: `apple/NudgeKit/Sources/NudgeUI/Components/EditorToolbar.swift`
- Create: `apple/NudgeKit/Sources/NudgeUI/Components/EditorBridge.swift`（共用 iOS / macOS 的 `WKScriptMessageHandler` coordinator + 訊息型別）

**i18n mirror**
- Modify: `apple/NudgeKit/Sources/NudgeUI/Resources/Localizable.xcstrings`（加 toolbar accessibility labels）

---

# Block A：Vite 子專案 scaffold + 共用資料抽出

### Task 1：web side — 抽出 slash command defs 成純資料檔

**Files:**
- Create: `src/components/editor/slash-command-defs.ts`
- Modify: `src/components/editor/slash-command-items.tsx`（line 35-121）

理由：iOS 的 TipTap bundle 不能吃 React。把 `SLASH_COMMAND_DEFS` 和 `filterSlashItems` 移到無 React 依賴的 `.ts` 檔，iOS / web 都 import。

- [ ] **Step 1: 建立 `slash-command-defs.ts` 抽出純資料**

```typescript
// src/components/editor/slash-command-defs.ts
import type { Editor, Range } from "@tiptap/core";

export interface SlashCommandDef {
  id: string;
  requiredExtension?: string;
  command: (args: { editor: Editor; range: Range }) => void;
}

export interface SlashCommandItem extends SlashCommandDef {
  label: string;
  description: string;
  keywords: string[];
}

export const SLASH_COMMAND_DEFS: SlashCommandDef[] = [
  {
    id: "text",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setParagraph().run();
    },
  },
  {
    id: "h1",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 1 }).run();
    },
  },
  {
    id: "h2",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 2 }).run();
    },
  },
  {
    id: "h3",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 3 }).run();
    },
  },
  {
    id: "bullet",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    id: "ordered",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    id: "todo",
    requiredExtension: "taskList",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run();
    },
  },
  {
    id: "quote",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run();
    },
  },
  {
    id: "code",
    requiredExtension: "codeBlock",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
    },
  },
  {
    id: "divider",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },
];

export function filterSlashItems<T extends SlashCommandItem>(
  items: T[],
  query: string,
  editor?: Editor,
): T[] {
  let filtered = items;

  if (editor) {
    const loadedExtensions = new Set(editor.extensionManager.extensions.map((e) => e.name));
    filtered = filtered.filter(
      (item) => !item.requiredExtension || loadedExtensions.has(item.requiredExtension),
    );
  }

  if (!query) return filtered;
  const q = query.toLowerCase();
  return filtered.filter(
    (item) =>
      item.label.toLowerCase().includes(q) ||
      item.keywords.some((k) => k.toLowerCase().includes(q)),
  );
}
```

- [ ] **Step 2: 讓 `slash-command-items.tsx` re-export + 去除重複**

把 `src/components/editor/slash-command-items.tsx` 改成：

```typescript
// src/components/editor/slash-command-items.tsx
import {
  Type, Heading1, Heading2, Heading3, List, ListOrdered, ListTodo,
  Quote, Code, Minus, type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import {
  SLASH_COMMAND_DEFS,
  filterSlashItems as filterSlashItemsBase,
  type SlashCommandItem as BaseSlashCommandItem,
} from "./slash-command-defs";

export type { SlashCommandItem } from "./slash-command-defs";
export { filterSlashItems } from "./slash-command-defs";

const ID_TO_ICON: Record<string, LucideIcon> = {
  text: Type, h1: Heading1, h2: Heading2, h3: Heading3,
  bullet: List, ordered: ListOrdered, todo: ListTodo,
  quote: Quote, code: Code, divider: Minus,
};

const ID_TO_KEY: Record<string, { label: string; description: string; keywords: string }> = {
  text: { label: "slashTextLabel", description: "slashTextDescription", keywords: "slashTextKeywords" },
  h1: { label: "slashH1Label", description: "slashH1Description", keywords: "slashH1Keywords" },
  h2: { label: "slashH2Label", description: "slashH2Description", keywords: "slashH2Keywords" },
  h3: { label: "slashH3Label", description: "slashH3Description", keywords: "slashH3Keywords" },
  bullet: { label: "slashBulletLabel", description: "slashBulletDescription", keywords: "slashBulletKeywords" },
  ordered: { label: "slashOrderedLabel", description: "slashOrderedDescription", keywords: "slashOrderedKeywords" },
  todo: { label: "slashTodoLabel", description: "slashTodoDescription", keywords: "slashTodoKeywords" },
  quote: { label: "slashQuoteLabel", description: "slashQuoteDescription", keywords: "slashQuoteKeywords" },
  code: { label: "slashCodeLabel", description: "slashCodeDescription", keywords: "slashCodeKeywords" },
  divider: { label: "slashDividerLabel", description: "slashDividerDescription", keywords: "slashDividerKeywords" },
};

export interface UISlashCommandItem extends BaseSlashCommandItem {
  icon: LucideIcon;
}

/** Hook 回傳已翻譯的 slash command items；必須在 client component 內使用 */
export function useSlashCommandItems(): UISlashCommandItem[] {
  const t = useTranslations("editor");
  return useMemo(
    () =>
      SLASH_COMMAND_DEFS.map((def) => {
        const keys = ID_TO_KEY[def.id];
        return {
          ...def,
          icon: ID_TO_ICON[def.id],
          label: t(keys.label),
          description: t(keys.description),
          keywords: t(keys.keywords).split("|").filter(Boolean),
        };
      }),
    [t],
  );
}
```

注意：`filterSlashItems` 現在 re-export 自 defs 檔，原先 signature 保持相容（因為 UISlashCommandItem extends BaseSlashCommandItem）。slash-command-menu.tsx / slash-command-extension.ts 不需改（它們只接觸 `SlashCommandItem` type）。

- [ ] **Step 3: 跑 web build + test 確認 refactor 沒破壞**

Run: `npx next build 2>&1 | tail -30`
Expected: BUILD SUCCESS, 無 type error。

Run: `npm test -- slash 2>&1 | tail` (如果有 slash 相關 test)
Expected: PASS 或 "no tests found" (都可接受)。

- [ ] **Step 4: Commit**

```bash
git add src/components/editor/slash-command-defs.ts src/components/editor/slash-command-items.tsx
git commit -m "refactor(editor): extract slash command defs to pure-data module

Split SLASH_COMMAND_DEFS + filterSlashItems out of slash-command-items.tsx
into a React-free .ts file so the upcoming iOS / macOS TipTap bundle can
import the same command data without pulling in React dependencies."
```

---

### Task 2：建立 `apple/NudgeEditor/` Vite 子專案骨架

**Files:**
- Create: `apple/NudgeEditor/package.json`
- Create: `apple/NudgeEditor/vite.config.ts`
- Create: `apple/NudgeEditor/tsconfig.json`
- Create: `apple/NudgeEditor/.gitignore`

- [ ] **Step 1: 建 `package.json`**

```json
{
  "name": "nudge-editor-bundle",
  "private": true,
  "type": "module",
  "version": "0.0.0",
  "scripts": {
    "build": "vite build",
    "dev": "vite",
    "test": "vitest run"
  },
  "dependencies": {
    "@tiptap/core": "^3.22.2",
    "@tiptap/extension-code-block-lowlight": "^3.22.3",
    "@tiptap/extension-placeholder": "^3.22.2",
    "@tiptap/extension-task-item": "^3.22.3",
    "@tiptap/extension-task-list": "^3.22.3",
    "@tiptap/pm": "^3.22.2",
    "@tiptap/starter-kit": "^3.22.2",
    "@tiptap/suggestion": "^3.22.3",
    "highlight.js": "^11.10.0",
    "lowlight": "^3.3.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vite": "^5.4.0",
    "vitest": "^2.1.0"
  }
}
```

注意：TipTap 版本要和 `<nudge-root>/package.json` 鎖住的一致，避免兩邊 ProseMirror instance 不同而相容性問題。不 include `@tiptap/react`。

- [ ] **Step 2: 建 `vite.config.ts` — single-file output + path alias**

```typescript
// apple/NudgeEditor/vite.config.ts
import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  root: __dirname,
  base: "./",
  resolve: {
    alias: {
      // 讓 src/main.ts 能 import 既有 web editor extensions
      "@web-editor": resolve(__dirname, "../../src/components/editor"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, "index.html"),
      output: {
        // 產生固定檔名，Swift 端 hardcode reference
        entryFileNames: "editor.js",
        chunkFileNames: "editor-[hash].js",
        assetFileNames: (asset) => {
          if (asset.name?.endsWith(".css")) return "editor.css";
          return "assets/[name]-[hash][extname]";
        },
      },
    },
    target: "safari16",
    sourcemap: false,
    minify: "esbuild",
  },
});
```

- [ ] **Step 3: 建 `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "baseUrl": ".",
    "paths": {
      "@web-editor/*": ["../../src/components/editor/*"]
    }
  },
  "include": ["src", "index.html"]
}
```

- [ ] **Step 4: 建 `.gitignore`**

```
node_modules/
dist/
```

- [ ] **Step 5: 跑 npm install**

Run: `cd apple/NudgeEditor && npm install 2>&1 | tail -5`
Expected: `added N packages`，無 ERR。

- [ ] **Step 6: Commit（暫不 commit `node_modules/`）**

```bash
git add apple/NudgeEditor/package.json apple/NudgeEditor/package-lock.json apple/NudgeEditor/vite.config.ts apple/NudgeEditor/tsconfig.json apple/NudgeEditor/.gitignore
git commit -m "feat(editor): scaffold apple/NudgeEditor Vite sub-project

Independent Vite workspace that will compile TipTap + extensions into a
single editor bundle for WKWebView consumption on iOS / macOS. Shares
editor-extensions.ts / slash-command-defs.ts with the web side via a
resolve.alias pointing at ../../src/components/editor."
```

---

### Task 3：proof-of-concept 引用 `editor-extensions.ts` build 得起來

**Files:**
- Create: `apple/NudgeEditor/index.html`
- Create: `apple/NudgeEditor/src/main.ts`

只做到「import 成功、build 過」，具體 TipTap 初始化留到 Block B。

- [ ] **Step 1: 建 `index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<title>Nudge Editor</title>
</head>
<body>
<div id="editor"></div>
<script type="module" src="/src/main.ts"></script>
</body>
</html>
```

- [ ] **Step 2: 建 `src/main.ts` — PoC import**

```typescript
// apple/NudgeEditor/src/main.ts
import { createEditorExtensions } from "@web-editor/editor-extensions";
import { SLASH_COMMAND_DEFS } from "@web-editor/slash-command-defs";

console.log("nudge-editor bundle loaded", {
  extensions: createEditorExtensions.name,
  slashCount: SLASH_COMMAND_DEFS.length,
});
```

- [ ] **Step 3: Build，確認 import 跨目錄 resolve 成功**

Run: `cd apple/NudgeEditor && npm run build 2>&1 | tail -20`
Expected: `✓ built in ...s`，產出 `dist/editor.html`、`dist/editor.js`。

如果 build 失敗提示找不到 `@web-editor/*`：檢查 `vite.config.ts` 的 `resolve.alias`。
如果 TipTap 版本衝突警告：把 `apple/NudgeEditor/package.json` 的版本和 root `package.json` 對齊。

- [ ] **Step 4: 用瀏覽器開 `dist/editor.html` 確認 console.log**

Run: `open apple/NudgeEditor/dist/editor.html`
Expected: browser console 印出 `nudge-editor bundle loaded { extensions: "createEditorExtensions", slashCount: 10 }`。

- [ ] **Step 5: Commit**

```bash
git add apple/NudgeEditor/index.html apple/NudgeEditor/src/main.ts
git commit -m "feat(editor): cross-dir import proof-of-concept

Verifies that Vite can resolve ../../src/components/editor/* from the
apple/NudgeEditor workspace via resolve.alias. Dist output boots in a
plain browser and logs the imported extension factory + slash defs."
```

---

# Block B：Editor JS bundle — bridge、theme、slash menu、main

### Task 4：`bridge.ts` — JS ↔ Native 訊息協定

**Files:**
- Create: `apple/NudgeEditor/src/bridge.ts`
- Create: `apple/NudgeEditor/src/bridge.test.ts`

- [ ] **Step 1: 寫測試先（測 postToNative 在有/無 WKWebView handler 時的行為）**

```typescript
// apple/NudgeEditor/src/bridge.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { postToNative, setTestHandler } from "./bridge";

describe("bridge.postToNative", () => {
  beforeEach(() => {
    setTestHandler(null);
  });

  it("no-ops when no webkit handler is present", () => {
    // 預期不丟錯
    expect(() => postToNative({ kind: "ready" })).not.toThrow();
  });

  it("forwards payload to webkit handler when present", () => {
    const spy = vi.fn();
    setTestHandler({ postMessage: spy });
    postToNative({ kind: "change", html: "<p>hi</p>" });
    expect(spy).toHaveBeenCalledWith({ kind: "change", html: "<p>hi</p>" });
  });
});
```

- [ ] **Step 2: 跑測試確認 fail**

Run: `cd apple/NudgeEditor && npm test 2>&1 | tail -20`
Expected: FAIL — `./bridge` 找不到 `postToNative`。

- [ ] **Step 3: 實作 `bridge.ts`**

```typescript
// apple/NudgeEditor/src/bridge.ts

/** JS → Native 訊息型別 */
export type NativeMessage =
  | { kind: "ready" }
  | { kind: "change"; html: string }
  | { kind: "selection"; active: ActiveMarks }
  | { kind: "height"; value: number }
  | { kind: "focus"; focused: boolean };

export interface ActiveMarks {
  heading: 1 | 2 | 3 | null;
  bulletList: boolean;
  orderedList: boolean;
  taskList: boolean;
  canUndo: boolean;
  canRedo: boolean;
}

interface WebkitHandler {
  postMessage(msg: unknown): void;
}

// test-only override
let testHandler: WebkitHandler | null = null;
export function setTestHandler(handler: WebkitHandler | null) {
  testHandler = handler;
}

function getHandler(): WebkitHandler | null {
  if (testHandler) return testHandler;
  const w = window as unknown as {
    webkit?: { messageHandlers?: { editor?: WebkitHandler } };
  };
  return w.webkit?.messageHandlers?.editor ?? null;
}

export function postToNative(msg: NativeMessage) {
  const handler = getHandler();
  if (!handler) return;
  handler.postMessage(msg);
}
```

- [ ] **Step 4: 跑測試確認 pass**

Run: `cd apple/NudgeEditor && npm test 2>&1 | tail -10`
Expected: PASS — 2 tests passing。

- [ ] **Step 5: Commit**

```bash
git add apple/NudgeEditor/src/bridge.ts apple/NudgeEditor/src/bridge.test.ts
git commit -m "feat(editor): JS↔native bridge with NativeMessage types

postToNative() wraps window.webkit.messageHandlers.editor.postMessage,
no-ops gracefully when not running inside a WKWebView so the bundle can
be opened in a plain browser for debugging. Message kinds: ready /
change / selection / height / focus."
```

---

### Task 5：`theme.css` — CSS 變數與基本樣式

**Files:**
- Create: `apple/NudgeEditor/src/theme.css`

- [ ] **Step 1: 寫 CSS**

```css
/* apple/NudgeEditor/src/theme.css */

:root {
    --nudge-background: #ffffff;
    --nudge-foreground: #1a1a1a;
    --nudge-primary: #8b6f47;
    --nudge-text-dim: #8a8a8a;
    --nudge-border: #d0d0d0;
    --nudge-border-light: #e0e0e0;
}

html, body {
    margin: 0;
    padding: 0;
    background: transparent;
    color: var(--nudge-foreground);
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
    font-size: 16px;
    line-height: 1.6;
    -webkit-text-size-adjust: 100%;
    -webkit-tap-highlight-color: transparent;
    -webkit-user-select: text;
    -webkit-touch-callout: default;
}

#editor {
    padding: 16px;
    min-height: 100vh;
}

.ProseMirror {
    outline: none;
    caret-color: var(--nudge-primary);
}

.ProseMirror h1 { font-size: 1.875rem; font-weight: 700; margin: 1em 0 0.5em; }
.ProseMirror h2 { font-size: 1.5rem;   font-weight: 700; margin: 1em 0 0.5em; }
.ProseMirror h3 { font-size: 1.25rem;  font-weight: 700; margin: 1em 0 0.5em; }
.ProseMirror p  { margin: 0.5em 0; }

.ProseMirror ul, .ProseMirror ol { padding-left: 1.5em; margin: 0.5em 0; }
.ProseMirror li { margin: 0.25em 0; }

.ProseMirror ul[data-type="taskList"] {
    list-style: none;
    padding-left: 0;
}
.ProseMirror ul[data-type="taskList"] li {
    display: flex;
    gap: 0.5em;
    align-items: flex-start;
}
.ProseMirror ul[data-type="taskList"] li > label {
    flex-shrink: 0;
    padding-top: 0.25em;
}
.ProseMirror ul[data-type="taskList"] li[data-checked="true"] > div {
    color: var(--nudge-text-dim);
    text-decoration: line-through;
}
.ProseMirror ul[data-type="taskList"] li input[type="checkbox"] {
    accent-color: var(--nudge-primary);
    width: 1.1em;
    height: 1.1em;
    margin: 0;
}

.ProseMirror blockquote {
    border-left: 3px solid var(--nudge-border);
    padding-left: 1em;
    margin: 0.5em 0;
    color: var(--nudge-text-dim);
}

.ProseMirror code {
    background: var(--nudge-border-light);
    padding: 0.1em 0.3em;
    border-radius: 3px;
    font-family: ui-monospace, SFMono-Regular, monospace;
    font-size: 0.9em;
}

.ProseMirror pre {
    background: var(--nudge-border-light);
    padding: 0.8em 1em;
    border-radius: 6px;
    overflow-x: auto;
}

.ProseMirror hr {
    border: none;
    border-top: 1px solid var(--nudge-border);
    margin: 1em 0;
}

.ProseMirror .is-editor-empty:first-child::before {
    content: attr(data-placeholder);
    color: var(--nudge-text-dim);
    float: left;
    pointer-events: none;
    height: 0;
}

/* Slash menu (plain DOM) */
.nudge-slash-menu {
    position: absolute;
    background: var(--nudge-background);
    border: 1px solid var(--nudge-border-light);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
    padding: 4px;
    min-width: 200px;
    max-height: 40vh;
    overflow-y: auto;
    z-index: 1000;
}
.nudge-slash-menu-item {
    padding: 8px 12px;
    cursor: pointer;
    border-radius: 4px;
    display: flex;
    flex-direction: column;
    gap: 2px;
}
.nudge-slash-menu-item:hover,
.nudge-slash-menu-item.is-active {
    background: var(--nudge-border-light);
}
.nudge-slash-menu-item-label {
    font-size: 14px;
    font-weight: 500;
}
.nudge-slash-menu-item-desc {
    font-size: 12px;
    color: var(--nudge-text-dim);
}
```

- [ ] **Step 2: Commit**

```bash
git add apple/NudgeEditor/src/theme.css
git commit -m "feat(editor): CSS theme with Nudge design tokens

All color values go through :root CSS vars so Swift can override at
runtime via NudgeEditor.setTheme(). Styles cover ProseMirror block
elements (h1-h3, lists, task list with checkbox checkmark + strikethrough,
blockquote, code, hr, placeholder) plus the plain-DOM slash menu."
```

---

### Task 6：`slash-menu.ts` — plain-DOM slash menu 實作

**Files:**
- Create: `apple/NudgeEditor/src/slash-menu.ts`

這是 iOS 版 slash menu renderer；不用 React。設計：Extension render 時呼叫 `mount(props)`，update 時 `update(props)`，離開時 `destroy()`。

- [ ] **Step 1: 寫 `slash-menu.ts`**

```typescript
// apple/NudgeEditor/src/slash-menu.ts
import type { SlashCommandItem } from "@web-editor/slash-command-defs";

export interface SlashMenuProps {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
  clientRect: (() => DOMRect | null) | null;
}

export interface SlashMenuHandle {
  update(props: SlashMenuProps): void;
  destroy(): void;
  onKeyDown(event: KeyboardEvent): boolean;
}

export function mountSlashMenu(props: SlashMenuProps, labels: Record<string, { label: string; description: string }>): SlashMenuHandle {
  let selectedIndex = 0;
  let current = props;

  const container = document.createElement("div");
  container.className = "nudge-slash-menu";
  document.body.appendChild(container);

  function render() {
    container.innerHTML = "";
    current.items.forEach((item, idx) => {
      const itemEl = document.createElement("div");
      itemEl.className = "nudge-slash-menu-item" + (idx === selectedIndex ? " is-active" : "");
      const labelInfo = labels[item.id] ?? { label: item.label, description: item.description };

      const labelEl = document.createElement("div");
      labelEl.className = "nudge-slash-menu-item-label";
      labelEl.textContent = labelInfo.label;
      itemEl.appendChild(labelEl);

      const descEl = document.createElement("div");
      descEl.className = "nudge-slash-menu-item-desc";
      descEl.textContent = labelInfo.description;
      itemEl.appendChild(descEl);

      itemEl.addEventListener("mousedown", (e) => {
        e.preventDefault();
        current.command(item);
      });
      itemEl.addEventListener("touchstart", (e) => {
        e.preventDefault();
        current.command(item);
      });
      container.appendChild(itemEl);
    });
    positionMenu();
  }

  function positionMenu() {
    const rect = current.clientRect?.();
    if (!rect) return;
    const menuHeight = container.offsetHeight || 200;
    const vp = window.visualViewport;
    const viewportBottom = vp ? vp.offsetTop + vp.height : window.innerHeight;
    const roomBelow = viewportBottom - rect.bottom;
    const placeAbove = roomBelow < menuHeight + 8;
    const top = placeAbove ? rect.top - menuHeight - 4 : rect.bottom + 4;
    container.style.top = `${Math.max(8, top)}px`;
    container.style.left = `${rect.left}px`;
  }

  render();

  return {
    update(props: SlashMenuProps) {
      current = props;
      if (selectedIndex >= current.items.length) selectedIndex = 0;
      render();
    },
    destroy() {
      container.remove();
    },
    onKeyDown(event: KeyboardEvent): boolean {
      if (event.key === "ArrowDown") {
        selectedIndex = (selectedIndex + 1) % current.items.length;
        render();
        return true;
      }
      if (event.key === "ArrowUp") {
        selectedIndex = (selectedIndex - 1 + current.items.length) % current.items.length;
        render();
        return true;
      }
      if (event.key === "Enter") {
        const item = current.items[selectedIndex];
        if (item) {
          current.command(item);
          return true;
        }
      }
      if (event.key === "Escape") {
        return true;
      }
      return false;
    },
  };
}
```

- [ ] **Step 2: Type-check build**

Run: `cd apple/NudgeEditor && npx tsc --noEmit 2>&1 | tail`
Expected: 無 error。

- [ ] **Step 3: Commit**

```bash
git add apple/NudgeEditor/src/slash-menu.ts
git commit -m "feat(editor): plain-DOM slash menu for iOS / macOS WKWebView

Implements render / update / destroy lifecycle with keyboard navigation
(ArrowUp / ArrowDown / Enter / Escape). Positioning accounts for
visualViewport height so the menu flips above the cursor when the
on-screen keyboard would clip it. Labels come from a caller-supplied
dictionary so iOS can pass Swift-resolved translations."
```

---

### Task 7：`main.ts` — TipTap init + `window.NudgeEditor`

**Files:**
- Modify: `apple/NudgeEditor/src/main.ts`（替換 PoC 內容）
- Modify: `apple/NudgeEditor/index.html`（import CSS）

- [ ] **Step 1: 更新 `index.html` import CSS**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<title>Nudge Editor</title>
</head>
<body>
<div id="editor"></div>
<script type="module" src="/src/main.ts"></script>
</body>
</html>
```

（內容其實沒變，CSS 由 main.ts import）

- [ ] **Step 2: 實作 `main.ts`**

```typescript
// apple/NudgeEditor/src/main.ts
import { Editor } from "@tiptap/core";
import { createEditorExtensions } from "@web-editor/editor-extensions";
import {
  SLASH_COMMAND_DEFS,
  filterSlashItems,
  type SlashCommandItem,
} from "@web-editor/slash-command-defs";
import { slashCommandExtension } from "@web-editor/slash-command-extension";
import { postToNative, type ActiveMarks } from "./bridge";
import { mountSlashMenu, type SlashMenuHandle } from "./slash-menu";
import "./theme.css";

interface LabelDict {
  [id: string]: { label: string; description: string; keywords: string };
}

let editor: Editor | null = null;
let labels: LabelDict = {};
let suppressChange = false;

function buildSlashItems(): SlashCommandItem[] {
  return SLASH_COMMAND_DEFS.map((def) => {
    const entry = labels[def.id] ?? { label: def.id, description: "", keywords: "" };
    return {
      ...def,
      label: entry.label,
      description: entry.description,
      keywords: entry.keywords.split("|").filter(Boolean),
    };
  });
}

function computeActive(): ActiveMarks {
  if (!editor) {
    return {
      heading: null, bulletList: false, orderedList: false,
      taskList: false, canUndo: false, canRedo: false,
    };
  }
  const heading =
    editor.isActive("heading", { level: 1 }) ? 1
    : editor.isActive("heading", { level: 2 }) ? 2
    : editor.isActive("heading", { level: 3 }) ? 3
    : null;
  return {
    heading,
    bulletList: editor.isActive("bulletList"),
    orderedList: editor.isActive("orderedList"),
    taskList: editor.isActive("taskList"),
    canUndo: editor.can().undo(),
    canRedo: editor.can().redo(),
  };
}

function setupSlashCommandRenderer() {
  // slashCommandExtension.configure() 會吃 items + render；我們這邊為 iOS
  // 蓋掉原本的 React-based render，換成 plain-DOM。
  return slashCommandExtension.configure({
    items: buildSlashItems(),
    render: () => {
      let handle: SlashMenuHandle | null = null;
      return {
        onStart(props: any) {
          const filtered = filterSlashItems(props.items, props.query, props.editor);
          handle = mountSlashMenu(
            {
              items: filtered,
              command: (item) => props.command(item),
              clientRect: props.clientRect,
            },
            labels,
          );
        },
        onUpdate(props: any) {
          const filtered = filterSlashItems(props.items, props.query, props.editor);
          handle?.update({
            items: filtered,
            command: (item) => props.command(item),
            clientRect: props.clientRect,
          });
        },
        onKeyDown(props: any) {
          return handle?.onKeyDown(props.event) ?? false;
        },
        onExit() {
          handle?.destroy();
          handle = null;
        },
      };
    },
  } as any);
}

function createEditor(placeholder: string) {
  const baseExts = createEditorExtensions({
    placeholder,
    slashItems: buildSlashItems() as any,
  }).filter((e: any) => e.name !== "slashCommand");

  editor = new Editor({
    element: document.getElementById("editor") as HTMLElement,
    extensions: [...baseExts, setupSlashCommandRenderer()],
    content: "",
    editorProps: {
      attributes: { class: "ProseMirror" },
    },
    onUpdate: ({ editor }) => {
      if (!suppressChange) {
        postToNative({ kind: "change", html: editor.getHTML() });
      }
      postToNative({ kind: "selection", active: computeActive() });
    },
    onSelectionUpdate: () => {
      postToNative({ kind: "selection", active: computeActive() });
    },
    onFocus: () => postToNative({ kind: "focus", focused: true }),
    onBlur: () => postToNative({ kind: "focus", focused: false }),
  });

  const ro = new ResizeObserver(() => {
    postToNative({ kind: "height", value: document.body.scrollHeight });
  });
  ro.observe(document.body);
}

interface NudgeEditorAPI {
  load(html: string): void;
  getHTML(): string;
  exec(command: string, args?: Record<string, unknown>): void;
  focus(): void;
  setTheme(tokens: Record<string, string>): void;
  setLabels(dict: LabelDict): void;
}

const api: NudgeEditorAPI = {
  load(html: string) {
    if (!editor) return;
    suppressChange = true;
    editor.commands.setContent(html || "", { emitUpdate: false });
    suppressChange = false;
  },
  getHTML() {
    return editor?.getHTML() ?? "";
  },
  exec(command: string, args?: Record<string, unknown>) {
    if (!editor) return;
    const chain = editor.chain().focus();
    switch (command) {
      case "toggleHeading":
        (chain as any).toggleHeading({ level: (args?.level as number) ?? 1 }).run();
        break;
      case "toggleBulletList":
        chain.toggleBulletList().run();
        break;
      case "toggleOrderedList":
        chain.toggleOrderedList().run();
        break;
      case "toggleTaskList":
        (chain as any).toggleTaskList().run();
        break;
      case "undo":
        chain.undo().run();
        break;
      case "redo":
        chain.redo().run();
        break;
      case "blur":
        editor.commands.blur();
        break;
      default:
        console.warn("[NudgeEditor] unknown command", command);
    }
  },
  focus() {
    editor?.commands.focus();
  },
  setTheme(tokens: Record<string, string>) {
    const root = document.documentElement;
    const map: Record<string, string> = {
      background: "--nudge-background",
      foreground: "--nudge-foreground",
      primary: "--nudge-primary",
      textDim: "--nudge-text-dim",
      border: "--nudge-border",
      borderLight: "--nudge-border-light",
    };
    for (const [k, cssVar] of Object.entries(map)) {
      const v = tokens[k];
      if (v) root.style.setProperty(cssVar, v);
    }
  },
  setLabels(dict: LabelDict) {
    labels = dict;
  },
};

(window as any).NudgeEditor = api;

// 啟動：先建一個 editor（無 placeholder），ready 送出去；Swift 側會接著呼叫 setTheme、
// setLabels、load。
createEditor("");
postToNative({ kind: "ready" });
```

- [ ] **Step 3: Type-check + build**

Run: `cd apple/NudgeEditor && npx tsc --noEmit 2>&1 | tail`
Expected: 無 error（`as any` 的地方是故意 bypass TipTap suggestion extension 和部分 chain 方法的 TS 型別，實際 runtime 沒問題）。

Run: `cd apple/NudgeEditor && npm run build 2>&1 | tail -5`
Expected: `✓ built`，產生 `dist/index.html`（`base: "./"` + rollupOptions input 指向 `index.html`）、`dist/editor.js`、`dist/editor.css`。

- [ ] **Step 4: 瀏覽器 smoke test**

Run: `open apple/NudgeEditor/dist/index.html`
Expected：頁面載入，空 `#editor` 區域可點擊 focus，輸入文字有反應。Console 會有 `postToNative no-op` 不存在（我們的 handler 檢查是 return）— 無錯。

- [ ] **Step 5: Rename output — 讓 Swift 好 load**

build 出的 `dist/index.html` 讓檔案名不好辨識。在 `build.sh` 階段會 rename，但先確認 build 產的內容：

Run: `ls apple/NudgeEditor/dist/`
Expected: 至少看到 `index.html`、`editor.js`、`editor.css`。

- [ ] **Step 6: Commit**

```bash
git add apple/NudgeEditor/src/main.ts apple/NudgeEditor/index.html
git commit -m "feat(editor): TipTap init + window.NudgeEditor API surface

Boots a TipTap Editor in #editor, exposes load / getHTML / exec / focus /
setTheme / setLabels on window.NudgeEditor for Swift to call via
evaluateJavaScript. Reports change / selection / height / focus / ready
events via bridge.postToNative. Plain-DOM slash menu replaces the web
side's React renderer."
```

---

### Task 8：`build.sh` — build + 複製到 NudgeKit Resources

**Files:**
- Create: `apple/NudgeEditor/build.sh`
- Create: `apple/NudgeKit/Sources/NudgeUI/Resources/Editor/.gitkeep`

- [ ] **Step 1: 建 `.gitkeep`**

```bash
mkdir -p apple/NudgeKit/Sources/NudgeUI/Resources/Editor
touch apple/NudgeKit/Sources/NudgeUI/Resources/Editor/.gitkeep
```

- [ ] **Step 2: 建 `build.sh`**

```bash
#!/usr/bin/env bash
# apple/NudgeEditor/build.sh
# Build the Vite editor bundle and copy outputs into the NudgeUI
# Swift-Package resources directory. Run before Xcode build, or as a
# pre-commit step when src/components/editor/* changes.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

DEST="$SCRIPT_DIR/../NudgeKit/Sources/NudgeUI/Resources/Editor"

echo "→ npm install (skip if lock unchanged)"
npm install --silent --no-audit --no-fund

echo "→ vite build"
npm run build --silent

echo "→ copy dist/ → $DEST"
rm -rf "$DEST"
mkdir -p "$DEST"
# 複製 index.html → editor.html + editor.js + editor.css (+ 可能的 asset)
cp dist/index.html "$DEST/editor.html"
cp dist/editor.js "$DEST/editor.js"
if [ -f dist/editor.css ]; then
    cp dist/editor.css "$DEST/editor.css"
fi
# assets/ 子目錄（若有 hashed chunk）
if [ -d dist/assets ]; then
    cp -R dist/assets "$DEST/"
fi

echo "✓ editor bundle copied"
```

- [ ] **Step 3: chmod + 跑一次**

Run: `chmod +x apple/NudgeEditor/build.sh && apple/NudgeEditor/build.sh 2>&1 | tail -10`
Expected: 最後一行 `✓ editor bundle copied`。

- [ ] **Step 4: 驗證輸出**

Run: `ls apple/NudgeKit/Sources/NudgeUI/Resources/Editor/`
Expected: 看到 `editor.html`、`editor.js`、`editor.css`（和 `.gitkeep`）。

- [ ] **Step 5: 更新 `apple/NudgeEditor/.gitignore` — 確保 dist/ 不進 git**

Already done in Task 2. 跑 `git status apple/NudgeEditor/dist/` 應該 empty。

- [ ] **Step 6: Commit**

```bash
git add apple/NudgeEditor/build.sh apple/NudgeKit/Sources/NudgeUI/Resources/Editor/
git commit -m "feat(editor): build.sh builds bundle + copies into NudgeUI resources

Single script that runs npm install (idempotent), vite build, and copies
dist/ to NudgeKit/Sources/NudgeUI/Resources/Editor/. The destination is
tracked in git (without .gitkeep) so Xcode sees the bundle as Swift
Package resources."
```

---

### Task 9：`apple/NudgeEditor/README.md`

**Files:**
- Create: `apple/NudgeEditor/README.md`

- [ ] **Step 1: 寫 README**

```markdown
# Nudge Editor Bundle

獨立的 Vite 子專案，把 TipTap 編輯器（連同 `src/components/editor/` 裡的 extensions）打包成單一 HTML / JS / CSS bundle，供 iOS / macOS `RichTextEditor.swift` 的 WKWebView 載入。

## 為什麼要獨立一個 workspace

- Web 端 TipTap 依賴 React (`@tiptap/react`)；WKWebView 不需要 React runtime
- Bundle 要離線 ship 在 app 裡，需要明確的 build output（`editor.html` / `editor.js` / `editor.css`）
- 主 Next.js build 不適合 tree-shake 出一個子 bundle，Vite 對這種單檔場景簡單得多

## 共用的東西

`vite.config.ts` 的 `resolve.alias` 把 `@web-editor/*` 指到 `../../src/components/editor/`，所以：

- `editor-extensions.ts`（StarterKit + TaskList + SplitTaskList 等）
- `slash-command-defs.ts`（slash items 純資料）
- `slash-command-extension.ts`（TipTap extension）

這三個檔 iOS 和 web 共用。Web 改動會影響 iOS，**記得 rebuild bundle**（見下）。

不共用的：

- slash menu UI（web 用 React、iOS 用 plain DOM，見 `src/slash-menu.ts`）
- placeholder / i18n 文字（iOS 由 Swift 透過 `setLabels` 注入）

## Build / Development

### 第一次 setup

```bash
cd apple/NudgeEditor
npm install
```

### 重 build（每次改 `src/components/editor/*` 或 `apple/NudgeEditor/src/*` 後）

```bash
apple/NudgeEditor/build.sh
```

輸出會複製到 `apple/NudgeKit/Sources/NudgeUI/Resources/Editor/`。Swift Package 會自動把它當 resource bundle 簽進 app。

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

## CI

參見根目錄 `.github/workflows/` — `editor-bundle.yml` step 會跑一次 `build.sh` 確保 bundle 建得起來。

## Troubleshooting

**Vite build 失敗找不到 `@web-editor/*`**：檢查 `vite.config.ts` 的 alias 和 `tsconfig.json` 的 paths 是否一致，且 `../../src/components/editor/<name>.ts` 檔案存在。

**iOS load 出空白**：
1. `ls apple/NudgeKit/Sources/NudgeUI/Resources/Editor/` 有沒有 `editor.html`
2. Package.swift 的 `resources` 是否包含 `Editor` 子目錄
3. Swift 有沒有用 `loadFileURL(..., allowingReadAccessTo: <Editor dir>)`（單檔 load 會被 CORS block css/js relative import）

**TipTap 版本警告**：`apple/NudgeEditor/package.json` 的 `@tiptap/*` 版本應該和根目錄一致。
```

- [ ] **Step 2: Commit**

```bash
git add apple/NudgeEditor/README.md
git commit -m "docs(editor): apple/NudgeEditor README with build + share model

Documents how the bundle shares TipTap extensions with the web side via
resolve.alias, how to rebuild after editor changes, and common failure
modes (missing alias, WKWebView CORS, version drift)."
```

---

# Block C：Swift Package resources + helper

### Task 10：`Package.swift` 加入 `Resources/Editor`

**Files:**
- Modify: `apple/NudgeKit/Package.swift` (line 21-24)

- [ ] **Step 1: 修改 resources array**

將

```swift
resources: [
    .process("Resources/Assets.xcassets"),
    .process("Resources/Localizable.xcstrings")
]
```

改成

```swift
resources: [
    .process("Resources/Assets.xcassets"),
    .process("Resources/Localizable.xcstrings"),
    .copy("Resources/Editor")
]
```

用 `.copy` 而非 `.process`：`.process` 會試圖優化 html / js（對 webkit bundle 不適合），`.copy` 是 raw 複製，整個子目錄保留結構。

- [ ] **Step 2: 重 build 確認 Package 認得**

Run: `cd apple/NudgeKit && swift build 2>&1 | tail -5`
Expected: `Build complete!`

- [ ] **Step 3: Commit**

```bash
git add apple/NudgeKit/Package.swift
git commit -m "chore(NudgeKit): include editor bundle in NudgeUI resources

Uses .copy instead of .process so the HTML / JS / CSS files pass through
the Swift Package build without being mangled by the resource processor."
```

---

### Task 11：`Color+Hex.swift` — Color → CSS hex helper

**Files:**
- Create: `apple/NudgeKit/Sources/NudgeUI/Tokens/Color+Hex.swift`

SwiftUI 要把 `Color.nudgeBackground` 這類 token 轉成 `#RRGGBB` 字串傳給 JS。

- [ ] **Step 1: 實作**

```swift
// apple/NudgeKit/Sources/NudgeUI/Tokens/Color+Hex.swift
import SwiftUI

#if os(iOS)
import UIKit
typealias PlatformColor = UIColor
#else
import AppKit
typealias PlatformColor = NSColor
#endif

extension Color {
    /// Resolve the Color to a platform-native color under a specific
    /// color-scheme, then emit `#RRGGBB`. Needed for WKWebView JS that
    /// can't read SwiftUI Color directly.
    @MainActor
    func cssHex(for scheme: ColorScheme) -> String {
        #if os(iOS)
        let trait = UITraitCollection(userInterfaceStyle: scheme == .dark ? .dark : .light)
        let resolved = UIColor(self).resolvedColor(with: trait)
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        resolved.getRed(&r, green: &g, blue: &b, alpha: &a)
        #else
        let appearance = NSAppearance(named: scheme == .dark ? .darkAqua : .aqua)
        let ns = NSColor(self)
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        if let appearance {
            appearance.performAsCurrentDrawingAppearance {
                let rgb = ns.usingColorSpace(.sRGB) ?? ns
                rgb.getRed(&r, green: &g, blue: &b, alpha: &a)
            }
        } else {
            let rgb = ns.usingColorSpace(.sRGB) ?? ns
            rgb.getRed(&r, green: &g, blue: &b, alpha: &a)
        }
        #endif
        let ri = Int((r * 255).rounded())
        let gi = Int((g * 255).rounded())
        let bi = Int((b * 255).rounded())
        return String(format: "#%02X%02X%02X", ri, gi, bi)
    }
}
```

- [ ] **Step 2: 確認 build**

Run: `cd apple/NudgeKit && swift build 2>&1 | tail -3`
Expected: `Build complete!`

（無 unit test — 這是直接依賴系統 API 的 helper，manual 驗證在後續整合 task）

- [ ] **Step 3: Commit**

```bash
git add apple/NudgeKit/Sources/NudgeUI/Tokens/Color+Hex.swift
git commit -m "feat(tokens): Color.cssHex(for:) helper for WKWebView theme

Resolves a SwiftUI Color under a specific ColorScheme and emits
#RRGGBB. Used by the upcoming RichTextEditor to push theme tokens into
the TipTap bundle whenever system dark mode changes."
```

---

# Block D：Swift `EditorBridge` + `RichTextEditor` 改寫

### Task 12：`EditorBridge.swift` — 訊息型別 + Coordinator

**Files:**
- Create: `apple/NudgeKit/Sources/NudgeUI/Components/EditorBridge.swift`

共用 iOS / macOS 的 `WKScriptMessageHandler` coordinator。

- [ ] **Step 1: 實作**

```swift
// apple/NudgeKit/Sources/NudgeUI/Components/EditorBridge.swift
import Foundation
import SwiftUI
import WebKit

/// 對應 JS bridge.ts 的 NativeMessage 型別（一致順序）。
enum EditorNativeMessage {
    case ready
    case change(html: String)
    case selection(ActiveMarks)
    case height(CGFloat)
    case focus(Bool)

    static func parse(_ body: Any) -> EditorNativeMessage? {
        guard let dict = body as? [String: Any],
              let kind = dict["kind"] as? String else { return nil }
        switch kind {
        case "ready":
            return .ready
        case "change":
            return .change(html: dict["html"] as? String ?? "")
        case "selection":
            if let active = dict["active"] as? [String: Any] {
                return .selection(ActiveMarks(payload: active))
            }
            return nil
        case "height":
            if let v = dict["value"] as? Double { return .height(CGFloat(v)) }
            return nil
        case "focus":
            if let f = dict["focused"] as? Bool { return .focus(f) }
            return nil
        default:
            return nil
        }
    }
}

public struct ActiveMarks: Equatable, Sendable {
    public var heading: Int? = nil
    public var bulletList = false
    public var orderedList = false
    public var taskList = false
    public var canUndo = false
    public var canRedo = false

    public init() {}

    init(payload: [String: Any]) {
        self.heading = payload["heading"] as? Int
        self.bulletList = payload["bulletList"] as? Bool ?? false
        self.orderedList = payload["orderedList"] as? Bool ?? false
        self.taskList = payload["taskList"] as? Bool ?? false
        self.canUndo = payload["canUndo"] as? Bool ?? false
        self.canRedo = payload["canRedo"] as? Bool ?? false
    }
}

/// 共用 coordinator：管 WKWebView message handling + load/change flow。
/// iOS 用 UIViewRepresentable、macOS 用 NSViewRepresentable，兩邊都呼叫這個。
@MainActor
final class EditorCoordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
    var htmlBinding: Binding<String>
    var onActiveMarks: (ActiveMarks) -> Void
    var onHeight: (CGFloat) -> Void
    var placeholder: String
    var labels: [String: [String: String]]

    private(set) weak var webView: WKWebView?
    private(set) var isReady = false
    private var pendingLoadHTML: String?
    var lastEmittedHTML: String = ""
    private var currentScheme: ColorScheme?

    init(
        htmlBinding: Binding<String>,
        placeholder: String,
        labels: [String: [String: String]],
        onActiveMarks: @escaping (ActiveMarks) -> Void,
        onHeight: @escaping (CGFloat) -> Void
    ) {
        self.htmlBinding = htmlBinding
        self.placeholder = placeholder
        self.labels = labels
        self.onActiveMarks = onActiveMarks
        self.onHeight = onHeight
    }

    func attach(webView: WKWebView) {
        self.webView = webView
        webView.configuration.userContentController.add(self, name: "editor")
        webView.navigationDelegate = self
    }

    // 載入 editor.html bundle
    func loadBundle() {
        guard let webView else { return }
        guard let url = Bundle.module.url(
            forResource: "editor",
            withExtension: "html",
            subdirectory: "Editor"
        ) else {
            print("[EditorCoordinator] bundle missing editor.html")
            return
        }
        let base = url.deletingLastPathComponent()
        webView.loadFileURL(url, allowingReadAccessTo: base)
    }

    // Binding → JS；避免把自己剛發出去的值 echo 回去
    func applyIncomingHTMLIfNeeded() {
        guard isReady, let webView else {
            pendingLoadHTML = htmlBinding.wrappedValue
            return
        }
        let target = htmlBinding.wrappedValue
        if target != lastEmittedHTML {
            let escaped = escapeForJS(target)
            webView.evaluateJavaScript("NudgeEditor.load(\(escaped))")
            lastEmittedHTML = target
        }
    }

    func pushTheme(scheme: ColorScheme) {
        guard isReady, let webView else { return }
        if currentScheme == scheme { return }
        currentScheme = scheme
        let tokens: [String: String] = [
            "background": Color.nudgeBackground.cssHex(for: scheme),
            "foreground": Color.nudgeForeground.cssHex(for: scheme),
            "primary": Color.nudgePrimary.cssHex(for: scheme),
            "textDim": Color.nudgeTextDim.cssHex(for: scheme),
            "border": Color.nudgeBorder.cssHex(for: scheme),
            "borderLight": Color.nudgeBorderLight.cssHex(for: scheme),
        ]
        guard let data = try? JSONSerialization.data(withJSONObject: tokens),
              let json = String(data: data, encoding: .utf8) else { return }
        webView.evaluateJavaScript("NudgeEditor.setTheme(\(json))")
    }

    func pushLabels() {
        guard isReady, let webView else { return }
        guard let data = try? JSONSerialization.data(withJSONObject: labels),
              let json = String(data: data, encoding: .utf8) else { return }
        webView.evaluateJavaScript("NudgeEditor.setLabels(\(json))")
    }

    func exec(_ command: EditorCommand) {
        guard isReady, let webView else { return }
        let js: String
        switch command {
        case .undo: js = "NudgeEditor.exec('undo')"
        case .redo: js = "NudgeEditor.exec('redo')"
        case .toggleHeading(let level):
            js = "NudgeEditor.exec('toggleHeading', {level: \(level)})"
        case .toggleBulletList: js = "NudgeEditor.exec('toggleBulletList')"
        case .toggleOrderedList: js = "NudgeEditor.exec('toggleOrderedList')"
        case .toggleTaskList: js = "NudgeEditor.exec('toggleTaskList')"
        case .blur: js = "NudgeEditor.exec('blur')"
        }
        webView.evaluateJavaScript(js)
    }

    // MARK: - WKScriptMessageHandler

    func userContentController(_ userContentController: WKUserContentController,
                               didReceive message: WKScriptMessage) {
        guard let event = EditorNativeMessage.parse(message.body) else { return }
        switch event {
        case .ready:
            isReady = true
            pushLabels()
            if let scheme = currentScheme {
                pushTheme(scheme: scheme)
            }
            let initial = pendingLoadHTML ?? htmlBinding.wrappedValue
            lastEmittedHTML = initial
            let escaped = escapeForJS(initial)
            webView?.evaluateJavaScript("NudgeEditor.load(\(escaped))")
            pendingLoadHTML = nil
        case .change(let html):
            lastEmittedHTML = html
            htmlBinding.wrappedValue = html
        case .selection(let active):
            onActiveMarks(active)
        case .height(let h):
            onHeight(h)
        case .focus:
            break  // 目前不使用；保留給未來 toolbar 顯示判斷
        }
    }

    // MARK: - Private

    private func escapeForJS(_ s: String) -> String {
        // JSON-encode the string so that any quotes / newlines / <script> tags
        // are safely escaped for embedding inside evaluateJavaScript.
        guard let data = try? JSONSerialization.data(
            withJSONObject: [s], options: [.fragmentsAllowed]
        ) else { return "\"\"" }
        guard let str = String(data: data, encoding: .utf8) else { return "\"\"" }
        // strip the [ ] wrapping → just the quoted string
        let trimmed = str.trimmingCharacters(in: CharacterSet(charactersIn: "[]"))
        return trimmed
    }
}

public enum EditorCommand: Equatable {
    case undo, redo
    case toggleHeading(level: Int)
    case toggleBulletList
    case toggleOrderedList
    case toggleTaskList
    case blur
}
```

- [ ] **Step 2: 確認 build**

Run: `cd apple/NudgeKit && swift build 2>&1 | tail -3`
Expected: `Build complete!`

- [ ] **Step 3: Commit**

```bash
git add apple/NudgeKit/Sources/NudgeUI/Components/EditorBridge.swift
git commit -m "feat(editor): EditorCoordinator + bridge message types

Shared iOS / macOS coordinator: loads editor.html from the NudgeUI
resource bundle, parses JS postMessage payloads into EditorNativeMessage,
pushes the current SwiftUI binding / theme / labels down via
evaluateJavaScript. exec() dispatches EditorCommand cases to
NudgeEditor.exec(). Guards against echoing back the editor's own edits."
```

---

### Task 13：改寫 `RichTextEditor.swift` — WKWebView 版（iOS + macOS）

**Files:**
- Rewrite: `apple/NudgeKit/Sources/NudgeUI/Components/RichTextEditor.swift`

整檔替換。舊的 `HTMLAttributed` / `UIKitRichTextEditor` / `AppKitRichTextEditor` 全刪。

- [ ] **Step 1: 替換整個檔案內容**

```swift
// apple/NudgeKit/Sources/NudgeUI/Components/RichTextEditor.swift
import SwiftUI
import WebKit

/// Rich-text editor backed by WKWebView + TipTap.
/// Public API unchanged from the previous NSAttributedString version:
/// caller owns HTML string, editor reports back updated HTML on each edit.
///
/// Ships with activeMarks state for an attached EditorToolbar; if no
/// toolbar is wired up the activeMarks binding can be nil.
public struct RichTextEditor: View {
    @Binding var html: String
    let placeholder: String
    let activeMarks: Binding<ActiveMarks>?
    let commandBus: EditorCommandBus?

    @Environment(\.colorScheme) private var colorScheme
    @State private var contentHeight: CGFloat = 0

    public init(
        html: Binding<String>,
        placeholder: String = "",
        activeMarks: Binding<ActiveMarks>? = nil,
        commandBus: EditorCommandBus? = nil
    ) {
        self._html = html
        self.placeholder = placeholder
        self.activeMarks = activeMarks
        self.commandBus = commandBus
    }

    public var body: some View {
        editorView
            .frame(minHeight: max(120, contentHeight))
    }

    @ViewBuilder
    private var editorView: some View {
        #if os(iOS)
        UIKitEditor(
            html: $html,
            placeholder: placeholder,
            colorScheme: colorScheme,
            labels: Self.labelsDict(),
            onActiveMarks: { marks in activeMarks?.wrappedValue = marks },
            onHeight: { h in contentHeight = h },
            commandBus: commandBus
        )
        #else
        AppKitEditor(
            html: $html,
            placeholder: placeholder,
            colorScheme: colorScheme,
            labels: Self.labelsDict(),
            onActiveMarks: { marks in activeMarks?.wrappedValue = marks },
            onHeight: { h in contentHeight = h },
            commandBus: commandBus
        )
        #endif
    }

    private static func labelsDict() -> [String: [String: String]] {
        // Swift 側從 xcstrings 解 10 個 slash command label + description + keywords
        let ids = ["text", "h1", "h2", "h3", "bullet", "ordered", "todo", "quote", "code", "divider"]
        var result: [String: [String: String]] = [:]
        for id in ids {
            result[id] = [
                "label": NSLocalizedString("editor.slash\(id.capitalized)Label", bundle: .module, comment: ""),
                "description": NSLocalizedString("editor.slash\(id.capitalized)Description", bundle: .module, comment: ""),
                "keywords": NSLocalizedString("editor.slash\(id.capitalized)Keywords", bundle: .module, comment: ""),
            ]
        }
        return result
    }
}

/// Commands come from the toolbar into the editor. Using a class ref
/// so the same bus can be shared between RichTextEditor and its sibling
/// EditorToolbar without parent-view restructure.
@MainActor
public final class EditorCommandBus {
    fileprivate var handler: ((EditorCommand) -> Void)?
    public init() {}

    public func send(_ command: EditorCommand) {
        handler?(command)
    }
}

#if os(iOS)
import UIKit

private struct UIKitEditor: UIViewRepresentable {
    @Binding var html: String
    let placeholder: String
    let colorScheme: ColorScheme
    let labels: [String: [String: String]]
    let onActiveMarks: (ActiveMarks) -> Void
    let onHeight: (CGFloat) -> Void
    let commandBus: EditorCommandBus?

    func makeCoordinator() -> EditorCoordinator {
        EditorCoordinator(
            htmlBinding: $html,
            placeholder: placeholder,
            labels: labels,
            onActiveMarks: onActiveMarks,
            onHeight: onHeight
        )
    }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.defaultWebpagePreferences.allowsContentJavaScript = true
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.bounces = false
        #if swift(>=5.9)
        webView.isInspectable = true
        #endif
        context.coordinator.attach(webView: webView)
        context.coordinator.pushTheme(scheme: colorScheme)
        context.coordinator.loadBundle()
        commandBus?.handler = { [weak coord = context.coordinator] cmd in
            coord?.exec(cmd)
        }
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {
        context.coordinator.pushTheme(scheme: colorScheme)
        context.coordinator.applyIncomingHTMLIfNeeded()
    }
}
#endif

#if os(macOS)
import AppKit

private struct AppKitEditor: NSViewRepresentable {
    @Binding var html: String
    let placeholder: String
    let colorScheme: ColorScheme
    let labels: [String: [String: String]]
    let onActiveMarks: (ActiveMarks) -> Void
    let onHeight: (CGFloat) -> Void
    let commandBus: EditorCommandBus?

    func makeCoordinator() -> EditorCoordinator {
        EditorCoordinator(
            htmlBinding: $html,
            placeholder: placeholder,
            labels: labels,
            onActiveMarks: onActiveMarks,
            onHeight: onHeight
        )
    }

    func makeNSView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.defaultWebpagePreferences.allowsContentJavaScript = true
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.setValue(false, forKey: "drawsBackground")
        #if swift(>=5.9)
        webView.isInspectable = true
        #endif
        context.coordinator.attach(webView: webView)
        context.coordinator.pushTheme(scheme: colorScheme)
        context.coordinator.loadBundle()
        commandBus?.handler = { [weak coord = context.coordinator] cmd in
            coord?.exec(cmd)
        }
        return webView
    }

    func updateNSView(_ nsView: WKWebView, context: Context) {
        context.coordinator.pushTheme(scheme: colorScheme)
        context.coordinator.applyIncomingHTMLIfNeeded()
    }
}
#endif
```

- [ ] **Step 2: 加 i18n keys — toolbar 會用到的 accessibility labels**

Read `apple/NudgeKit/Sources/NudgeUI/Resources/Localizable.xcstrings`，確認以下 key 已存在；若無則插入（字母順序位置）：

需要的 key（每個都要 zh-Hant / en / ja）：

| key | zh-Hant | en | ja |
|------|---------|----|----|
| `editor.toolbarUndo` | 還原 | Undo | 元に戻す |
| `editor.toolbarRedo` | 重做 | Redo | やり直し |
| `editor.toolbarHeading` | 標題 | Heading | 見出し |
| `editor.toolbarBullet` | 項目符號 | Bullet list | 箇条書き |
| `editor.toolbarOrdered` | 數字清單 | Numbered list | 番号付きリスト |
| `editor.toolbarTaskList` | 核取清單 | Task list | チェックリスト |
| `editor.toolbarDismiss` | 收鍵盤 | Dismiss keyboard | キーボードを閉じる |

另外，slash command labels（從 web `src/messages/*.json` 鏡像，key = `editor.slashXxxLabel / Description / Keywords`）應該已經存在 — 先確認；沒有則補。

Run: `python3 -c "
import json
for f in ['zh-TW', 'en', 'ja']:
    d = json.load(open(f'src/messages/{f}.json'))
    editor = d.get('editor', {})
    keys = [k for k in editor.keys() if k.startswith('slash')]
    print(f, sorted(keys))
"`

Expected：三個 locale 都有 30 個 slash* keys（10 個 × 3 個 suffix）。如果有、照抄進 xcstrings；如果沒、先到 `src/messages/*.json` 補齊 web 側，再鏡像到 xcstrings（依 AGENTS.md 「先加 Web messages、再補 xcstrings」原則）。

- [ ] **Step 3: xcodebuild smoke test — 兩端都 build 過**

Run: `xcodebuild -scheme Nudge-iOS -destination "platform=iOS Simulator,id=CEB11490-5C95-4528-9125-B0BB7E02DC0D" -configuration Debug build 2>&1 | tail -5`
Expected: `** BUILD SUCCEEDED **`

Run: `xcodebuild -scheme Nudge-macOS -destination "platform=macOS" -configuration Debug build 2>&1 | tail -3`
Expected: `** BUILD SUCCEEDED **`

（目前 `CardDetailView` 還是用舊簽名 `RichTextEditor(html:placeholder:)` — 新簽名多了 optional activeMarks/commandBus，下一步還兼容。所以 build 不會因為呼叫端 broken。）

- [ ] **Step 4: Commit**

```bash
git add apple/NudgeKit/Sources/NudgeUI/Components/RichTextEditor.swift apple/NudgeKit/Sources/NudgeUI/Resources/Localizable.xcstrings
git commit -m "feat(editor): replace NSAttributedString RichTextEditor with WKWebView

Drops HTMLAttributed / UIKitRichTextEditor / AppKitRichTextEditor. New
implementation wraps WKWebView loading editor.html from the NudgeUI
resource bundle; EditorCoordinator handles the JS postMessage bridge.
Public API unchanged for callers that only need html + placeholder;
adds optional activeMarks binding + EditorCommandBus for toolbars."
```

---

# Block E：EditorToolbar

### Task 14：`EditorToolbar.swift` — 7 按鈕 SwiftUI view（iOS + macOS）

**Files:**
- Create: `apple/NudgeKit/Sources/NudgeUI/Components/EditorToolbar.swift`

- [ ] **Step 1: 實作**

```swift
// apple/NudgeKit/Sources/NudgeUI/Components/EditorToolbar.swift
import SwiftUI

/// 鍵盤上方（iOS）或 detail view 頂部（macOS）的格式工具列。
/// 由 RichTextEditor 提供 activeMarks + commandBus 讓 toolbar 知道當前
/// selection 狀態並送出格式命令。
public struct EditorToolbar: View {
    public let activeMarks: ActiveMarks
    public let commandBus: EditorCommandBus
    public let onDismissKeyboard: (() -> Void)?

    public init(
        activeMarks: ActiveMarks,
        commandBus: EditorCommandBus,
        onDismissKeyboard: (() -> Void)? = nil
    ) {
        self.activeMarks = activeMarks
        self.commandBus = commandBus
        self.onDismissKeyboard = onDismissKeyboard
    }

    public var body: some View {
        HStack(spacing: 0) {
            toolbarButton(
                systemName: "arrow.uturn.backward",
                labelKey: "editor.toolbarUndo",
                isEnabled: activeMarks.canUndo
            ) { commandBus.send(.undo) }

            toolbarButton(
                systemName: "arrow.uturn.forward",
                labelKey: "editor.toolbarRedo",
                isEnabled: activeMarks.canRedo
            ) { commandBus.send(.redo) }

            divider

            headingButton

            toolbarButton(
                systemName: "list.bullet",
                labelKey: "editor.toolbarBullet",
                isActive: activeMarks.bulletList
            ) { commandBus.send(.toggleBulletList) }

            toolbarButton(
                systemName: "list.number",
                labelKey: "editor.toolbarOrdered",
                isActive: activeMarks.orderedList
            ) { commandBus.send(.toggleOrderedList) }

            toolbarButton(
                systemName: "checkmark.square",
                labelKey: "editor.toolbarTaskList",
                isActive: activeMarks.taskList
            ) { commandBus.send(.toggleTaskList) }

            Spacer()

            if let onDismissKeyboard {
                toolbarButton(
                    systemName: "keyboard.chevron.compact.down",
                    labelKey: "editor.toolbarDismiss"
                ) { onDismissKeyboard() }
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .background(Color.nudgeBackground)
        .overlay(alignment: .top) {
            Divider().background(Color.nudgeBorderLight)
        }
    }

    @ViewBuilder
    private var headingButton: some View {
        let (symbol, isActive): (String, Bool) = {
            switch activeMarks.heading {
            case 1: return ("textformat.size", true)
            case 2: return ("textformat.size", true)
            case 3: return ("textformat.size", true)
            default: return ("textformat.size", false)
            }
        }()
        Button {
            let nextLevel: Int
            switch activeMarks.heading {
            case nil: nextLevel = 1
            case 1: nextLevel = 2
            case 2: nextLevel = 3
            default: nextLevel = 0  // 3 → body (level 0 interpreted as "remove heading" via re-toggle)
            }
            if nextLevel == 0 {
                // toggle current heading off
                commandBus.send(.toggleHeading(level: activeMarks.heading ?? 3))
            } else {
                commandBus.send(.toggleHeading(level: nextLevel))
            }
        } label: {
            ZStack {
                Image(systemName: symbol)
                    .font(.body)
                    .foregroundStyle(isActive ? Color.nudgePrimary : Color.nudgeTextDim)
                if let level = activeMarks.heading {
                    Text("\(level)")
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(Color.nudgePrimary)
                        .offset(x: 10, y: 8)
                }
            }
            .frame(width: 44, height: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(Text("editor.toolbarHeading", bundle: .module))
    }

    @ViewBuilder
    private func toolbarButton(
        systemName: String,
        labelKey: LocalizedStringKey,
        isEnabled: Bool = true,
        isActive: Bool = false,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.body)
                .foregroundStyle(
                    isActive ? Color.nudgePrimary : Color.nudgeTextDim
                )
                .opacity(isEnabled ? 1 : 0.4)
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(!isEnabled)
        .accessibilityLabel(Text(labelKey, bundle: .module))
    }

    private var divider: some View {
        Rectangle()
            .fill(Color.nudgeBorderLight)
            .frame(width: 1, height: 20)
            .padding(.horizontal, 4)
    }
}
```

- [ ] **Step 2: Build 確認**

Run: `xcodebuild -scheme Nudge-iOS -destination "platform=iOS Simulator,id=CEB11490-5C95-4528-9125-B0BB7E02DC0D" -configuration Debug build 2>&1 | tail -5`
Expected: `** BUILD SUCCEEDED **`

Run: `xcodebuild -scheme Nudge-macOS -destination "platform=macOS" -configuration Debug build 2>&1 | tail -3`
Expected: `** BUILD SUCCEEDED **`

- [ ] **Step 3: Commit**

```bash
git add apple/NudgeKit/Sources/NudgeUI/Components/EditorToolbar.swift
git commit -m "feat(editor): EditorToolbar with 7 format buttons

Undo / Redo / Heading cycle (body → H1 → H2 → H3 → body) / Bullet /
Ordered / Task list / Dismiss keyboard. Buttons are 44×44 hit targets
with SF Symbols, active-state highlighting via activeMarks, disabled
state for undo / redo when canUndo / canRedo is false."
```

---

### Task 15：Wire `EditorToolbar` into `CardDetailView`

**Files:**
- Modify: `apple/NudgeKit/Sources/NudgeUI/Cards/CardDetailView.swift`

讓 CardDetailView 同時 own `activeMarks` 和 `commandBus`；iOS 用 `safeAreaInset(edge: .bottom)` 疊 toolbar；macOS 把 toolbar 放在 title bar 下方水平 bar。

**注意**：這個 task 的修改橫跨多處、牽涉 body 結構重組。實作時**先 `Read apple/NudgeKit/Sources/NudgeUI/Cards/CardDetailView.swift` 一次**，把目前的 state 變數位置、body 結構記下來，再用 Edit tool 的 old_string / new_string 對著實際文字做三次 replace。下面的 step 分開列清楚。

- [ ] **Step 1: 加 3 個 state 變數**

用 Edit，old_string 為當前檔案裡單行 `    @State private var showTagPicker = false`，new_string 為：

```
    @State private var showTagPicker = false
    @State private var activeMarks = ActiveMarks()
    @State private var editorKeyboardVisible = false
    private let commandBus = EditorCommandBus()
```

- [ ] **Step 2: 抽出 scrollContent computed var，body 改成 VStack 包一層**

用 Edit，old_string 為（對著實際檔案內容複製，以下是目前版本；實作時如有 whitespace 差異以檔案為準）：

```
    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                tagRow

                Divider()
                    .background(Color.nudgeBorderLight)

                RichTextEditor(
                    html: $descriptionHTML,
                    placeholder: NSLocalizedString(
                        "cardDetail.editorPlaceholder",
                        bundle: .module,
                        comment: ""
                    )
                )
                .frame(maxWidth: .infinity, alignment: .leading)
                .onChange(of: descriptionHTML) { _, newValue in
                    debouncedSaveDescription(newValue)
                }
            }
            .padding(16)
        }
```

new_string：

```
    public var body: some View {
        VStack(spacing: 0) {
            #if os(macOS)
            EditorToolbar(
                activeMarks: activeMarks,
                commandBus: commandBus,
                onDismissKeyboard: nil
            )
            #endif
            scrollContent
        }
```

- [ ] **Step 3: 在 struct body 外側（`}` 之後、但仍在 struct 內）加 `scrollContent` computed var**

用 Edit，old_string 為 struct 結尾前最後一個 computed var / method 的尾端 `}`（從 Read 結果找出唯一可辨識的片段，例如 `applyTagChanges` 尾端）；new_string 附加：

```swift
    @ViewBuilder
    private var scrollContent: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                tagRow

                Divider()
                    .background(Color.nudgeBorderLight)

                RichTextEditor(
                    html: $descriptionHTML,
                    placeholder: NSLocalizedString(
                        "cardDetail.editorPlaceholder",
                        bundle: .module,
                        comment: ""
                    ),
                    activeMarks: $activeMarks,
                    commandBus: commandBus
                )
                .frame(maxWidth: .infinity, alignment: .leading)
                .onChange(of: descriptionHTML) { _, newValue in
                    debouncedSaveDescription(newValue)
                }
            }
            .padding(16)
        }
    }
```

- [ ] **Step 4: 加 iOS keyboard observer + safeAreaInset toolbar**

找到 body 尾端結束處（`}` 前最後一個 modifier），用 Edit 在 `.sheet(isPresented: $showTagPicker) { ... }` 之後、body 結束的 `}` 之前插入：

```swift
        #if os(iOS)
        .safeAreaInset(edge: .bottom, spacing: 0) {
            if editorKeyboardVisible {
                EditorToolbar(
                    activeMarks: activeMarks,
                    commandBus: commandBus,
                    onDismissKeyboard: { commandBus.send(.blur) }
                )
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillShowNotification)) { _ in
            editorKeyboardVisible = true
        }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillHideNotification)) { _ in
            editorKeyboardVisible = false
        }
        #endif
```

實作技巧：找一個唯一辨識的 anchor，比如 `.sheet(isPresented: $showTagPicker) {` 到該 sheet 的 `}` — 整塊當 old_string，new_string 為「原 sheet block + 上述插入」。

- [ ] **Step 5: 跑 iOS / macOS build**

Run: `xcodebuild -scheme Nudge-iOS -destination "platform=iOS Simulator,id=CEB11490-5C95-4528-9125-B0BB7E02DC0D" -configuration Debug build 2>&1 | tail -5`
Expected: `** BUILD SUCCEEDED **`

Run: `xcodebuild -scheme Nudge-macOS -destination "platform=macOS" -configuration Debug build 2>&1 | tail -3`
Expected: `** BUILD SUCCEEDED **`

- [ ] **Step 6: Install + launch on simulator**

```bash
cd /Users/mike/Documents/nudge
apple/NudgeEditor/build.sh  # 確保 bundle 最新
xcodebuild -scheme Nudge-iOS -destination "platform=iOS Simulator,id=CEB11490-5C95-4528-9125-B0BB7E02DC0D" -configuration Debug build
xcrun simctl install booted ~/Library/Developer/Xcode/DerivedData/Nudge-*/Build/Products/Debug-iphonesimulator/Nudge-iOS.app
xcrun simctl terminate booted tw.nudge.app || true
xcrun simctl launch booted tw.nudge.app
```

Expected: app 啟動；開一張卡片；看到編輯區 + 鍵盤上方 toolbar。

- [ ] **Step 7: 手動驗證**

1. 開卡片 → 點擊文字區 → 鍵盤升起 → toolbar 顯示在鍵盤上方
2. 按 H 按鈕 → 當段變 H1；再按 → H2；再 → H3；再 → body
3. 按 bullet → 當段變項目符號
4. 按 checkbox → 當段變 task list，前方有空 checkbox
5. 選字 → iOS 系統選字選單（B / I / U）出現 → 可套用
6. 按「收鍵盤」按鈕 → 鍵盤收起、toolbar 消失
7. 切深色模式 → 編輯器背景、文字、checkbox 色立即更新

如果有失敗，debug：
- `xcrun simctl launch --console-pty booted tw.nudge.app 2>&1 | head -20` 看 print
- Safari → Develop → Simulator → 選 WKWebView → Web Inspector debug

- [ ] **Step 8: Commit（手動驗證通過後）**

```bash
git add apple/NudgeKit/Sources/NudgeUI/Cards/CardDetailView.swift
git commit -m "feat(cards): wire EditorToolbar into CardDetailView

iOS: safeAreaInset toolbar appears only while keyboard is visible
(tracked via UIResponder keyboard notifications). macOS: toolbar pinned
above the scroll view as a persistent horizontal bar. activeMarks and
EditorCommandBus flow between RichTextEditor and toolbar without parent
view restructure."
```

---

# Block F：CI + DoD

### Task 16：CI smoke test — editor bundle 建得起來

**Files:**
- Check: `.github/workflows/` 目錄是否存在 workflows
- Create or Modify: `.github/workflows/editor-bundle.yml`

- [ ] **Step 1: 檢查現有 CI 結構**

Run: `ls .github/workflows/ 2>/dev/null`

如果不存在目錄：create 一個 workflow。如果有現有 workflow 加一個 job 更整齊。

- [ ] **Step 2: 寫 `.github/workflows/editor-bundle.yml`**

```yaml
name: Editor Bundle Build

on:
  push:
    paths:
      - "apple/NudgeEditor/**"
      - "src/components/editor/**"
      - ".github/workflows/editor-bundle.yml"
  pull_request:
    paths:
      - "apple/NudgeEditor/**"
      - "src/components/editor/**"

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
          cache-dependency-path: "apple/NudgeEditor/package-lock.json"
      - name: Install editor bundle deps
        working-directory: apple/NudgeEditor
        run: npm ci
      - name: Build bundle
        working-directory: apple/NudgeEditor
        run: npm run build
      - name: Run bundle tests
        working-directory: apple/NudgeEditor
        run: npm test
      - name: Verify outputs
        run: |
          test -f apple/NudgeEditor/dist/index.html
          test -f apple/NudgeEditor/dist/editor.js
          test -f apple/NudgeEditor/dist/editor.css
```

- [ ] **Step 3: （本地模擬）跑一次 build + test**

Run: `cd apple/NudgeEditor && npm ci && npm run build && npm test 2>&1 | tail -10`
Expected: build + test 全通過。

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/editor-bundle.yml
git commit -m "ci(editor): smoke test the editor bundle build

Runs npm ci → vite build → vitest on push / PR that touches the
Vite sub-project or the shared editor source. Verifies the expected
output files exist."
```

---

### Task 17：全流程 Manual DoD

**Files:**
- (no file changes; 純手測)

把 spec 的 16 項 DoD 清單跑完。每一項失敗就停下來修，修完再往下。

- [ ] **Step 1: 先確保 bundle 最新 + app 已裝在 sim**

```bash
cd /Users/mike/Documents/nudge
apple/NudgeEditor/build.sh
xcodebuild -scheme Nudge-iOS -destination "platform=iOS Simulator,id=CEB11490-5C95-4528-9125-B0BB7E02DC0D" -configuration Debug build 2>&1 | tail -3
xcrun simctl install booted ~/Library/Developer/Xcode/DerivedData/Nudge-*/Build/Products/Debug-iphonesimulator/Nudge-iOS.app
xcrun simctl terminate booted tw.nudge.app || true
xcrun simctl launch booted tw.nudge.app
```

- [ ] **Step 2: DoD checklist（照 spec §測試策略）**

逐項在 sim 手動驗：

1. 開舊卡片（存有 verbose NSAttributedString HTML）→ 內文正確渲染、粗體保留
2. Toolbar H 按鈕 → body → H1 → H2 → H3 → body 循環
3. Toolbar 項目符號 / 數字清單 / checkbox → block 切換正確
4. 輸入 `/` → slash menu 出現；選 checkbox → 變 checkbox
5. checkbox 輸入 Enter → 新 checkbox（不 nested）
6. 空 checkbox 按 Enter → 退回 paragraph
7. 選字長按 → 系統 B I U 選單；套用成功
8. 切深色模式 → 編輯器即時更新
9. 存 HTML 後從 web 打開 → 結構一致（打開 `curl -s --cookie 'session=<dev session>' https://nudge.tw/api/tasks/<id> | jq .description` 和 web 送出的比對）
10. 飛航模式 → 編輯可用（PATCH queue 等網）
11. Rotate 旋轉 → layout 不壞
12. 10 頁長內容 → 捲動流暢
13. 鍵盤彈 / 收 → cursor 永遠在可見區
14. macOS：`Cmd+B` / `Cmd+Alt+1` 等 shortcut 有效
15. Undo / Redo → state 正確
16. Undo disabled 狀態視覺正確

- [ ] **Step 3: 記錄發現的 bug**

若有問題記在 `docs/flutter-bugs.md` 附近開新檔 `docs/editor-bugs.md`；逐項修（可能需要回到對應 Task 補）。

- [ ] **Step 4: 全通過後，最終 commit**

```bash
git commit --allow-empty -m "chore(editor): DoD manual verification pass

iOS + macOS manual DoD checklist all 16 items verified. Editor
replacement ready for TestFlight bump + release."
```

- [ ] **Step 5:（可選）bump build number**

若要 push TestFlight：

Modify `apple/project.yml` 的 `CURRENT_PROJECT_VERSION: "102"` → `"103"`（或更高）。然後 `cd apple && xcodegen`。

---

## 整體 DoD

- 所有 17 個 task 的 checkbox 都 tick
- `git log` 沒留下 `node_modules/` / `dist/`
- `apple/NudgeEditor/build.sh` 從 clean clone 跑過一次能成功
- iOS + macOS 都 launch 到可編輯、可存檔、可從 web 讀回
- CI workflow green（GitHub Actions 跑過一次通過）

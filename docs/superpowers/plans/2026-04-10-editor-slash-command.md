# 編輯器 Slash Command 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 TipTap 編輯器加入 Notion 風格的 slash command，支援 9 個區塊類型插入與 code block 語法高亮、語言切換。兩個既有編輯器共用一組 extension。

**Architecture:** 新增 `src/components/editor/` 目錄存放共用的編輯器擴充邏輯：slash command extension、selection menu React 元件、lowlight 實例、共用 extension 陣列。兩個既有編輯器改為引用共用 extension 陣列。Code block 用 `CodeBlockLowlight` + 自製 React NodeView 提供語言切換下拉。

**Tech Stack:** TipTap v3、@tiptap/suggestion、@tiptap/extension-code-block-lowlight、@tiptap/extension-task-list、lowlight、highlight.js、tippy.js、lucide-react

---

## 檔案結構

| 操作 | 檔案 | 職責 |
|------|------|------|
| 新增 | `src/components/editor/lowlight-instance.ts` | 建立 lowlight instance 並註冊 10 種語言 |
| 新增 | `src/components/editor/slash-command-items.tsx` | 9 個 slash 選單項目定義 |
| 新增 | `src/components/editor/slash-command-menu.tsx` | React 浮動選單元件 |
| 新增 | `src/components/editor/slash-command-extension.ts` | TipTap suggestion extension |
| 新增 | `src/components/editor/code-block-node-view.tsx` | Code block 的 React NodeView（語言下拉） |
| 新增 | `src/components/editor/editor-extensions.ts` | 共用 extension 陣列 factory |
| 修改 | `src/components/task/tiptap-editor.tsx` | 改用共用 extension 陣列 |
| 修改 | `src/components/notes/notes-canvas-editor.tsx` | 改用共用 extension 陣列 |
| 修改 | `src/app/globals.css` | 新增 task list、code block、hljs 配色樣式 |

---

### Task 1: 安裝依賴

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: 安裝必要套件**

```bash
cd /Users/mike/Documents/nudge
npm install @tiptap/extension-code-block-lowlight@^3 @tiptap/extension-task-list@^3 @tiptap/extension-task-item@^3 @tiptap/suggestion@^3 lowlight@^3 highlight.js@^11 tippy.js@^6
```

- [ ] **Step 2: 確認安裝結果**

```bash
ls node_modules/@tiptap/ | grep -E "suggestion|code-block-lowlight|task-"
ls node_modules/lowlight node_modules/highlight.js node_modules/tippy.js 2>&1 | head -5
```

預期：看到 `extension-code-block-lowlight`、`extension-task-list`、`extension-task-item`、`suggestion` 四個目錄，以及 `lowlight`、`highlight.js`、`tippy.js` 三個套件存在。

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: 安裝 slash command 相關依賴"
```

---

### Task 2: lowlight 實例與語言註冊

**Files:**
- Create: `src/components/editor/lowlight-instance.ts`

- [ ] **Step 1: 建立 lowlight-instance.ts**

```ts
import { createLowlight } from "lowlight";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import xml from "highlight.js/lib/languages/xml";
import css from "highlight.js/lib/languages/css";
import json from "highlight.js/lib/languages/json";
import bash from "highlight.js/lib/languages/bash";
import sql from "highlight.js/lib/languages/sql";
import markdown from "highlight.js/lib/languages/markdown";

export const lowlight = createLowlight();

lowlight.register("javascript", javascript);
lowlight.register("typescript", typescript);
lowlight.register("python", python);
lowlight.register("xml", xml);
lowlight.register("css", css);
lowlight.register("json", json);
lowlight.register("bash", bash);
lowlight.register("sql", sql);
lowlight.register("markdown", markdown);

/** 對使用者顯示的語言選項（value 對應 lowlight register 的名稱） */
export const CODE_BLOCK_LANGUAGES: Array<{ value: string; label: string }> = [
  { value: "plaintext", label: "Plain text" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "python", label: "Python" },
  { value: "xml", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "json", label: "JSON" },
  { value: "bash", label: "Bash" },
  { value: "sql", label: "SQL" },
  { value: "markdown", label: "Markdown" },
];
```

- [ ] **Step 2: Commit**

```bash
git add src/components/editor/lowlight-instance.ts
git commit -m "feat: lowlight instance 註冊 10 種程式語言"
```

---

### Task 3: Slash 選單項目定義

**Files:**
- Create: `src/components/editor/slash-command-items.tsx`

- [ ] **Step 1: 建立 slash-command-items.tsx**

```tsx
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  Code,
  Minus,
  type LucideIcon,
} from "lucide-react";
import type { Editor, Range } from "@tiptap/core";

export interface SlashCommandItem {
  label: string;
  description: string;
  icon: LucideIcon;
  keywords: string[];
  command: (args: { editor: Editor; range: Range }) => void;
}

export const slashCommandItems: SlashCommandItem[] = [
  {
    label: "Heading 1",
    description: "大標題",
    icon: Heading1,
    keywords: ["h1", "head", "heading", "標題", "title"],
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode("heading", { level: 1 })
        .run();
    },
  },
  {
    label: "Heading 2",
    description: "中標題",
    icon: Heading2,
    keywords: ["h2", "head", "heading", "標題"],
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode("heading", { level: 2 })
        .run();
    },
  },
  {
    label: "Heading 3",
    description: "小標題",
    icon: Heading3,
    keywords: ["h3", "head", "heading", "標題"],
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode("heading", { level: 3 })
        .run();
    },
  },
  {
    label: "項目符號列表",
    description: "Bullet list",
    icon: List,
    keywords: ["list", "bullet", "ul", "項目"],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    label: "數字列表",
    description: "Numbered list",
    icon: ListOrdered,
    keywords: ["ol", "number", "ordered", "數字"],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    label: "待辦列表",
    description: "Checkbox task list",
    icon: ListTodo,
    keywords: ["todo", "task", "check", "待辦"],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run();
    },
  },
  {
    label: "引言",
    description: "Blockquote",
    icon: Quote,
    keywords: ["quote", "blockquote", "引用", "引言"],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run();
    },
  },
  {
    label: "程式碼區塊",
    description: "Code block",
    icon: Code,
    keywords: ["code", "block", "程式"],
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .toggleCodeBlock()
        .run();
    },
  },
  {
    label: "分隔線",
    description: "Horizontal rule",
    icon: Minus,
    keywords: ["hr", "divider", "separator", "分隔"],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },
];

/** 根據 query 字串 filter 項目 */
export function filterSlashItems(query: string): SlashCommandItem[] {
  if (!query) return slashCommandItems;
  const q = query.toLowerCase();
  return slashCommandItems.filter(
    (item) =>
      item.label.toLowerCase().includes(q) ||
      item.keywords.some((k) => k.toLowerCase().includes(q))
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/editor/slash-command-items.tsx
git commit -m "feat: 9 個 slash command 選單項目定義"
```

---

### Task 4: Slash 選單 React 元件

**Files:**
- Create: `src/components/editor/slash-command-menu.tsx`

- [ ] **Step 1: 建立 slash-command-menu.tsx**

```tsx
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
  useCallback,
} from "react";
import type { Editor, Range } from "@tiptap/core";
import type { SlashCommandItem } from "./slash-command-items";

interface SlashCommandMenuProps {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
  editor: Editor;
  range: Range;
}

export interface SlashCommandMenuRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export const SlashCommandMenu = forwardRef<
  SlashCommandMenuRef,
  SlashCommandMenuProps
>(function SlashCommandMenu({ items, command }, ref) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // 當 items 變動時重置 selection
  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  const selectItem = useCallback(
    (index: number) => {
      const item = items[index];
      if (item) command(item);
    },
    [items, command]
  );

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((i) => (i - 1 + items.length) % items.length);
        return true;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((i) => (i + 1) % items.length);
        return true;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        selectItem(selectedIndex);
        return true;
      }
      return false;
    },
  }));

  if (items.length === 0) {
    return (
      <div className="w-72 rounded-lg bg-popover text-popover-foreground border border-border shadow-lg p-3 text-sm text-text-dim">
        沒有符合的項目
      </div>
    );
  }

  return (
    <div
      role="menu"
      className="w-72 rounded-lg bg-popover text-popover-foreground border border-border shadow-lg p-1.5 flex flex-col gap-0.5"
    >
      {items.map((item, index) => {
        const Icon = item.icon;
        const isSelected = index === selectedIndex;
        return (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            onClick={() => selectItem(index)}
            onMouseEnter={() => setSelectedIndex(index)}
            className={`flex items-center gap-3 px-3 py-2 rounded text-left transition-colors ${
              isSelected
                ? "bg-muted text-foreground"
                : "text-foreground/90 hover:bg-muted/60"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0 text-text-dim" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{item.label}</div>
              <div className="text-xs text-text-dim truncate">
                {item.description}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/editor/slash-command-menu.tsx
git commit -m "feat: SlashCommandMenu React 元件"
```

---

### Task 5: Slash Command TipTap extension

**Files:**
- Create: `src/components/editor/slash-command-extension.ts`

- [ ] **Step 1: 建立 slash-command-extension.ts**

```ts
import { Extension } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";
import Suggestion from "@tiptap/suggestion";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import {
  SlashCommandMenu,
  type SlashCommandMenuRef,
} from "./slash-command-menu";
import {
  filterSlashItems,
  type SlashCommandItem,
} from "./slash-command-items";

export const slashCommandExtension = Extension.create({
  name: "slashCommand",

  addOptions() {
    return {
      suggestion: {
        char: "/",
        command: ({
          editor,
          range,
          props,
        }: {
          editor: any;
          range: any;
          props: { item: SlashCommandItem };
        }) => {
          props.item.command({ editor, range });
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
        items: ({ query }: { query: string }) => filterSlashItems(query),
        render: () => {
          let component: ReactRenderer<SlashCommandMenuRef> | null = null;
          let popup: TippyInstance[] = [];

          return {
            onStart: (props: any) => {
              component = new ReactRenderer(SlashCommandMenu, {
                props: {
                  items: props.items,
                  command: (item: SlashCommandItem) => {
                    props.command({ item });
                  },
                  editor: props.editor,
                  range: props.range,
                },
                editor: props.editor,
              });

              if (!props.clientRect) return;

              popup = tippy("body", {
                getReferenceClientRect: props.clientRect,
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: "manual",
                placement: "bottom-start",
                offset: [0, 8],
              });
            },
            onUpdate: (props: any) => {
              component?.updateProps({
                items: props.items,
                command: (item: SlashCommandItem) => {
                  props.command({ item });
                },
                editor: props.editor,
                range: props.range,
              });
              if (popup[0]) {
                popup[0].setProps({
                  getReferenceClientRect: props.clientRect,
                });
              }
            },
            onKeyDown: (props: any) => {
              if (props.event.key === "Escape") {
                popup[0]?.hide();
                return true;
              }
              return component?.ref?.onKeyDown({ event: props.event }) ?? false;
            },
            onExit: () => {
              popup[0]?.destroy();
              component?.destroy();
              popup = [];
              component = null;
            },
          };
        },
      }),
    ];
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/editor/slash-command-extension.ts
git commit -m "feat: slash command TipTap extension"
```

---

### Task 6: Code Block React NodeView（語言下拉）

**Files:**
- Create: `src/components/editor/code-block-node-view.tsx`

- [ ] **Step 1: 建立 code-block-node-view.tsx**

```tsx
import {
  NodeViewContent,
  NodeViewWrapper,
  type NodeViewProps,
} from "@tiptap/react";
import { CODE_BLOCK_LANGUAGES } from "./lowlight-instance";

export function CodeBlockNodeView({
  node,
  updateAttributes,
  extension,
}: NodeViewProps) {
  const currentLang = (node.attrs.language as string) || "plaintext";

  return (
    <NodeViewWrapper className="relative my-3">
      <select
        contentEditable={false}
        value={currentLang}
        onChange={(e) => updateAttributes({ language: e.target.value })}
        className="absolute top-2 right-2 text-[11px] bg-transparent text-text-dim border border-border rounded px-1.5 py-0.5 cursor-pointer hover:text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        aria-label="切換語言"
      >
        {CODE_BLOCK_LANGUAGES.map((lang) => (
          <option key={lang.value} value={lang.value}>
            {lang.label}
          </option>
        ))}
      </select>
      <pre className="!pr-24">
        <NodeViewContent as="code" />
      </pre>
    </NodeViewWrapper>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/editor/code-block-node-view.tsx
git commit -m "feat: code block React NodeView 含語言下拉"
```

---

### Task 7: 共用 editor-extensions 陣列

**Files:**
- Create: `src/components/editor/editor-extensions.ts`

- [ ] **Step 1: 建立 editor-extensions.ts**

```ts
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { lowlight } from "./lowlight-instance";
import { slashCommandExtension } from "./slash-command-extension";
import { CodeBlockNodeView } from "./code-block-node-view";

interface CreateEditorExtensionsOptions {
  placeholder: string;
}

export function createEditorExtensions({
  placeholder,
}: CreateEditorExtensionsOptions) {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      // 停用內建 codeBlock — 讓 CodeBlockLowlight 接手
      codeBlock: false,
    }),
    Placeholder.configure({ placeholder }),
    TaskList,
    TaskItem.configure({ nested: true }),
    CodeBlockLowlight.extend({
      addNodeView() {
        return ReactNodeViewRenderer(CodeBlockNodeView);
      },
    }).configure({
      lowlight,
      defaultLanguage: "plaintext",
    }),
    slashCommandExtension,
  ];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/editor/editor-extensions.ts
git commit -m "feat: 編輯器共用 extension 陣列 factory"
```

---

### Task 8: CSS 樣式（task list、code block、hljs）

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: 在 globals.css 末端新增 slash command 相關樣式**

```css
/* =========================================================
   Slash command 相關：task list、code block、hljs 配色
   ========================================================= */

/* Task list (checkbox) */
.tiptap-container .tiptap ul[data-type="taskList"] {
  list-style: none;
  padding-left: 0;
}
.tiptap-container .tiptap ul[data-type="taskList"] li {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  margin: 0.25rem 0;
}
.tiptap-container .tiptap ul[data-type="taskList"] li > label {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  margin-top: 0.2rem;
}
.tiptap-container .tiptap ul[data-type="taskList"] input[type="checkbox"] {
  accent-color: var(--primary);
  cursor: pointer;
  width: 0.95rem;
  height: 0.95rem;
}
.tiptap-container .tiptap ul[data-type="taskList"] li[data-checked="true"] > div {
  color: var(--text-dim);
  text-decoration: line-through;
}

/* Code block */
.tiptap-container .tiptap pre {
  background: var(--muted);
  color: var(--foreground);
  padding: 0.875rem 1rem;
  border-radius: 0.5rem;
  font-family: var(--font-mono), ui-monospace, monospace;
  font-size: 0.875rem;
  line-height: 1.6;
  overflow-x: auto;
  position: relative;
  margin: 0.5rem 0;
}
.tiptap-container .tiptap pre code {
  background: none;
  color: inherit;
  padding: 0;
  font-size: inherit;
}

/* Hljs 極簡配色 — 只染幾個類別，與 ink & paper 主題相容 */
.tiptap-container .tiptap pre code .hljs-keyword,
.tiptap-container .tiptap pre code .hljs-selector-tag,
.tiptap-container .tiptap pre code .hljs-built_in {
  color: var(--primary);
  font-weight: 600;
}
.tiptap-container .tiptap pre code .hljs-string,
.tiptap-container .tiptap pre code .hljs-attr {
  color: var(--chart-3);
}
.tiptap-container .tiptap pre code .hljs-comment,
.tiptap-container .tiptap pre code .hljs-meta {
  color: var(--text-dim);
  font-style: italic;
}
.tiptap-container .tiptap pre code .hljs-number,
.tiptap-container .tiptap pre code .hljs-literal {
  color: var(--chart-2);
}
.tiptap-container .tiptap pre code .hljs-function,
.tiptap-container .tiptap pre code .hljs-title {
  color: var(--chart-1);
}
.tiptap-container .tiptap pre code .hljs-tag,
.tiptap-container .tiptap pre code .hljs-name {
  color: var(--chart-4);
}

/* Tippy.js 樣式 reset — 用預設 popper 即可，不加額外陰影 */
.tippy-box[data-theme~="transparent"] {
  background: transparent;
  box-shadow: none;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: task list / code block / hljs 樣式"
```

---

### Task 9: 整合到 tiptap-editor.tsx

**Files:**
- Modify: `src/components/task/tiptap-editor.tsx`

- [ ] **Step 1: 整份替換 tiptap-editor.tsx**

```tsx
"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import { useEffect, forwardRef, useImperativeHandle } from "react";
import { createEditorExtensions } from "@/components/editor/editor-extensions";

interface TiptapEditorProps {
  content: string;
  onChange: (html: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  editable?: boolean;
}

export const TiptapEditor = forwardRef<
  { focus: () => void },
  TiptapEditorProps
>(function TiptapEditor(
  {
    content,
    onChange,
    onBlur,
    placeholder = "",
    autoFocus = false,
    editable = true,
  },
  ref
) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: createEditorExtensions({ placeholder }),
    content,
    editable,
    autofocus: autoFocus ? "end" : false,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    onBlur: () => {
      onBlur?.();
    },
    editorProps: {
      attributes: {
        class: "outline-none min-h-[24px]",
      },
    },
  });

  useImperativeHandle(ref, () => ({
    focus: () => editor?.commands.focus("end"),
  }));

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  useEffect(() => {
    if (editor) {
      editor.setEditable(editable);
    }
  }, [editor, editable]);

  return (
    <div className="tiptap-container h-full">
      <EditorContent editor={editor} className="h-full" />
    </div>
  );
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/task/tiptap-editor.tsx
git commit -m "feat: tiptap-editor 改用共用 extensions（含 slash command）"
```

---

### Task 10: 整合到 notes-canvas-editor.tsx

**Files:**
- Modify: `src/components/notes/notes-canvas-editor.tsx`

- [ ] **Step 1: 改 notes-canvas-editor.tsx 的 extensions**

找到：
```tsx
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder: "寫點什麼⋯⋯" }),
    ],
```

替換為：
```tsx
    extensions: createEditorExtensions({ placeholder: "寫點什麼⋯⋯" }),
```

然後移除不再需要的 imports，找到：
```tsx
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
```

改為：
```tsx
import { createEditorExtensions } from "@/components/editor/editor-extensions";
```

- [ ] **Step 2: Build 驗證**

```bash
npx next build 2>&1 | tail -10
```
預期：build 成功。

- [ ] **Step 3: Commit**

```bash
git add src/components/notes/notes-canvas-editor.tsx
git commit -m "feat: notes-canvas-editor 改用共用 extensions（含 slash command）"
```

---

### Task 11: 驗證

- [ ] **Step 1: 啟動 dev server**

```bash
npm run dev
```

- [ ] **Step 2: 測試 Slash command 基本行為（task modal）**

1. 瀏覽 `/` → 隨便一天 → 打開任一個任務的 detail modal（點文件 icon）
2. 在編輯區輸入 `/`
3. 確認 popup 出現，顯示 9 個項目
4. 繼續輸入 `head` → 只剩 3 個 Heading 項目
5. Esc → popup 消失
6. 重新 `/` → 方向鍵選中 Heading 1 → Enter → 當前段落轉成 h1
7. 測試所有 9 個項目都能正確插入

- [ ] **Step 3: 測試 Slash command 在 notes canvas**

1. 到 `/notes`
2. 輸入 `/` → popup 出現
3. 選 `待辦列表` → 出現 checkbox + 可打字
4. 勾選 checkbox → 文字加刪除線
5. 再輸入 `/` → 選 `程式碼區塊` → code block 出現

- [ ] **Step 4: 測試 Code block 語言切換**

1. 插入 code block
2. 右上角看到語言下拉，預設 `Plain text`
3. 輸入一些 JavaScript 程式碼
4. 下拉切到 `JavaScript` → 語法高亮出現
5. 切到 `Python` → 高亮改變

- [ ] **Step 5: 測試儲存與還原**

1. 在卡片編輯 heading + list + code block
2. 關閉 modal / 刷新頁面
3. 重新打開 → 內容完整還原（包含 code block 語言）

- [ ] **Step 6: 測試 notes canvas 的區塊拖放**

1. 在 canvas 插入幾個段落和 heading
2. Hover 顯示 grip handle
3. 拖動重排 → 順序正確，內容保留
4. 與 slash command 無衝突

- [ ] **Step 7: 最終 commit（若有微調）**

```bash
git add -A
git commit -m "fix: slash command 微調"
```

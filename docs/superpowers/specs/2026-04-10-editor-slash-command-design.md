# 編輯器 Slash Command 設計

## 摘要

在 TipTap 編輯器加入 Notion 風格的 slash command：輸入 `/` 彈出選單，可快速插入 heading、list、task list、code block 等區塊。兩個既有編輯器（`tiptap-editor.tsx` 任務/卡片用、`notes-canvas-editor.tsx` 日記 canvas 用）共用一組 extension，保持體驗一致。同時加入 code block 語法高亮與語言切換下拉。

## 核心決策

| 項目 | 決定 |
|------|------|
| 適用範圍 | 兩個編輯器（task / card / notes canvas） |
| 實作方式 | 獨立 TipTap extension，兩邊共用 |
| 觸發 | 任何位置輸入 `/`（Notion 式） |
| 過濾 | 繼續輸入會 filter（`/head` → 只顯示 Heading） |
| 鍵盤操作 | 方向鍵選 / Enter 插入 / Esc 取消 |
| 選單項目數 | 9 項（預設高度足以全部顯示，無需捲動） |
| Code block 語言 | 10 種預設語言 + 右上角下拉切換 |
| Popup 定位 | `tippy.js`（TipTap suggestion 官方推薦） |

## Slash 選單項目

| Label | Icon (lucide) | 快捷字 | 插入結果 |
|-------|---------------|-------|---------|
| Heading 1 | `Heading1` | `h1`, `head`, `標題` | `<h1>` |
| Heading 2 | `Heading2` | `h2`, `head` | `<h2>` |
| Heading 3 | `Heading3` | `h3`, `head` | `<h3>` |
| 項目符號列表 | `List` | `list`, `bullet`, `ul` | `<ul><li>` |
| 數字列表 | `ListOrdered` | `ol`, `number`, `num` | `<ol><li>` |
| 待辦列表 | `ListTodo` | `todo`, `task`, `check` | `<ul data-type="taskList">` |
| 引言 | `Quote` | `quote`, `blockquote` | `<blockquote>` |
| 程式碼區塊 | `Code` | `code`, `block` | `<pre><code>` 預設 plaintext |
| 分隔線 | `Minus` | `hr`, `divider`, `分隔` | `<hr>` |

## Code Block 支援語言

**預設 10 種**：
- JavaScript (`javascript`)
- TypeScript (`typescript`)
- Python (`python`)
- HTML (`xml`)
- CSS (`css`)
- JSON (`json`)
- Bash (`bash`)
- SQL (`sql`)
- Markdown (`markdown`)
- Plain text (`plaintext`)

使用 `lowlight` + `highlight.js` 提供語法高亮。

## 新增依賴

```json
{
  "@tiptap/extension-code-block-lowlight": "^3",
  "@tiptap/extension-task-list": "^3",
  "@tiptap/extension-task-item": "^3",
  "@tiptap/suggestion": "^3",
  "lowlight": "^3",
  "tippy.js": "^6"
}
```

## 檔案結構

| 操作 | 檔案 | 職責 |
|------|------|------|
| 新增 | `src/components/editor/lowlight-instance.ts` | 建立 lowlight instance + 註冊 10 個語言 |
| 新增 | `src/components/editor/slash-command-items.tsx` | 9 個選單項目的定義（icon、label、keywords、command） |
| 新增 | `src/components/editor/slash-command-menu.tsx` | React 選單元件 — 顯示、鍵盤導覽、click 選取 |
| 新增 | `src/components/editor/slash-command-extension.ts` | TipTap suggestion extension，定義觸發條件與 render 方式 |
| 新增 | `src/components/editor/editor-extensions.ts` | 共用 extension array（StarterKit + slash + code-block + task-list） |
| 修改 | `src/components/task/tiptap-editor.tsx` | 改用共用 extension array |
| 修改 | `src/components/notes/notes-canvas-editor.tsx` | 改用共用 extension array |
| 新增 | `src/app/globals.css` | TipTap 的新 node 樣式（task list、code block、hljs 主題） |

## Extension 模組設計

### `editor-extensions.ts` — 共用 extension array

```ts
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { lowlight } from "./lowlight-instance";
import { slashCommandExtension } from "./slash-command-extension";

export function createEditorExtensions({
  placeholder,
}: {
  placeholder: string;
}) {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      codeBlock: false, // 讓 CodeBlockLowlight 接手
    }),
    Placeholder.configure({ placeholder }),
    TaskList,
    TaskItem.configure({ nested: true }),
    CodeBlockLowlight.configure({
      lowlight,
      defaultLanguage: "plaintext",
    }),
    slashCommandExtension,
  ];
}
```

### `lowlight-instance.ts` — 語言註冊

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
```

### `slash-command-items.tsx` — 項目定義

每個項目是物件：
```ts
interface SlashCommandItem {
  label: string;
  icon: LucideIcon;
  keywords: string[];
  command: (editor: Editor, range: Range) => void;
}
```

`command` 用 TipTap chain API 執行插入：
```ts
// 例：H1
command: (editor, range) => {
  editor
    .chain()
    .focus()
    .deleteRange(range)
    .setNode("heading", { level: 1 })
    .run();
}
```

### `slash-command-menu.tsx` — React 選單元件

- `useState` 管理 selectedIndex
- Props: `items`（filtered）、`command`（selected 時呼叫）
- `useEffect` 重置 selectedIndex 當 items 變動
- `useImperativeHandle` 暴露 `onKeyDown` 讓 TipTap suggestion render 呼叫
- 鍵盤邏輯：`ArrowUp` / `ArrowDown` / `Enter`
- 樣式：
  - `bg-popover text-popover-foreground border border-border rounded-lg shadow-lg`
  - `w-72`（寬一點）
  - `max-h-none`（顯示全部 9 項，不捲動）
  - 每項：`flex items-center gap-3 px-3 py-2 rounded hover:bg-muted`
  - Selected: `bg-muted`

### `slash-command-extension.ts` — TipTap extension

使用 `@tiptap/suggestion` 定義觸發規則：

```ts
import { Extension } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import { ReactRenderer } from "@tiptap/react";
import tippy from "tippy.js";
import { SlashCommandMenu } from "./slash-command-menu";
import { slashCommandItems } from "./slash-command-items";

export const slashCommandExtension = Extension.create({
  name: "slashCommand",
  addOptions() {
    return {
      suggestion: {
        char: "/",
        command: ({ editor, range, props }) => {
          props.command(editor, range);
        },
        items: ({ query }) => {
          const q = query.toLowerCase();
          return slashCommandItems.filter((item) =>
            item.keywords.some((k) => k.toLowerCase().includes(q)) ||
            item.label.toLowerCase().includes(q)
          );
        },
        render: () => {
          let component: ReactRenderer;
          let popup: any;
          return {
            onStart: (props) => {
              component = new ReactRenderer(SlashCommandMenu, {
                props,
                editor: props.editor,
              });
              popup = tippy("body", {
                getReferenceClientRect: props.clientRect,
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: "manual",
                placement: "bottom-start",
              });
            },
            onUpdate: (props) => {
              component.updateProps(props);
              popup[0].setProps({ getReferenceClientRect: props.clientRect });
            },
            onKeyDown: (props) => {
              if (props.event.key === "Escape") {
                popup[0].hide();
                return true;
              }
              return (component.ref as any)?.onKeyDown(props);
            },
            onExit: () => {
              popup[0].destroy();
              component.destroy();
            },
          };
        },
      },
    };
  },
  addProseMirrorPlugins() {
    return [Suggestion({ editor: this.editor, ...this.options.suggestion })];
  },
});
```

## Code Block 語言切換 UI

用 ProseMirror 的 NodeView 或 TipTap 的 `ReactNodeViewRenderer` 包裝 CodeBlockLowlight，在右上角渲染一個小的 `<select>` 或 Popover：

**方案 A**（推薦，簡單）：用原生 `<select>` 元素
```tsx
<select
  className="absolute top-2 right-2 text-xs bg-transparent text-text-dim border-none outline-none cursor-pointer"
  value={node.attrs.language || "plaintext"}
  onChange={(e) => updateAttributes({ language: e.target.value })}
>
  <option value="plaintext">plain</option>
  <option value="javascript">JavaScript</option>
  ...
</select>
```

**方案 B**：用 shadcn `Popover` + 按鈕（視覺更一致但多一個點擊）

選 **A** — 原生 select 更直覺。

## TipTap CSS 新增

`globals.css` 需要加：

### Task list 樣式
```css
.tiptap-container .tiptap ul[data-type="taskList"] {
  list-style: none;
  padding-left: 0;
}
.tiptap-container .tiptap ul[data-type="taskList"] li {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}
.tiptap-container .tiptap ul[data-type="taskList"] li > label {
  flex-shrink: 0;
}
.tiptap-container .tiptap ul[data-type="taskList"] input[type="checkbox"] {
  accent-color: var(--primary);
  cursor: pointer;
}
```

### Code block 樣式
```css
.tiptap-container .tiptap pre {
  background: var(--muted);
  color: var(--foreground);
  padding: 1rem;
  border-radius: 0.5rem;
  font-family: var(--font-mono), ui-monospace, monospace;
  font-size: 0.875rem;
  line-height: 1.6;
  overflow-x: auto;
  position: relative;
}

.tiptap-container .tiptap pre code {
  background: none;
  color: inherit;
  padding: 0;
  font-size: inherit;
}
```

### highlight.js 主題
匯入 `highlight.js/styles/github-dark.css`（或類似沉香木色主題）到 globals.css 頂部，或自訂基礎配色以符合 ink & paper 主題。

**建議**：寫一組極簡的 `.hljs-*` class 只染幾個類型（keyword、string、comment、number、function），避免彩虹化。色彩全用 design token：
- `.hljs-keyword` → `text-primary`
- `.hljs-string` → `text-chart-3` (苔綠)
- `.hljs-comment` → `text-text-dim italic`
- `.hljs-number` → `text-chart-2`
- `.hljs-function` → `text-chart-1`

## 編輯器整合變更

### `src/components/task/tiptap-editor.tsx`

原本 `extensions` 陣列改為：
```ts
extensions: createEditorExtensions({ placeholder: placeholder || "輸入內文..." })
```

### `src/components/notes/notes-canvas-editor.tsx`

同上：
```ts
extensions: createEditorExtensions({ placeholder: "寫點什麼⋯⋯" })
```

**注意**：notes canvas 的區塊拖放邏輯保留不動，與 slash command 無衝突。

## 邊界情況

1. **Filter 無結果** → 選單顯示「沒有符合的項目」單行 placeholder
2. **在 code block 內輸入 `/`** → TipTap suggestion 預設只在 paragraph 類型生效，code block 不會觸發
3. **Popup 貼邊** → tippy.js 自動翻轉
4. **多編輯器 race** → 每個 editor instance 有獨立的 suggestion 狀態，互不影響
5. **快速連按 `/`** → 第一次觸發後的 `/` 變成 query 一部分，行為正常
6. **選單開啟時點擊編輯器外部** → Popup 自動關閉

## 不在範圍內

- 圖片、影片、embed 等插入（未來）
- 自訂項目（用戶定義 snippet）
- AI 指令（`/ask`）
- Slash menu 樣式 theming 客製
- Slash command 在 table、callout 等 nested 結構內的行為
- 匯出時保留 language highlight 資訊（只影響 render，儲存仍是 HTML）

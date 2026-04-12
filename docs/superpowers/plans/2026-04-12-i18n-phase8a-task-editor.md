# i18n Phase 8a — Task / Editor 共用核心 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 task-card / task-detail-modal / task-create / move-task-popover / editor slash command / editor block drag / editor code block 的字串搬到 i18n canonical（新增 `task.*` 15 key + `editor.*` 34 key，共 49 key）。

**Architecture:** 沿用 Phase 4-7 節奏：seed canonical → sync → gen-l10n → web client components 用 `useTranslations` 遷移 → slash command 改 `useSlashCommandItems` hook 並透過 `createEditorExtensions({ slashItems })` 注入 → mobile 對應檔案用 `AppL10n` 遷移 → 最終驗證。Mobile ARB 照慣例包含全部 key（過濾 editor.* 不值得複雜化 transpile script）。

**Tech Stack:** next-intl v4 (`useTranslations`, `t.raw`)、Tiptap extension.configure()、Flutter gen-l10n、`AppL10n`。

**Spec:** `docs/superpowers/specs/2026-04-12-i18n-phase8a-task-editor-design.md`

---

## 檔案結構

### 修改

**Canonical：**
- `i18n/canonical/zh-TW.json` — 新增 top-level `task.*` + `editor.*`
- `i18n/canonical/en.json`
- `i18n/canonical/ja.json`

**生成：**
- `i18n/.i18n-cache.json`
- `src/messages/{zh-TW,en,ja}.json`
- `mobile/lib/l10n/app_{zh,en,ja}.arb`
- `mobile/lib/l10n/app_localizations*.dart`

**Web：**
- `src/components/task/task-card.tsx`
- `src/components/task/task-detail-modal.tsx`
- `src/components/task/task-create.tsx`
- `src/components/task/move-task-popover.tsx`
- `src/components/editor/block-drag-handle.tsx`
- `src/components/editor/code-block-node-view.tsx`
- `src/components/editor/slash-command-items.tsx` — 重構為靜態 defs + `useSlashCommandItems` hook
- `src/components/editor/slash-command-menu.tsx` — 遷移空狀態字串
- `src/components/editor/slash-command-extension.ts` — `items` 改從 option 讀
- `src/components/editor/editor-extensions.ts` — `createEditorExtensions` 加 `slashItems` 參數
- `src/components/task/tiptap-editor.tsx` — 呼叫端補 `slashItems`
- `src/components/notes/notes-canvas-editor.tsx` — 呼叫端補 `slashItems`

**Mobile：**
- `mobile/lib/features/tasks/task_card.dart`
- `mobile/lib/features/tasks/task_create_input.dart`

---

# Task 1: Canonical seed + 翻譯 + sync + gen-l10n

**Files:**
- Modify: `i18n/canonical/zh-TW.json`
- Modify: `i18n/canonical/en.json`
- Modify: `i18n/canonical/ja.json`
- Generated: `src/messages/*.json`, `mobile/lib/l10n/*.arb`, `mobile/lib/l10n/app_localizations*.dart`

- [ ] **Step 1: 確認現有 canonical 結構**

```bash
head -5 i18n/canonical/zh-TW.json && grep -c '^  "' i18n/canonical/zh-TW.json
```
Expected: 看到 `common / settings / tags / nav / login` 五個 top-level namespace。

- [ ] **Step 2: 加 `task.*` + `editor.*` 到 zh-TW.json**

在現有最後一個 top-level namespace（`login`）的閉合 `}` 之後、檔案最外層 `}` 之前，加入：

```json
  "task": {
    "dragReorder": "拖曳排序：{title}",
    "checkboxAria": "{title}：{state}",
    "stateCompleted": "已完成",
    "stateIncomplete": "未完成",
    "editTitleAria": "編輯任務標題",
    "expandContentAria": "展開「{title}」的內文",
    "detailExpandPage": "展開為單頁",
    "detailClose": "關閉",
    "detailContentPlaceholder": "輸入內文...",
    "createPlaceholder": "新增任務",
    "moveToOtherDay": "移到其他天",
    "viewDetails": "查看詳情",
    "complete": "完成任務",
    "uncomplete": "取消完成",
    "moveToOtherDate": "移到其他日期"
  },
  "editor": {
    "dragBlockAria": "拖動區塊",
    "dragBlockTitle": "拖動以重新排序",
    "codeLangAria": "切換語言",
    "codeCopyAria": "複製",
    "codeCopiedAria": "已複製",
    "codeCopyTitle": "複製程式碼",
    "slashNoResults": "沒有符合的項目",
    "slashH1Label": "標題 1",
    "slashH1Description": "大標題",
    "slashH1Keywords": "h1|head|heading|標題|大標題",
    "slashH2Label": "標題 2",
    "slashH2Description": "中標題",
    "slashH2Keywords": "h2|head|heading|標題|中標題",
    "slashH3Label": "標題 3",
    "slashH3Description": "小標題",
    "slashH3Keywords": "h3|head|heading|標題|小標題",
    "slashBulletLabel": "項目符號列表",
    "slashBulletDescription": "建立無序列表",
    "slashBulletKeywords": "list|bullet|ul|項目|清單|列表",
    "slashOrderedLabel": "數字列表",
    "slashOrderedDescription": "建立編號列表",
    "slashOrderedKeywords": "ol|number|ordered|數字|編號|列表",
    "slashTodoLabel": "待辦列表",
    "slashTodoDescription": "可勾選的待辦清單",
    "slashTodoKeywords": "todo|task|check|待辦|任務",
    "slashQuoteLabel": "引言",
    "slashQuoteDescription": "引用區塊",
    "slashQuoteKeywords": "quote|blockquote|引用|引言",
    "slashCodeLabel": "程式碼區塊",
    "slashCodeDescription": "含語法高亮的程式碼區塊",
    "slashCodeKeywords": "code|block|程式|程式碼",
    "slashDividerLabel": "分隔線",
    "slashDividerDescription": "插入水平分隔線",
    "slashDividerKeywords": "hr|divider|separator|分隔|分隔線"
  }
```

**注意：** Keywords 採 pipe-delimited 字串而非 JSON array，原因是 Flutter gen-l10n 的 ARB 不支援 list 型別；統一用 `"h1|head|標題"` 讓 web/mobile 共享 canonical 結構。Web 端 filter 時 `.split("|")`。

- [ ] **Step 3: 跑 sync 看 diff**

```bash
npm run i18n:sync
```
Expected: `📊 Diff: +49 ~0 -0`（15 task + 34 editor），49 en + 49 ja pending。

- [ ] **Step 4: 加 `task.*` + `editor.*` 到 en.json**

在對應位置加：

```json
  "task": {
    "dragReorder": "Drag to reorder: {title}",
    "checkboxAria": "{title}: {state}",
    "stateCompleted": "Completed",
    "stateIncomplete": "Not completed",
    "editTitleAria": "Edit task title",
    "expandContentAria": "Expand content of \"{title}\"",
    "detailExpandPage": "Expand to full page",
    "detailClose": "Close",
    "detailContentPlaceholder": "Write content...",
    "createPlaceholder": "Add a task",
    "moveToOtherDay": "Move to another day",
    "viewDetails": "View details",
    "complete": "Complete task",
    "uncomplete": "Mark as incomplete",
    "moveToOtherDate": "Move to another date"
  },
  "editor": {
    "dragBlockAria": "Drag block",
    "dragBlockTitle": "Drag to reorder",
    "codeLangAria": "Switch language",
    "codeCopyAria": "Copy",
    "codeCopiedAria": "Copied",
    "codeCopyTitle": "Copy code",
    "slashNoResults": "No matching items",
    "slashH1Label": "Heading 1",
    "slashH1Description": "Large section heading",
    "slashH1Keywords": "h1|head|heading|large|title",
    "slashH2Label": "Heading 2",
    "slashH2Description": "Medium section heading",
    "slashH2Keywords": "h2|head|heading|medium",
    "slashH3Label": "Heading 3",
    "slashH3Description": "Small section heading",
    "slashH3Keywords": "h3|head|heading|small",
    "slashBulletLabel": "Bullet list",
    "slashBulletDescription": "Create an unordered list",
    "slashBulletKeywords": "list|bullet|ul|unordered",
    "slashOrderedLabel": "Numbered list",
    "slashOrderedDescription": "Create a numbered list",
    "slashOrderedKeywords": "ol|number|ordered|list",
    "slashTodoLabel": "To-do list",
    "slashTodoDescription": "Checklist with checkboxes",
    "slashTodoKeywords": "todo|task|check|checklist",
    "slashQuoteLabel": "Quote",
    "slashQuoteDescription": "Blockquote",
    "slashQuoteKeywords": "quote|blockquote|cite",
    "slashCodeLabel": "Code block",
    "slashCodeDescription": "Code block with syntax highlighting",
    "slashCodeKeywords": "code|block|pre|syntax",
    "slashDividerLabel": "Divider",
    "slashDividerDescription": "Horizontal divider line",
    "slashDividerKeywords": "hr|divider|separator|line"
  }
```

- [ ] **Step 5: 加 `task.*` + `editor.*` 到 ja.json**

```json
  "task": {
    "dragReorder": "並べ替え：{title}",
    "checkboxAria": "{title}：{state}",
    "stateCompleted": "完了",
    "stateIncomplete": "未完了",
    "editTitleAria": "タスク名を編集",
    "expandContentAria": "「{title}」の内容を展開",
    "detailExpandPage": "フルページで開く",
    "detailClose": "閉じる",
    "detailContentPlaceholder": "内容を入力...",
    "createPlaceholder": "タスクを追加",
    "moveToOtherDay": "別の日に移動",
    "viewDetails": "詳細を見る",
    "complete": "タスクを完了",
    "uncomplete": "未完了に戻す",
    "moveToOtherDate": "別の日付に移動"
  },
  "editor": {
    "dragBlockAria": "ブロックをドラッグ",
    "dragBlockTitle": "ドラッグで並べ替え",
    "codeLangAria": "言語を切り替え",
    "codeCopyAria": "コピー",
    "codeCopiedAria": "コピーしました",
    "codeCopyTitle": "コードをコピー",
    "slashNoResults": "該当する項目がありません",
    "slashH1Label": "見出し 1",
    "slashH1Description": "大見出し",
    "slashH1Keywords": "h1|head|heading|見出し|大",
    "slashH2Label": "見出し 2",
    "slashH2Description": "中見出し",
    "slashH2Keywords": "h2|head|heading|見出し|中",
    "slashH3Label": "見出し 3",
    "slashH3Description": "小見出し",
    "slashH3Keywords": "h3|head|heading|見出し|小",
    "slashBulletLabel": "箇条書き",
    "slashBulletDescription": "箇条書きリストを作成",
    "slashBulletKeywords": "list|bullet|ul|箇条書き|リスト",
    "slashOrderedLabel": "番号付きリスト",
    "slashOrderedDescription": "番号付きリストを作成",
    "slashOrderedKeywords": "ol|number|ordered|番号|リスト",
    "slashTodoLabel": "ToDo リスト",
    "slashTodoDescription": "チェックボックス付きリスト",
    "slashTodoKeywords": "todo|task|check|ToDo|タスク",
    "slashQuoteLabel": "引用",
    "slashQuoteDescription": "引用ブロック",
    "slashQuoteKeywords": "quote|blockquote|引用",
    "slashCodeLabel": "コードブロック",
    "slashCodeDescription": "シンタックスハイライト付きコードブロック",
    "slashCodeKeywords": "code|block|コード",
    "slashDividerLabel": "区切り線",
    "slashDividerDescription": "水平区切り線を挿入",
    "slashDividerKeywords": "hr|divider|separator|区切り"
  }
```

- [ ] **Step 6: 再跑 sync**

```bash
npm run i18n:sync
```
Expected: `📊 Diff: +0 ~0 -0`、`✅ Sync 完成`，三語都 in-sync。

- [ ] **Step 7: `i18n:check`**

```bash
npm run i18n:check
```
Expected: `✅ In sync`

- [ ] **Step 8: 重跑 Flutter gen-l10n**

```bash
cd mobile && flutter gen-l10n && cd ..
```

- [ ] **Step 9: 驗證 Flutter getter 產出**

```bash
grep -cE "taskDragReorder|taskCheckboxAria|taskStateCompleted|taskCreatePlaceholder|taskViewDetails|taskComplete|taskUncomplete|taskMoveToOtherDate|editorSlashH1Label" mobile/lib/l10n/app_localizations.dart
```
Expected: ≥ `9`

- [ ] **Step 10: Analyze l10n**

```bash
cd mobile && flutter analyze lib/l10n/ && cd ..
```
Expected: `No issues found!`

- [ ] **Step 11: Commit canonical + 生成檔**

```bash
git add i18n/canonical/ i18n/.i18n-cache.json src/messages/ mobile/lib/l10n/
git commit -m "feat(i18n): 加 task + editor namespace canonical 和 en/ja 翻譯"
```

---

# Task 2: Web task-card.tsx 遷移

**Files:**
- Modify: `src/components/task/task-card.tsx`

- [ ] **Step 1: 讀檔確認 useTranslations import 狀態**

```bash
grep -n "useTranslations" src/components/task/task-card.tsx
```
Expected: 可能無 import，需要加。

- [ ] **Step 2: 加 import**

在 file top imports 區加入（若不存在）：
```tsx
import { useTranslations } from "next-intl";
```

- [ ] **Step 3: 在 component function body 加 `t`**

找到 component function 開頭（例如 `export function TaskCard(...) {`），第一行加：
```tsx
  const t = useTranslations("task");
```

- [ ] **Step 4: 遷移 dragReorder aria-label**

找到 line 96 附近：
```tsx
          aria-label={`拖曳排序：${task.title}`}
```

改成：
```tsx
          aria-label={t("dragReorder", { title: task.title })}
```

- [ ] **Step 5: 遷移 checkbox aria-label**

找到 line 106 附近：
```tsx
          aria-label={`${task.title}：${assignment.isCompleted ? "已完成" : "未完成"}`}
```

改成：
```tsx
          aria-label={t("checkboxAria", {
            title: task.title,
            state: assignment.isCompleted ? t("stateCompleted") : t("stateIncomplete"),
          })}
```

- [ ] **Step 6: 遷移 editTitleAria**

找到 line 141 附近：
```tsx
            aria-label="編輯任務標題"
```

改成：
```tsx
            aria-label={t("editTitleAria")}
```

- [ ] **Step 7: 遷移 expandContentAria**

找到 line 160 附近：
```tsx
          aria-label={`展開「${task.title}」的內文`}
```

改成：
```tsx
          aria-label={t("expandContentAria", { title: task.title })}
```

- [ ] **Step 8: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -E "task-card|error" | head -20
```
Expected: 無 task-card.tsx 相關 error。

- [ ] **Step 9: Commit**

```bash
git add src/components/task/task-card.tsx
git commit -m "refactor(web): task-card 字串改用 useTranslations"
```

---

# Task 3: Web task-detail-modal.tsx + task-create.tsx + move-task-popover.tsx 遷移

**Files:**
- Modify: `src/components/task/task-detail-modal.tsx`
- Modify: `src/components/task/task-create.tsx`
- Modify: `src/components/task/move-task-popover.tsx`

- [ ] **Step 1: task-detail-modal.tsx — 加 import + t**

若無 `useTranslations` import，在 top imports 加：
```tsx
import { useTranslations } from "next-intl";
```

在 component function body 頂端加：
```tsx
  const t = useTranslations("task");
```

- [ ] **Step 2: task-detail-modal.tsx — 遷移 detailExpandPage（兩處）**

找到 line 139-140 附近：
```tsx
              aria-label="展開為單頁"
              title="展開為單頁"
```

改成：
```tsx
              aria-label={t("detailExpandPage")}
              title={t("detailExpandPage")}
```

- [ ] **Step 3: task-detail-modal.tsx — 遷移 detailClose**

找到 line 147 附近：
```tsx
              aria-label="關閉"
```

改成：
```tsx
              aria-label={t("detailClose")}
```

- [ ] **Step 4: task-detail-modal.tsx — 遷移 detailContentPlaceholder**

找到 line 171 附近：
```tsx
            placeholder="輸入內文..."
```

改成：
```tsx
            placeholder={t("detailContentPlaceholder")}
```

- [ ] **Step 5: task-create.tsx — 加 import + t**

若無 `useTranslations` import，加：
```tsx
import { useTranslations } from "next-intl";
```

在 component body 頂端加：
```tsx
  const t = useTranslations("task");
```

- [ ] **Step 6: task-create.tsx — 遷移兩處「新增任務」**

找到 line 23-24 附近：
```tsx
        placeholder="新增任務"
        aria-label="新增任務"
```

改成：
```tsx
        placeholder={t("createPlaceholder")}
        aria-label={t("createPlaceholder")}
```

- [ ] **Step 7: move-task-popover.tsx — 加 import + t**

若無 `useTranslations` import，加：
```tsx
import { useTranslations } from "next-intl";
```

在 component body 頂端加：
```tsx
  const t = useTranslations("task");
```

- [ ] **Step 8: move-task-popover.tsx — 遷移 moveToOtherDay**

找到 line 31 附近：
```tsx
        aria-label="移到其他天"
```

改成：
```tsx
        aria-label={t("moveToOtherDay")}
```

- [ ] **Step 9: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -E "task-detail-modal|task-create|move-task-popover|error" | head -20
```
Expected: 無相關 error。

- [ ] **Step 10: Commit**

```bash
git add src/components/task/task-detail-modal.tsx src/components/task/task-create.tsx src/components/task/move-task-popover.tsx
git commit -m "refactor(web): task modal/create/move-popover 字串改用 useTranslations"
```

---

# Task 4: Web editor block-drag-handle + code-block-node-view 遷移

**Files:**
- Modify: `src/components/editor/block-drag-handle.tsx`
- Modify: `src/components/editor/code-block-node-view.tsx`

- [ ] **Step 1: block-drag-handle.tsx — 加 import + t**

若無 `useTranslations` import，加：
```tsx
import { useTranslations } from "next-intl";
```

在 component function body 頂端加：
```tsx
  const t = useTranslations("editor");
```

- [ ] **Step 2: block-drag-handle.tsx — 遷移兩處**

找到 line 29-30 附近：
```tsx
      aria-label="拖動區塊"
      title="拖動以重新排序"
```

改成：
```tsx
      aria-label={t("dragBlockAria")}
      title={t("dragBlockTitle")}
```

- [ ] **Step 3: code-block-node-view.tsx — 加 import + t**

若無 `useTranslations` import，加：
```tsx
import { useTranslations } from "next-intl";
```

在 component function body 頂端加：
```tsx
  const t = useTranslations("editor");
```

- [ ] **Step 4: code-block-node-view.tsx — 遷移 codeLangAria**

找到 line 41 附近：
```tsx
          aria-label="切換語言"
```

改成：
```tsx
          aria-label={t("codeLangAria")}
```

- [ ] **Step 5: code-block-node-view.tsx — 遷移 codeCopyAria / codeCopiedAria / codeCopyTitle**

找到 line 52-53 附近：
```tsx
          aria-label={copied ? "已複製" : "複製"}
          title={copied ? "已複製" : "複製程式碼"}
```

改成：
```tsx
          aria-label={copied ? t("codeCopiedAria") : t("codeCopyAria")}
          title={copied ? t("codeCopiedAria") : t("codeCopyTitle")}
```

- [ ] **Step 6: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -E "block-drag-handle|code-block-node-view|error" | head -20
```
Expected: 無相關 error。

- [ ] **Step 7: Commit**

```bash
git add src/components/editor/block-drag-handle.tsx src/components/editor/code-block-node-view.tsx
git commit -m "refactor(web): editor block-drag + code-block 字串改用 useTranslations"
```

---

# Task 5: Web slash command 重構為 hook-driven + 遷移

**Files:**
- Modify: `src/components/editor/slash-command-items.tsx` — 拆成靜態 defs + `useSlashCommandItems` hook
- Modify: `src/components/editor/slash-command-extension.ts` — `items` 改從 option 讀
- Modify: `src/components/editor/editor-extensions.ts` — `createEditorExtensions` 加 `slashItems`
- Modify: `src/components/editor/slash-command-menu.tsx` — 遷移 empty state
- Modify: `src/components/task/tiptap-editor.tsx` — 呼叫端補 `slashItems`
- Modify: `src/components/notes/notes-canvas-editor.tsx` — 呼叫端補 `slashItems`

背景：`slashCommandItems` 目前是 module-level const，被 `filterSlashItems` 讀取，後者在 tiptap Suggestion 的 `items` callback 執行（非 React tree）。`useTranslations` 只能在 component 內使用。重構方向：

1. 保留靜態 `SLASH_COMMAND_DEFS`，只含 `{ id, icon, requiredExtension, command }` — 無文字
2. 新增 `useSlashCommandItems()` hook，回傳已翻譯的 `SlashCommandItem[]`
3. `createEditorExtensions` 接收 `slashItems`，傳給 `slashCommandExtension.configure({ items })`
4. `filterSlashItems(items, query, editor)` 改收 items 當第一參數
5. `slashCommandExtension` 在 `items` callback 讀 `this.options.items`

- [ ] **Step 1: 重寫 slash-command-items.tsx**

完整覆寫檔案內容：

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
import { useTranslations } from "next-intl";
import { useMemo } from "react";

export interface SlashCommandItem {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  keywords: string[];
  requiredExtension?: string;
  command: (args: { editor: Editor; range: Range }) => void;
}

interface SlashCommandDef {
  id: string;
  icon: LucideIcon;
  requiredExtension?: string;
  command: (args: { editor: Editor; range: Range }) => void;
}

const SLASH_COMMAND_DEFS: SlashCommandDef[] = [
  {
    id: "h1",
    icon: Heading1,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 1 }).run();
    },
  },
  {
    id: "h2",
    icon: Heading2,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 2 }).run();
    },
  },
  {
    id: "h3",
    icon: Heading3,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 3 }).run();
    },
  },
  {
    id: "bullet",
    icon: List,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    id: "ordered",
    icon: ListOrdered,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    id: "todo",
    icon: ListTodo,
    requiredExtension: "taskList",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run();
    },
  },
  {
    id: "quote",
    icon: Quote,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run();
    },
  },
  {
    id: "code",
    icon: Code,
    requiredExtension: "codeBlock",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
    },
  },
  {
    id: "divider",
    icon: Minus,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },
];

const ID_TO_KEY: Record<string, { label: string; description: string; keywords: string }> = {
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

/** Hook 回傳已翻譯的 slash command items；必須在 client component 內使用 */
export function useSlashCommandItems(): SlashCommandItem[] {
  const t = useTranslations("editor");
  return useMemo(
    () =>
      SLASH_COMMAND_DEFS.map((def) => {
        const keys = ID_TO_KEY[def.id];
        return {
          id: def.id,
          icon: def.icon,
          requiredExtension: def.requiredExtension,
          command: def.command,
          label: t(keys.label),
          description: t(keys.description),
          keywords: t(keys.keywords).split("|").filter(Boolean),
        };
      }),
    [t],
  );
}

/** 根據 query 字串 filter 項目，並排除 editor 未載入的 extension */
export function filterSlashItems(
  items: SlashCommandItem[],
  query: string,
  editor?: Editor,
): SlashCommandItem[] {
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

**注意：** 舊的 `slashCommandItems` export 被拔掉，改為 `SLASH_COMMAND_DEFS`（internal）+ `useSlashCommandItems`（public）。`filterSlashItems` 改簽名。這兩項都是 breaking change，需要同步改 callers。

- [ ] **Step 2: 改 slash-command-extension.ts**

完整覆寫：

```tsx
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

interface SlashCommandExtensionOptions {
  items: SlashCommandItem[];
  suggestion: Record<string, unknown>;
}

export const slashCommandExtension = Extension.create<SlashCommandExtensionOptions>({
  name: "slashCommand",

  addOptions() {
    return {
      items: [],
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
    const extensionOptions = this.options;
    return [
      Suggestion({
        editor: this.editor,
        ...(extensionOptions.suggestion as any),
        items: ({ query, editor }: { query: string; editor: any }) =>
          filterSlashItems(extensionOptions.items, query, editor),
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

- [ ] **Step 3: 改 editor-extensions.ts — `createEditorExtensions` 加 `slashItems` 參數**

找到 `CreateEditorExtensionsOptions` interface（line 117-121）：
```tsx
interface CreateEditorExtensionsOptions {
  placeholder: string;
  taskList?: boolean;
  codeBlock?: boolean;
}
```

改成：
```tsx
import type { SlashCommandItem } from "./slash-command-items";

interface CreateEditorExtensionsOptions {
  placeholder: string;
  slashItems: SlashCommandItem[];
  taskList?: boolean;
  codeBlock?: boolean;
}
```

然後找到 function body（line 123-135 附近）：
```tsx
export function createEditorExtensions({
  placeholder,
  taskList = true,
  codeBlock = true,
}: CreateEditorExtensionsOptions) {
  const extensions = [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      codeBlock: false,
    }),
    Placeholder.configure({ placeholder }),
    slashCommandExtension,
  ];
```

改成：
```tsx
export function createEditorExtensions({
  placeholder,
  slashItems,
  taskList = true,
  codeBlock = true,
}: CreateEditorExtensionsOptions) {
  const extensions = [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      codeBlock: false,
    }),
    Placeholder.configure({ placeholder }),
    slashCommandExtension.configure({ items: slashItems }),
  ];
```

**注意：** 如果 top imports 已經有 `import type { SlashCommandItem }`，不要重複加。

- [ ] **Step 4: 改 slash-command-menu.tsx — 遷移 empty state**

找到 file top imports，加：
```tsx
import { useTranslations } from "next-intl";
```

找到 component function 開頭（line 25 附近）：
```tsx
export const SlashCommandMenu = forwardRef<
  SlashCommandMenuRef,
  SlashCommandMenuProps
>(function SlashCommandMenu({ items, command }, ref) {
  const [selectedIndex, setSelectedIndex] = useState(0);
```

在 `const [selectedIndex, setSelectedIndex] = useState(0);` 之後加：
```tsx
  const t = useTranslations("editor");
```

找到 line 61-67 附近：
```tsx
  if (items.length === 0) {
    return (
      <div className="w-72 rounded-lg bg-popover text-popover-foreground border border-border shadow-lg p-3 text-sm text-text-dim">
        沒有符合的項目
      </div>
    );
  }
```

改成：
```tsx
  if (items.length === 0) {
    return (
      <div className="w-72 rounded-lg bg-popover text-popover-foreground border border-border shadow-lg p-3 text-sm text-text-dim">
        {t("slashNoResults")}
      </div>
    );
  }
```

另外 line 79 的 `key={item.label}` 需改成 `key={item.id}`（因為 label 會因語言切換，用 id 當 key 更穩）：
```tsx
            key={item.id}
```

- [ ] **Step 5: 改 tiptap-editor.tsx — 呼叫端補 slashItems**

讀現檔：
```bash
grep -n "createEditorExtensions" src/components/task/tiptap-editor.tsx
```

找到 line 5 附近的 import：
```tsx
import { createEditorExtensions } from "@/components/editor/editor-extensions";
```

**替換成（加 hook import）：**
```tsx
import { createEditorExtensions } from "@/components/editor/editor-extensions";
import { useSlashCommandItems } from "@/components/editor/slash-command-items";
```

找到 line 34 附近的呼叫：
```tsx
    extensions: createEditorExtensions({ placeholder }),
```

**在呼叫之前先取 hook，並傳入：**

先在 component function body 裡（`useEditor` 呼叫之前）加：
```tsx
  const slashItems = useSlashCommandItems();
```

然後改 useEditor 的 extensions 參數：
```tsx
    extensions: createEditorExtensions({ placeholder, slashItems }),
```

**注意：** `useEditor` 的 options object 可能在 `useMemo` 或裸寫。如果 extensions 改動觸發 re-create editor 會造成 editor reset，需要用 `useMemo(() => createEditorExtensions(...), [placeholder, slashItems])`。檢查現有 code 是否已經 memo：

```bash
grep -n -B2 -A5 "createEditorExtensions" src/components/task/tiptap-editor.tsx
```

如果沒 memo，保持現況（語言切換時 editor reset 是可接受的 UX 取捨，因為 locale 本來就不常切換）。

- [ ] **Step 6: 改 notes-canvas-editor.tsx — 呼叫端補 slashItems**

讀現檔：
```bash
grep -n "createEditorExtensions" src/components/notes/notes-canvas-editor.tsx
```

找到 line 5 附近的 import：
```tsx
import { createEditorExtensions } from "@/components/editor/editor-extensions";
```

加一行：
```tsx
import { useSlashCommandItems } from "@/components/editor/slash-command-items";
```

找到 line 27 附近：
```tsx
    extensions: createEditorExtensions({ placeholder: "寫點什麼⋯⋯", taskList: false, codeBlock: false }),
```

在 `useEditor` 呼叫之前的 component function body 裡加：
```tsx
  const slashItems = useSlashCommandItems();
```

然後改 useEditor 的 extensions 參數：
```tsx
    extensions: createEditorExtensions({ placeholder: "寫點什麼⋯⋯", slashItems, taskList: false, codeBlock: false }),
```

**注意：** `"寫點什麼⋯⋯"` 這個 placeholder 字串**暫時保留硬寫**，屬於 Phase 8b（notes page）的 scope，本次不處理。

- [ ] **Step 7: TypeScript check 全檔**

```bash
npx tsc --noEmit 2>&1 | tail -30
```
Expected: 無 error。

- [ ] **Step 8: Build check**

```bash
npx next build 2>&1 | tail -15
```
Expected: `✓ Compiled successfully`

- [ ] **Step 9: Commit**

```bash
git add src/components/editor/slash-command-items.tsx \
        src/components/editor/slash-command-extension.ts \
        src/components/editor/slash-command-menu.tsx \
        src/components/editor/editor-extensions.ts \
        src/components/task/tiptap-editor.tsx \
        src/components/notes/notes-canvas-editor.tsx
git commit -m "refactor(web): slash command 改 hook-driven 以支援 i18n"
```

---

# Task 6: Mobile task_card.dart + task_create_input.dart 遷移

**Files:**
- Modify: `mobile/lib/features/tasks/task_card.dart`
- Modify: `mobile/lib/features/tasks/task_create_input.dart`

- [ ] **Step 1: task_card.dart — 加 import**

檢查 l10n import：
```bash
grep -n "app_localizations" mobile/lib/features/tasks/task_card.dart
```

若無，在 file top imports 加：
```dart
import '../../l10n/app_localizations.dart';
```

- [ ] **Step 2: task_card.dart — 在 build method 取 `l`**

找到 `Widget build(BuildContext context) {` 的第一行，加：
```dart
    final l = AppL10n.of(context)!;
```

若已有 `l`，跳過此步。

- [ ] **Step 3: task_card.dart — 遷移「完成任務 / 取消完成」**

找到 line 78 附近：
```dart
            label: isDone ? '取消完成' : '完成任務',
```

改成：
```dart
            label: isDone ? l.taskUncomplete : l.taskComplete,
```

- [ ] **Step 4: task_card.dart — 遷移「查看詳情」**

找到 line 153 附近：
```dart
            label: '查看詳情',
```

改成：
```dart
            label: l.taskViewDetails,
```

- [ ] **Step 5: task_card.dart — 遷移「移到其他日期」**

找到 line 173 附近：
```dart
            label: '移到其他日期',
```

改成：
```dart
            label: l.taskMoveToOtherDate,
```

**注意：** Line 187 的 `'狀態：${statusObj.label}'` **保留硬寫**，因為 status 功能 user 可能廢止（spec 決策 5）。

- [ ] **Step 6: task_create_input.dart — 加 import**

檢查：
```bash
grep -n "app_localizations" mobile/lib/features/tasks/task_create_input.dart
```

若無，加：
```dart
import '../../l10n/app_localizations.dart';
```

- [ ] **Step 7: task_create_input.dart — 在 build method 取 `l`**

找到 build method，在開頭加：
```dart
    final l = AppL10n.of(context)!;
```

- [ ] **Step 8: task_create_input.dart — 遷移「新增任務」**

找到 line 40 附近：
```dart
          hintText: '新增任務',
```

改成：
```dart
          hintText: l.taskCreatePlaceholder,
```

- [ ] **Step 9: Flutter analyze**

```bash
cd mobile && flutter analyze lib/features/tasks/task_card.dart lib/features/tasks/task_create_input.dart && cd ..
```
Expected: `No issues found!`

- [ ] **Step 10: 跑 locale_provider test**

```bash
cd mobile && flutter test test/core/locale_provider_test.dart && cd ..
```
Expected: 6/6 pass。

- [ ] **Step 11: Commit**

```bash
git add mobile/lib/features/tasks/task_card.dart mobile/lib/features/tasks/task_create_input.dart
git commit -m "refactor(mobile): task_card + task_create_input 字串改用 AppL10n"
```

---

# Task 7: 最終驗證 + QA checklist

**Files:** 無

- [ ] **Step 1: i18n check**

```bash
npm run i18n:check
```
Expected: `✅ In sync`

- [ ] **Step 2: Next.js build**

```bash
npx next build 2>&1 | tail -20
```
Expected: `✓ Compiled successfully`，無 TS error。

- [ ] **Step 3: Flutter analyze 全 project**

```bash
cd mobile && flutter analyze 2>&1 | tail -5 && cd ..
```
Expected: `No issues found!`

- [ ] **Step 4: Mobile tests**

```bash
cd mobile && flutter test test/core/locale_provider_test.dart 2>&1 | tail -5 && cd ..
```
Expected: 6/6 pass

- [ ] **Step 5: Git log 收尾**

```bash
git log --oneline -n 10
```
Expected: 看到 6 個 phase 8a commit（canonical seed / task-card / task modal+create+move / editor block+code / slash refactor / mobile）。

- [ ] **Step 6: 驗證無殘留硬字串（scope 內檔案）**

```bash
grep -nE "[\u4e00-\u9fff]" \
  src/components/task/task-card.tsx \
  src/components/task/task-detail-modal.tsx \
  src/components/task/task-create.tsx \
  src/components/task/move-task-popover.tsx \
  src/components/editor/block-drag-handle.tsx \
  src/components/editor/code-block-node-view.tsx \
  src/components/editor/slash-command-items.tsx \
  src/components/editor/slash-command-menu.tsx \
  mobile/lib/features/tasks/task_card.dart \
  mobile/lib/features/tasks/task_create_input.dart \
  | grep -vE "^\s*//|^\s*\*|^\s*/\*|狀態：" || echo "✅ clean"
```
Expected: `✅ clean` 或只剩 `狀態：${statusObj.label}`（status 功能保留）以及 comments。

- [ ] **Step 7: 印 QA checklist**

```
========================================================
Phase 8a 手動 QA checklist
========================================================

Web (在 /zh-TW, /en, /ja 各跑一輪):
  1. Day view 任務卡：
     - 打開 DevTools Accessibility tab，hover 拖曳 handle，看 aria-label 對應語言
     - Checkbox aria-label 包含 "已完成/未完成 | Completed/Not completed | 完了/未完了"
     - 標題 input aria-label 對應語言
     - 展開內文 button aria-label 對應語言
  2. Task detail modal（點卡片「展開內文」→ 詳細按鈕）：
     - 展開為單頁按鈕 aria-label + title 對應語言
     - 關閉按鈕 aria-label 對應語言
     - 內文 textarea placeholder 對應語言
  3. Task create input（day view 底部）：
     - Placeholder 對應語言
  4. Move to other day popover（任務卡日期圖示）：
     - aria-label 對應語言
  5. Tiptap editor 拖曳 handle：
     - Hover 一個 block，看左側 grip icon 的 aria-label + title 對應語言
  6. Code block：
     - 插入 code block，上方 toolbar 的「切換語言」和「複製」tooltip 對應語言
     - 點複製後 "Copied!" tooltip 也對應語言
  7. Slash command menu（在 editor 打 `/`）：
     - 9 個指令的 label + description 都對應語言
     - 用英文 keyword 搜尋（例 "heading"）能找到標題指令
     - 用中文 keyword 搜尋（例 "標題"）能找到標題指令
     - 用日文 keyword 搜尋（例 "見出し"）在日文語系能找到
     - 輸入不存在的字串 → 看到「沒有符合的項目 / No matching items / 該当する項目がありません」
  8. Notes canvas editor（/notes 頁面）：
     - 打 `/` slash menu 一樣工作

Mobile (App 切 zh-TW → en → ja):
  1. Task card 長按選單（若有）或 swipe actions：
     - 完成任務 / 取消完成 / 查看詳情 / 移到其他日期 都對應語言
  2. Task create input：
     - Placeholder「新增任務 / Add a task / タスクを追加」
  3. 語言切換後既有任務卡的 aria/label 都更新
========================================================
```

---

## 完成條件

- ✅ `i18n/canonical/*` 含 `task.*` (15 key) + `editor.*` (34 key，含 6 core + noResults + 9×3 slash) = 49 key
- ✅ `npm run i18n:check` `✅ In sync`
- ✅ Web task + editor 檔案無硬寫中文字串（comments 除外）
- ✅ Mobile task_card + task_create_input 無硬寫中文字串（comments + status label 除外）
- ✅ `next build` / `flutter analyze` / `locale_provider_test` 全綠
- ✅ Slash command 三語 label/description/keywords 都正常，filter 跨語 keyword 搜尋正常

## 已知限制 / 留給後續

- Status label（`TASK_STATUSES.label`、`task_card.dart` 的「狀態：xxx」）保留中文硬寫，等 status 功能定案
- `notes-canvas-editor.tsx` 的 `"寫點什麼⋯⋯"` placeholder 留給 Phase 8b
- Day view / Cards / Notes / card-detail 等頁面層留給 Phase 8b
- Mobile tasks_screen / cards_screen / notes_screen / card_detail_screen 留給 Phase 8b
- Landing page 不做
- `editor-extensions.ts` 的中文註解保留（非 UX 文字）

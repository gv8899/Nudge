# Phase 8a 設計規格 — Task / Editor 共用核心 i18n

**日期：** 2026-04-12
**前置：** Phase 0-7 已 merge + 部署到 prod。

## 目的

把跨頁面共用的 task 互動元件（task-card / task-detail-modal / task-create / move-task-popover）與 editor 核心（slash command / block drag / code block）的字串搬到 i18n canonical。這是 Phase 8 的第一個 sub-phase，先把共用 key 定下，Phase 8b 的頁面層遷移就能純粹套用。

## Scope

### 包含（user-facing strings only）

**Web：**
- `src/components/task/task-card.tsx` — aria-label ×5（拖曳排序 / 已完成 / 未完成 / 編輯任務標題 / 展開內文）
- `src/components/task/task-detail-modal.tsx` — aria + title + placeholder ×4（展開為單頁 / 關閉 / 輸入內文...）
- `src/components/task/task-create.tsx` — placeholder + aria（新增任務）
- `src/components/task/move-task-popover.tsx` — aria（移到其他天）
- `src/components/editor/block-drag-handle.tsx` — aria + title（拖動區塊 / 拖動以重新排序）
- `src/components/editor/code-block-node-view.tsx` — aria + title ×4（切換語言 / 複製 / 已複製 / 複製程式碼）
- `src/components/editor/slash-command-items.tsx` — 9 commands × (label + description + keywords)

**Mobile：**
- `mobile/lib/features/tasks/task_card.dart` — 完成任務 / 取消完成 / 查看詳情 / 移到其他日期
- `mobile/lib/features/tasks/task_create_input.dart` — 新增任務（重用 web key）

### 不包含

- **程式註解**（`//` / `/** */`）—— 開發者內部註解，非 UX 文字
- **`src/components/editor/editor-extensions.ts`** —— 檔案內全是註解，零使用者字串
- **Task status label**（`TASK_STATUSES.label`、`status-badge.tsx`、`task_card.dart` 的狀態文字）—— 使用者可能廢止 status 功能，留給未來
- **Landing page** —— Phase 8 scope 外（用戶決定 later 再做）
- **Day view / Cards page / Notes page / card-detail / 其他 feature 頁** —— 歸 Phase 8b
- **Mobile card_detail_screen / notes_feed_screen / tasks_screen 等頁面層** —— 歸 Phase 8b
- **Slash command 只有 web 有，mobile 不需要**（mobile 用 Quill editor 無 slash command）

## 架構決策

### 決策 1 — 兩個 top-level namespace：`task.*` + `editor.*`

**理由：**
- `task.*` 跨 web/mobile 共用，語意是「任務互動」
- `editor.*` 只 web 用，語意是「富文本編輯器」
- 切開讓 mobile ARB 不需要 editor.* 的 key，減少不必要的翻譯

**平行於：** `common / settings / tags / nav / login`

### 決策 2 — Slash command keywords 每語系一組

**決定：** 採用 array 形式的 canonical key，例如：
```json
"editor.slash.h1.keywords": ["h1", "head", "heading", "標題", "大標題"]
```

**Web 取值：** `t.raw("editor.slash.h1.keywords")` 回傳 `string[]`，filter 時用。

**理由：**
- 英文 / 日文使用者用自己語言輸入關鍵字也能找到指令
- 不影響 display label
- next-intl `t.raw` 支援 array 回傳

**Mobile 不用：** Mobile 無 slash command 功能，不需要這些 key 寫入 ARB。作法：只寫 `editor.slash.*` 到 canonical JSON，Flutter gen-l10n 的 arb 透過 transpile script 過濾掉 `editor.*` namespace（或用單獨 getter 命名避免碰撞）。

**實作：** Canonical 仍是單一 source of truth；transpile 到 ARB 時跳過 `editor.*`。若 transpile script 無法過濾，fallback 是把 editor.* 的 keys 全部寫進 ARB 但不呼叫（gen-l10n 會產生 getter 但 mobile code 不用）。後者稍微多一點檔案體積，功能無影響。

**實作備忘：** 若選 fallback 要確認翻譯 arb 體積可接受（27 key × 3 語系 = 81 額外字串）。

### 決策 3 — ICU placeholder for dynamic title

`task.dragReorder` / `task.checkboxAria` / `task.expandContentAria` 三個 key 含 `{title}` 或 `{state}` placeholder：

```json
"task.dragReorder": "拖曳排序：{title}"
"task.checkboxAria": "{title}：{state}"
"task.expandContentAria": "展開「{title}」的內文"
```

Mobile ARB 裡 placeholder 的 `@@type` 為 `String`。Web `t("task.dragReorder", { title: task.title })`。

### 決策 4 — `checkboxAria` 的 `{state}` 處理

原 code：`aria-label={task.title + "：" + (isCompleted ? "已完成" : "未完成")}`

做法：state 本身獨立兩個 key（`task.stateCompleted` / `task.stateIncomplete`），呼叫端組合：
```tsx
const state = assignment.isCompleted ? t("stateCompleted") : t("stateIncomplete");
const aria = t("checkboxAria", { title: task.title, state });
```

比 ICU select 簡單，日/英文順序也能自然。

### 決策 5 — Task status label 不翻

**理由：** 使用者在評估是否廢止 status 功能。Phase 8a 不碰這塊，保留現有硬寫中文 label，未來隨 status 功能一起處理（翻譯或刪除）。

### 決策 6 — Code comments 不翻

**決定：** `//` 和 `/** */` 裡的中文全部保留原狀。

**理由：** 開發者內部註解，對終端使用者不可見。翻譯會增加維護負擔且沒有 UX 價值。

## Canonical keys

### zh-TW.json（新增兩個 top-level namespace）

```json
{
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
    "slash": {
      "h1": {
        "label": "標題 1",
        "description": "大標題",
        "keywords": ["h1", "head", "heading", "標題", "大標題"]
      },
      "h2": {
        "label": "標題 2",
        "description": "中標題",
        "keywords": ["h2", "head", "heading", "標題", "中標題"]
      },
      "h3": {
        "label": "標題 3",
        "description": "小標題",
        "keywords": ["h3", "head", "heading", "標題", "小標題"]
      },
      "bullet": {
        "label": "項目符號列表",
        "description": "建立無序列表",
        "keywords": ["list", "bullet", "ul", "項目", "清單", "列表"]
      },
      "ordered": {
        "label": "數字列表",
        "description": "建立編號列表",
        "keywords": ["ol", "number", "ordered", "數字", "編號", "列表"]
      },
      "todo": {
        "label": "待辦列表",
        "description": "可勾選的待辦清單",
        "keywords": ["todo", "task", "check", "待辦", "任務"]
      },
      "quote": {
        "label": "引言",
        "description": "引用區塊",
        "keywords": ["quote", "blockquote", "引用", "引言"]
      },
      "code": {
        "label": "程式碼區塊",
        "description": "含語法高亮的程式碼區塊",
        "keywords": ["code", "block", "程式", "程式碼"]
      },
      "divider": {
        "label": "分隔線",
        "description": "插入水平分隔線",
        "keywords": ["hr", "divider", "separator", "分隔", "分隔線"]
      }
    }
  }
}
```

### en.json

```json
{
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
    "slash": {
      "h1": {
        "label": "Heading 1",
        "description": "Large section heading",
        "keywords": ["h1", "head", "heading", "large"]
      },
      "h2": {
        "label": "Heading 2",
        "description": "Medium section heading",
        "keywords": ["h2", "head", "heading", "medium"]
      },
      "h3": {
        "label": "Heading 3",
        "description": "Small section heading",
        "keywords": ["h3", "head", "heading", "small"]
      },
      "bullet": {
        "label": "Bullet list",
        "description": "Create an unordered list",
        "keywords": ["list", "bullet", "ul", "unordered"]
      },
      "ordered": {
        "label": "Numbered list",
        "description": "Create a numbered list",
        "keywords": ["ol", "number", "ordered", "list"]
      },
      "todo": {
        "label": "To-do list",
        "description": "Checklist with checkboxes",
        "keywords": ["todo", "task", "check", "checklist"]
      },
      "quote": {
        "label": "Quote",
        "description": "Blockquote",
        "keywords": ["quote", "blockquote", "cite"]
      },
      "code": {
        "label": "Code block",
        "description": "Code block with syntax highlighting",
        "keywords": ["code", "block", "pre", "syntax"]
      },
      "divider": {
        "label": "Divider",
        "description": "Horizontal divider line",
        "keywords": ["hr", "divider", "separator", "line"]
      }
    }
  }
}
```

### ja.json

```json
{
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
    "slash": {
      "h1": {
        "label": "見出し 1",
        "description": "大見出し",
        "keywords": ["h1", "head", "heading", "見出し", "大"]
      },
      "h2": {
        "label": "見出し 2",
        "description": "中見出し",
        "keywords": ["h2", "head", "heading", "見出し", "中"]
      },
      "h3": {
        "label": "見出し 3",
        "description": "小見出し",
        "keywords": ["h3", "head", "heading", "見出し", "小"]
      },
      "bullet": {
        "label": "箇条書き",
        "description": "箇条書きリストを作成",
        "keywords": ["list", "bullet", "ul", "箇条書き", "リスト"]
      },
      "ordered": {
        "label": "番号付きリスト",
        "description": "番号付きリストを作成",
        "keywords": ["ol", "number", "ordered", "番号", "リスト"]
      },
      "todo": {
        "label": "ToDo リスト",
        "description": "チェックボックス付きリスト",
        "keywords": ["todo", "task", "check", "ToDo", "タスク"]
      },
      "quote": {
        "label": "引用",
        "description": "引用ブロック",
        "keywords": ["quote", "blockquote", "引用"]
      },
      "code": {
        "label": "コードブロック",
        "description": "シンタックスハイライト付きコードブロック",
        "keywords": ["code", "block", "コード"]
      },
      "divider": {
        "label": "区切り線",
        "description": "水平区切り線を挿入",
        "keywords": ["hr", "divider", "separator", "区切り"]
      }
    }
  }
}
```

## 字串對照表

### Web `task-card.tsx`

| 原字串 | key |
|---|---|
| `` `拖曳排序：${task.title}` `` | `task.dragReorder` + `{title}` |
| `` `${task.title}：${isCompleted ? "已完成" : "未完成"}` `` | `task.checkboxAria` + `{title, state}` |
| `"已完成"` / `"未完成"` | `task.stateCompleted` / `task.stateIncomplete` |
| `"編輯任務標題"` | `task.editTitleAria` |
| `` `展開「${task.title}」的內文` `` | `task.expandContentAria` + `{title}` |

### Web `task-detail-modal.tsx`

| 原字串 | key |
|---|---|
| `"展開為單頁"` ×2 | `task.detailExpandPage` |
| `"關閉"` | `task.detailClose` |
| `"輸入內文..."` | `task.detailContentPlaceholder` |

### Web `task-create.tsx`

| 原字串 | key |
|---|---|
| `"新增任務"` ×2 (placeholder + aria) | `task.createPlaceholder` |

### Web `move-task-popover.tsx`

| 原字串 | key |
|---|---|
| `"移到其他天"` | `task.moveToOtherDay` |

### Web `block-drag-handle.tsx`

| 原字串 | key |
|---|---|
| `"拖動區塊"` | `editor.dragBlockAria` |
| `"拖動以重新排序"` | `editor.dragBlockTitle` |

### Web `code-block-node-view.tsx`

| 原字串 | key |
|---|---|
| `"切換語言"` | `editor.codeLangAria` |
| `"複製"` | `editor.codeCopyAria` |
| `"已複製"` | `editor.codeCopiedAria` |
| `"複製程式碼"` | `editor.codeCopyTitle` |

### Web `slash-command-items.tsx`

每個 command 用 `t("editor.slash.<id>.label")` / `description` / `keywords`（後者 `t.raw`）。9 個 command × 3 欄位 = 27 個 key。

### Mobile `task_card.dart`

| 原字串 | key |
|---|---|
| `'完成任務'` | `task.complete` |
| `'取消完成'` | `task.uncomplete` |
| `'查看詳情'` | `task.viewDetails` |
| `'移到其他日期'` | `task.moveToOtherDate` |

### Mobile `task_create_input.dart`

| 原字串 | key |
|---|---|
| `'新增任務'` | `task.createPlaceholder` |

## 檔案改動

### 修改

- `i18n/canonical/{zh-TW,en,ja}.json` — 加 `task.*` + `editor.*` namespace
- `src/components/task/task-card.tsx`
- `src/components/task/task-detail-modal.tsx`
- `src/components/task/task-create.tsx`
- `src/components/task/move-task-popover.tsx`
- `src/components/editor/block-drag-handle.tsx`
- `src/components/editor/code-block-node-view.tsx`
- `src/components/editor/slash-command-items.tsx`
- `mobile/lib/features/tasks/task_card.dart`
- `mobile/lib/features/tasks/task_create_input.dart`

### 自動生成

- `src/messages/{zh-TW,en,ja}.json`
- `mobile/lib/l10n/app_{zh,en,ja}.arb`
- `mobile/lib/l10n/app_localizations*.dart`

## Mobile ARB 過濾策略

Mobile 不需要 `editor.*` 的 key。**處理方式：**

1. 先跑 `npm run i18n:sync`，觀察現有 transpile script 是否支援 namespace exclusion。
2. 若支援：設定 mobile 跳過 `editor.*`。
3. 若不支援：fallback 是全部生成進 ARB，Flutter code 單純不呼叫 editor.* getter。體積增加 ~27 × 3 = 81 個 getter，實務可忽略。

**風險：** transpile script 的行為目前未驗證。Plan 會在 Task 1 確認後再定 fallback 路徑。

## 測試策略

- `npm run i18n:check` → `✅ In sync`
- `npx next build` → no TS errors
- `cd mobile && flutter analyze` → no issues
- `cd mobile && flutter test test/core/locale_provider_test.dart` → 6/6
- **手動 QA（本次可實測）：**
  - Web：切 zh-TW / en / ja 看 task card / detail modal / slash command menu 的 label 都有變
  - Slash command 搜尋：在 editor 打 `/`, 輸入英文 keyword 或中文 keyword 都能找到指令
  - Mobile：切語言看 task_card 長按選單（完成任務 / 查看詳情 / 移到其他日期）和 task_create_input 的 placeholder 有變

## 風險與未解問題

### 風險

- **`t.raw` 在 server component 是否回傳 array**：next-intl v4 server 側 `getTranslations` 的 `.raw` 行為需在 Plan 執行時驗證。task-card / slash-command-items 都是 client component，應無影響。
- **ARB namespace 過濾**：若 transpile script 不支援，fallback 方案會讓 mobile 多出未用的 getter。不影響功能但稍微醜。
- **Slash command filter 邏輯改動**：原本 `filterSlashItems` 比對 `item.keywords` 字面，改成從 `t.raw` 取 array 後要確保 filter 函數拿到同結構。

### 已解

- Status label 不翻（Phase 8a scope 外）
- Code comments 不翻
- Mobile 無 slash command（scope 外）
- Landing page 不翻（Phase 8 整體 scope 外）

## 完成條件

- ✅ `i18n/canonical/*` 含 `task.*` (15 key) + `editor.*` (6 key) + `editor.slash.*` (27 key) = 48 key
- ✅ `npm run i18n:check` `✅ In sync`
- ✅ Web task / editor 檔案無硬寫中文字串（comments 除外）
- ✅ Mobile task_card / task_create_input 無硬寫中文字串（comments + status label 除外）
- ✅ `next build` / `flutter analyze` / `locale_provider_test` 全綠
- ✅ Slash command menu 三語切換 + keyword 搜尋正常

## 不做的事

- 不改 task status 相關 UI / 邏輯
- 不改 task / editor 的行為
- 不動 day view / cards / notes / card-detail 頁面（留 Phase 8b）
- 不動 mobile 頁面層（tasks_screen / cards_screen / notes_screen / card_detail_screen 留 Phase 8b）
- 不動 landing page
- 不改 editor-extensions.ts（全是 comments）

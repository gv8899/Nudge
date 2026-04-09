# 色系實作計畫：墨水紙張 (Ink &amp; Paper)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 替換目前抄自 Heptabase 的配色，套用墨水紙張新色系（dark + light mode）

**Architecture:** 修改 `globals.css` 內的 CSS 變數定義（dark + light mode），更新 `constants.ts` 內的 `TASK_STATUSES` 顏色，新增 `--color-status-*` token 供元件使用。所有變動都集中在 design system 入口，元件不需修改。

**Tech Stack:** Tailwind CSS v4（`@theme inline` 語法）、CSS 變數、Next.js

---

## 檔案結構

| 操作 | 檔案 | 職責 |
|------|------|------|
| 修改 | `src/app/globals.css` | dark + light mode CSS 變數，新增 status token |
| 修改 | `src/lib/constants.ts` | `TASK_STATUSES` 內的 color 改為 CSS 變數參考 |

---

### Task 1: 更新 globals.css 內 dark mode 變數

**Files:**
- Modify: `src/app/globals.css:91-129` (`.dark` block)

- [ ] **Step 1: 替換 dark mode 整段變數**

打開 `src/app/globals.css`，找到 `.dark { ... }` 區塊（約第 91-129 行），整段替換為：

```css
.dark {
  /* 背景與表面層次 */
  --background: #1c1b18;
  --foreground: #ebe5d4;
  --card: #252320;
  --card-foreground: #ebe5d4;
  --popover: #252320;
  --popover-foreground: #ebe5d4;
  --primary: #c89968;
  --primary-foreground: #1c1b18;
  --secondary: #252320;
  --secondary-foreground: #ebe5d4;
  --muted: #2c2a25;
  --muted-foreground: #9b9485;
  --accent: #2c2a25;
  --accent-foreground: #ebe5d4;
  --destructive: #b56b5a;
  --border: #3a3833;
  --input: #3a3833;
  --ring: #c89968;

  /* Chart 色（保留 5 個 slot，對應狀態色用） */
  --chart-1: #7a8b9c;
  --chart-2: #c89968;
  --chart-3: #8aa57d;
  --chart-4: #a78aaf;
  --chart-5: #b56b5a;

  /* Sidebar */
  --sidebar: #252320;
  --sidebar-foreground: #ebe5d4;
  --sidebar-primary: #c89968;
  --sidebar-primary-foreground: #1c1b18;
  --sidebar-accent: #2c2a25;
  --sidebar-accent-foreground: #ebe5d4;
  --sidebar-border: #3a3833;
  --sidebar-ring: #c89968;

  /* App-specific tokens */
  --text-dim: #9b9485;
  --text-faint: #6b665a;
  --surface-hover: #2c2a25;
  --border-light: #4a4740;
  --weekend: #b8616a;

  /* Status colors（塵土色階） */
  --status-inbox: #9b9080;
  --status-backlog: #7a8b9c;
  --status-in-progress: #c89968;
  --status-waiting: #a78aaf;
  --status-done: #8aa57d;
  --status-archived: #666666;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: 套用墨水紙張色系 - dark mode"
```

---

### Task 2: 更新 globals.css 內 light mode 變數

**Files:**
- Modify: `src/app/globals.css:56-89` (`:root` block)

- [ ] **Step 1: 替換 light mode 整段變數**

找到 `:root { ... }` 區塊（約第 56-89 行），整段替換為：

```css
:root {
  /* 背景與前景 */
  --background: #faf7ef;
  --foreground: #1c1b18;
  --card: #f3eee0;
  --card-foreground: #1c1b18;
  --popover: #f3eee0;
  --popover-foreground: #1c1b18;
  --primary: #a87a45;
  --primary-foreground: #faf7ef;
  --secondary: #f3eee0;
  --secondary-foreground: #1c1b18;
  --muted: #ebe5d4;
  --muted-foreground: #6e6855;
  --accent: #ebe5d4;
  --accent-foreground: #1c1b18;
  --destructive: #9a4f3f;
  --border: #d8d2bf;
  --input: #d8d2bf;
  --ring: #a87a45;

  /* Chart 色 */
  --chart-1: #5a6b7c;
  --chart-2: #a87a45;
  --chart-3: #5a7050;
  --chart-4: #8a6d92;
  --chart-5: #9a4f3f;

  --radius: 0.625rem;

  /* Sidebar */
  --sidebar: #f3eee0;
  --sidebar-foreground: #1c1b18;
  --sidebar-primary: #a87a45;
  --sidebar-primary-foreground: #faf7ef;
  --sidebar-accent: #ebe5d4;
  --sidebar-accent-foreground: #1c1b18;
  --sidebar-border: #d8d2bf;
  --sidebar-ring: #a87a45;

  /* App-specific tokens */
  --text-dim: #6e6855;
  --text-faint: #a89e85;
  --surface-hover: #ebe5d4;
  --border-light: #c4be9d;
  --weekend: #9a4750;

  /* Status colors（light mode 微調） */
  --status-inbox: #7a7060;
  --status-backlog: #5a6b7c;
  --status-in-progress: #a87a45;
  --status-waiting: #8a6d92;
  --status-done: #5a7050;
  --status-archived: #888888;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: 套用墨水紙張色系 - light mode"
```

---

### Task 3: 在 @theme inline 註冊 status token

**Files:**
- Modify: `src/app/globals.css:7-54` (`@theme inline` block)

- [ ] **Step 1: 在 @theme inline 內新增 status color token**

找到 `@theme inline { ... }` 區塊，在 `--color-weekend: var(--weekend);` 之後新增：

```css
  --color-status-inbox: var(--status-inbox);
  --color-status-backlog: var(--status-backlog);
  --color-status-in-progress: var(--status-in-progress);
  --color-status-waiting: var(--status-waiting);
  --color-status-done: var(--status-done);
  --color-status-archived: var(--status-archived);
```

完整修改後該區段的尾巴會像這樣：

```css
  --color-text-dim: var(--text-dim);
  --color-text-faint: var(--text-faint);
  --color-surface-hover: var(--surface-hover);
  --color-border-light: var(--border-light);
  --color-weekend: var(--weekend);
  --color-status-inbox: var(--status-inbox);
  --color-status-backlog: var(--status-backlog);
  --color-status-in-progress: var(--status-in-progress);
  --color-status-waiting: var(--status-waiting);
  --color-status-done: var(--status-done);
  --color-status-archived: var(--status-archived);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: 註冊 status color tailwind tokens"
```

---

### Task 4: 更新 constants.ts 使用 CSS 變數

**Files:**
- Modify: `src/lib/constants.ts`

- [ ] **Step 1: 整份替換 constants.ts**

整份替換為：

```ts
export const TASK_STATUSES = {
  inbox: { label: "暫記", color: "var(--status-inbox)", bgColor: "color-mix(in srgb, var(--status-inbox) 12%, transparent)" },
  backlog: { label: "待排入", color: "var(--status-backlog)", bgColor: "color-mix(in srgb, var(--status-backlog) 12%, transparent)" },
  in_progress: { label: "自己處理中", color: "var(--status-in-progress)", bgColor: "color-mix(in srgb, var(--status-in-progress) 12%, transparent)" },
  waiting: { label: "等待他人", color: "var(--status-waiting)", bgColor: "color-mix(in srgb, var(--status-waiting) 12%, transparent)" },
  done: { label: "完成", color: "var(--status-done)", bgColor: "color-mix(in srgb, var(--status-done) 12%, transparent)" },
  archived: { label: "已封存", color: "var(--status-archived)", bgColor: "color-mix(in srgb, var(--status-archived) 12%, transparent)" },
} as const;

export type TaskStatus = keyof typeof TASK_STATUSES;

export const TASK_STATUS_LIST: TaskStatus[] = [
  "inbox",
  "backlog",
  "in_progress",
  "waiting",
  "done",
  "archived",
];
```

說明：把 hex 改成 `var(--status-*)`，這樣 light/dark mode 切換時會自動跟著變。`bgColor` 用 `color-mix` 產生 12% alpha 版本，避免再寫一組變數。

- [ ] **Step 2: Commit**

```bash
git add src/lib/constants.ts
git commit -m "feat: TASK_STATUSES 改用 CSS 變數，自動跟隨主題"
```

---

### Task 5: 更新 overdue-section 使用 status token

**Files:**
- Modify: `src/components/daily/overdue-section.tsx`

目前 overdue-section.tsx 使用 `text-chart-2`，雖然 chart-2 已對應到新主色，但語意上應該用 `text-primary` 或 `text-status-in-progress` 更清楚。

- [ ] **Step 1: 把 text-chart-2 改成 text-primary**

打開 `src/components/daily/overdue-section.tsx`，將所有 `text-chart-2` 替換為 `text-primary`。

預期會有兩處：
1. 區塊標題的 `text-chart-2`
2. 「排入今天」按鈕的 `text-chart-2`

- [ ] **Step 2: Commit**

```bash
git add src/components/daily/overdue-section.tsx
git commit -m "refactor: overdue-section 使用 text-primary 取代 text-chart-2"
```

---

### Task 6: 驗證

- [ ] **Step 1: Build 通過**

```bash
npx next build 2>&1 | tail -10
```

預期：build 成功，沒有 CSS 解析錯誤。

- [ ] **Step 2: 啟動 dev server，瀏覽 http://localhost:3000**

```bash
npm run dev
```

確認以下視覺：
1. 整體背景變暖色系（不再是 Heptabase 的冷灰）
2. 過期任務區塊標題與「排入今天」按鈕為沉香木色 (#c89968)
3. 任務狀態 badge 顯示為新色（暫記灰、待排入冷灰藍、處理中沉香木、等待紫灰、完成苔綠、封存深灰）
4. 勾選完成的 checkbox 為沉香木色
5. Hover 任務 row 時背景變成偏暖的灰

- [ ] **Step 3: 切換 light mode（如果有切換 UI）**

開啟瀏覽器 devtools，手動移除 `<html>` 上的 `dark` class，確認 light mode 也正確顯示米白紙感。

- [ ] **Step 4: 最終 commit（如有微調）**

```bash
git add -A
git commit -m "fix: 色系套用後微調"
```

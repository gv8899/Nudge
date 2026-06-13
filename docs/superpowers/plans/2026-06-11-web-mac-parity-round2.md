# Web ↔ Mac Parity 第二輪 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓 web（桌機瀏覽器、zh-TW locale）的觀感與交互逐螢幕貼齊 macOS App。

**Architecture:** 純前端 UI/交互修正，零後端改動。依設計分 5 批次（Task 1–5），每批一條 branch / 一個 PR / `npx next build` + 瀏覽器實測後 merge。Batch 4（Cards master-detail）借用既有 `notes-split.tsx` 的分割樣板，風險最高放最後。

**Tech Stack:** Next.js（App Router, `src/`）、Tailwind v4 token（`globals.css`）、date-fns + next-intl、既有 Radix/Base UI popover/dialog、`notes-split.tsx` 的 `ResizeHandle` 模式。

**Spec:** `docs/superpowers/specs/2026-06-11-web-mac-parity-round2-design.md`

**通用守則：**
- 顏色一律 token（`--primary`/`--selected-fill`/`--selected-stroke`/`--text-dim` 等）；禁硬編碼 hex 或 Tailwind 預設色（`amber-400` 等）。
- 新 i18n key：改 `i18n/canonical/zh-TW.json` → `npm run i18n:sync` → en/ja 待譯列入 `.pending-translations.md`（對話中請使用者翻）→ 再 sync。**不可手改 `src/messages/*.json`**。
- 動 Next.js API 前先讀 `node_modules/next/dist/docs/` 相關章節（AGENTS.md 鐵則）。
- **完成定義（每 Task 末）：** `npx next build` 通過 **＋ 使用者瀏覽器實測整條路徑**（每 Task 附驗收清單）＋ commit。UI 多為視覺/交互，**不可只靠 build 宣稱完成**。
- 每批開工：`git checkout <parity-base> && git pull && git checkout -b <branch>`。`<parity-base>` = round-1 已 merge 則為 `main`，否則為 `feat/web-parity-p0`。

---

## Task 1: 週列重設計（branch: `feat/web-parity-r2-weekstrip`）🎯

把膠囊式星期條改成 Mac 的「星期表頭 + 大數字 + 圓點 + 選中金圓」日曆條。此元件 Tasks 與 Calendar Day 共用，一次修兩處。

**Files:**
- Modify: `src/components/calendar/calendar-nav.tsx`（整檔 1–113，重寫 return 結構）

- [ ] **Step 1: 重寫 `calendar-nav.tsx` 的星期格渲染**

把現有 `weekDays.map` 內每個 button（第 66–92 行）的內聯橫排，改為 Mac 的直排日曆格：上=星期縮寫表頭、中=大數字（選中時包金圓）、下=圓點。`< > Today` 移出 nav 條（見 Step 2）。新 return：

```tsx
  return (
    <nav aria-label={t("calendarNavAria")} className="bg-card rounded-md px-2 md:px-3 py-2">
      <div className="flex items-stretch justify-between gap-0.5 md:gap-1">
        {weekDays.map((day) => {
          const isSelected = isSameDay(day, dateObj);
          const dayStr = format(day, "yyyy-MM-dd");
          const hasTasks = datesWithTasks.has(dayStr);
          return (
            <button
              key={dayStr}
              onClick={() => goTo(day)}
              aria-label={format(day, "PPPP", { locale: dateFnsLocale })}
              aria-current={isSelected ? "date" : undefined}
              className="flex-1 flex flex-col items-center gap-1 py-1 rounded-md hover:bg-surface-hover transition-colors group"
            >
              {/* 星期表頭 */}
              <span className="text-xs font-medium text-text-dim">
                {format(day, "EEE", { locale: dateFnsLocale }).replace(/^週/, "")}
              </span>
              {/* 大數字 + 選中金圓 */}
              <span
                className={`flex items-center justify-center h-9 w-9 rounded-full text-lg tabular-nums transition-colors ${
                  isSelected
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "text-foreground font-medium"
                }`}
              >
                {format(day, "d")}
              </span>
              {/* 圓點 */}
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  hasTasks && !isSelected ? "bg-primary" : "bg-transparent"
                }`}
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>
    </nav>
  );
```

- [ ] **Step 2: 把 `< > Today` 移到標題列左側**

`calendar-nav.tsx` 不再渲染 `< > Today`（已在 Step 1 移除）。改在兩個呼叫端的標題附近渲染，對齊 Mac（左上 toolbar）。為避免重複，導出一個小元件 `WeekNavControls`：

在 `calendar-nav.tsx` 末新增 export（沿用既有 `goToPrevWeek/goToNextWeek/goToToday` 邏輯，但這三個函式依賴 `weekStart`，所以 `WeekNavControls` 自行計算）：

```tsx
export function WeekNavControls({ date, onDateChange }: CalendarNavProps) {
  const tCommon = useTranslations("common");
  const t = useTranslations("daily");
  const dateObj = new Date(date + "T00:00:00");
  const weekStart = startOfWeek(dateObj, { weekStartsOn: 1 });
  const go = (d: Date) => onDateChange(format(d, "yyyy-MM-dd"));
  return (
    <div className="flex items-center gap-1">
      <button onClick={() => go(subDays(weekStart, 7))} aria-label={t("prevWeekAria")}
        className="text-text-dim hover:text-foreground p-1.5 rounded-md hover:bg-surface-hover transition-colors">
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button onClick={() => go(new Date())}
        className="text-sm text-foreground px-2.5 py-1.5 rounded-md hover:bg-surface-hover transition-colors whitespace-nowrap">
        {tCommon("today")}
      </button>
      <button onClick={() => go(addDays(weekStart, 7))} aria-label={t("nextWeekAria")}
        className="text-text-dim hover:text-foreground p-1.5 rounded-md hover:bg-surface-hover transition-colors">
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
```

- [ ] **Step 3: 在 Tasks 頁掛上 `WeekNavControls`**

`src/components/daily/daily-view.tsx`：import `WeekNavControls`，放在標題列（第 357–412 行那個 `flex items-center justify-between` row）的左側。Task 2 會移除該列的 `<h1>`，屆時左側即為 `WeekNavControls`。本 Task 先加上：

```tsx
import { CalendarNav, WeekNavControls } from "@/components/calendar/calendar-nav";
// ...在 line 357 的 row 內，h1 之後、控制區之前插入；或先放 h1 左側：
<WeekNavControls date={currentDate} onDateChange={setCurrentDate} />
```

- [ ] **Step 4: 在 Calendar Day 視圖掛上 `WeekNavControls`**

`src/components/calendar/day-view.tsx`：找到渲染 `CalendarNav` 的位置，在其上方/標題列加 `WeekNavControls`（對齊 Mac Day 視圖左上）。若 day-view 由 `calendar-host.tsx` 包，確認 segmented control（Task 3 會移左上）與 `WeekNavControls` 不衝突 —— 兩者皆靠左排列即可。

- [ ] **Step 5: build**

Run: `npx next build 2>&1 | tail -5`
Expected: 無 error。

- [ ] **Step 6: 瀏覽器實測（請使用者代跑）**

- [ ] `/zh-TW/day/2026-06-11`：週列為「星期表頭 + 大數字 + 圓點」；今天(11)為**填滿金圓**。
- [ ] 點其他日 → 切換正確、金圓跟著移動。
- [ ] 有任務的日子顯示金圓點、無任務不顯示；選中日不顯示點。
- [ ] `< Today >` 在標題列左側、可上一週/下一週/回今天。
- [ ] `/zh-TW/calendar?mode=day`：同一條週列外觀一致。
- [ ] 鍵盤 Tab 可聚焦每日格，`aria-current` 正確。

- [ ] **Step 7: commit + PR**

```bash
git add src/components/calendar/calendar-nav.tsx src/components/daily/daily-view.tsx src/components/calendar/day-view.tsx
git commit -m "feat(web/parity): 週列改 Mac 日曆條（大數字+金圓+圓點），< Today > 移標題列

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```
PR base `<parity-base>`，body 附 Step 6 驗收清單，請使用者實測後 merge。

---

## Task 2: Tasks 頁對齊（branch: `feat/web-parity-r2-tasks`）

移除「Tasks」標題、大標日期改 Mac 英文、尾端 icon 3→2、新增任務改右下 FAB。

**Files:**
- Modify: `src/components/daily/daily-view.tsx`（line 357–412 標題列、line 430 TaskCreate 位置）
- Modify: `src/components/calendar/date-heading.tsx`（line 13, 20–22）
- Modify: `src/components/task/task-card.tsx`（line 213–224 FileText 區）
- Create: `src/components/task/task-fab.tsx`

- [ ] **Step 1: 移除「Tasks」H1，標題列只留 WeekNavControls + 面板控制**

`daily-view.tsx`：刪除 line 358 的 `<h1 className="text-2xl font-bold text-foreground">{tNav("tasks")}</h1>`。標題列左側放 Task 1 的 `WeekNavControls`、右側維持面板控制（calendar/cards 切換 + PanelRight）。`tNav` 若不再使用則一併移除 import 與宣告，避免 lint 未使用警告。

- [ ] **Step 2: DateHeading 改 Mac 英文格式**

`date-heading.tsx`：
- line 13 `GHOST_DATE`：改 `"September 30, 2026"`（MMMM 最寬月份撐寬）。
- line 20 星期：`const dayOfWeek = valid ? format(dateObj, "EEEE", { locale: enUS }) : "—";`（固定英文，得「Thursday」）。
- line 21–22 日期：`const dateFormatted = valid ? format(dateObj, "MMMM d, yyyy", { locale: enUS }) : date;`（固定英文全月，得「June 11, 2026」）。
- 移除不再使用的 `ja`/`zhTW` import 與 `dateFnsLocale`/`locale`（若僅此處用）；保留 `enUS` import。

- [ ] **Step 3: task row 尾端 icon 3→2（移除 FileText inline）**

`task-card.tsx`：刪除 line 213–224 的「展開內文」按鈕（含 `FileText` 與 `setIsModalOpen(true)`）。改把「展開內文 / 描述」動作併入 ⋯ DropdownMenu，避免功能消失 —— 在 `MenuItems()`（line 101–118）最上方加一項：

```tsx
<DropdownMenuItem onClick={() => setIsModalOpen(true)}>
  {t("expandContentAria", { title: task.title })}
</DropdownMenuItem>
```
（`expandContentAria` 為現有 key，可直接複用作選單文字；若覺得語氣不順，依通用守則新增 `task.openDescription` key。）`FileText` import 若不再用則移除。`TaskDetailModal`（line 261）保留。

- [ ] **Step 4: 新增 FAB 元件**

Create `src/components/task/task-fab.tsx`（右下浮動 +，點擊呼叫 onClick；對齊 Mac img1）：

```tsx
"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";

export function TaskFab({ onClick }: { onClick: () => void }) {
  const t = useTranslations("task");
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t("createPlaceholder")}
      title={t("createPlaceholder")}
      className="fixed bottom-8 right-8 z-30 flex items-center justify-center h-12 w-12 rounded-full bg-card text-foreground border border-border shadow-md hover:bg-surface-hover transition-colors"
    >
      <Plus className="h-5 w-5" />
    </button>
  );
}
```

- [ ] **Step 5: 用 FAB 取代常駐 inline 輸入框**

`daily-view.tsx`：
- 移除 line 430 常駐的 `<TaskCreate onSubmit={handleCreateTask} />`。
- 新增 state `const [composerOpen, setComposerOpen] = useState(false);`
- 點 FAB → `setComposerOpen(true)`；composer 開啟時在任務清單頂端顯示 `TaskCreate`，提交或失焦後關閉。最小改法：

```tsx
{composerOpen && (
  <TaskCreate
    onSubmit={(title) => { handleCreateTask(title); /* 連續新增：保持開啟 */ }}
  />
)}
{/* …任務清單… */}
{/* 在最外層（return 的 fragment 內、main div 後）掛 FAB */}
<TaskFab onClick={() => setComposerOpen(true)} />
```
（`TaskCreate` 已自動 focus input？否 —— 為符合「點 FAB 即可打字」，在 `task-create.tsx` input 加 `autoFocus`，或在 composerOpen 變 true 後 focus。採 `autoFocus` 最小化改動。）

- [ ] **Step 6: TaskCreate 加 autoFocus**

`task-create.tsx` line 24 `<input>` 加 `autoFocus`，使 FAB 開啟 composer 後游標即在輸入框。

- [ ] **Step 7: build**

Run: `npx next build 2>&1 | tail -5`
Expected: 無 error、無未使用變數警告（`tNav`/`FileText` 等已清掉）。

- [ ] **Step 8: 瀏覽器實測（請使用者代跑）**

- [ ] `/zh-TW/day/2026-06-11`：無「Tasks」標題；大標顯示「Thursday / June 11, 2026」（英文全月）。
- [ ] 每個任務列尾端只有 **2 個 icon**（移動日期 + ⋯）；⋯ 選單可開描述 Modal。
- [ ] 右下出現浮動 `+`；點它 → 頂端出現輸入框且游標在內 → 打字 + Enter → 任務新增、輸入框清空（可連續新增）。
- [ ] reload 後新任務仍在。
- [ ] 逾期「From earlier」分組仍正常顯示/收合。

- [ ] **Step 9: commit + PR**（訊息同格式，附 Step 8 清單）

---

## Task 3: Calendar 分段控制移左上（branch: `feat/web-parity-r2-calendar`）

**Files:**
- Modify: `src/components/calendar/calendar-host.tsx`（line 94–118）

- [ ] **Step 1: segmented control 由置中改左上**

`calendar-host.tsx` line 95：`<div className="flex justify-center pt-4">` → `<div className="flex justify-start pt-4 px-4 md:px-8">`（對齊 Mac img4/5/6 左上）。其餘 segmented 樣式（line 96–117）不動。

- [ ] **Step 2: 確認 Week/Month 標題格式本輪不動**

不要改 `month-view.tsx` 的 `formatMonthTitle`（zh-TW 已輸出「2026 年 6 月」）與 `week-view` 的 `EEEE`（已輸出「星期一」）。本 Task 僅動位置。

- [ ] **Step 3: build**

Run: `npx next build 2>&1 | tail -5`
Expected: 無 error。

- [ ] **Step 4: 瀏覽器實測（請使用者代跑）**

- [ ] `/zh-TW/calendar?mode=day`、`?mode=week`、`?mode=month`：Day/Week/Month 分段控制都在**左上角**。
- [ ] 三模式切換正常、URL `?mode=` 同步、reload 記住偏好。
- [ ] Month 標題仍是「2026 年 6 月」、Week 星期仍是「星期一 6/8」（確認沒被誤改）。

- [ ] **Step 5: commit + PR**（附 Step 4 清單）

---

## Task 4: 右側面板 + Notes 攤平（branch: `feat/web-parity-r2-panel-notes`）

（依建議順序，結構較輕的這批排在 master-detail 之前。）

**Files:**
- Modify: `src/components/daily/daily-cards-panel.tsx`（line 78–126 搜尋/tags 區、line 139 grid）
- Modify: `src/components/notes/note-entry.tsx`（line 43–51 時間軸、line 56–69 日期區塊）

- [ ] **Step 1: 右側 Cards 面板 → 單欄 + 去搜尋框/tags**

`daily-cards-panel.tsx`：
- 刪除 line 78–126 的展開式搜尋框 + tag chips 整段（`{searchExpanded && (...)}`）。
- 保留 header 的搜尋 icon 按鈕（line 62–74）但改為**僅 icon、不展開輸入**：點擊導向 `/cards`（完整搜尋在 Cards 頁做），或直接移除 onClick 的展開邏輯只留 icon 作裝飾。最小改法：把 `setSearchExpanded` 相關 state 與 `isFiltering`/tag 邏輯刪除，icon 按鈕 onClick 改 `router.push("/cards")`（import `useRouter` from `@/i18n/routing`）。
- line 139 grid：`grid-cols-1 xl:grid-cols-2` → 固定單欄 `grid-cols-1`，間距放寬 `gap-3`。
- `cards` 仍取 `allCards.slice(0, RECENT_LIMIT)`（不再有 filtering 分支，直接取 recents）。

- [ ] **Step 2: Notes 攤平 —— 移除時間軸線 + 圓點**

`note-entry.tsx`：
- 刪除 line 43–51 的「時間軸 column」整個 `<div>`（含 `h-px bg-border`、`rounded-full bg-primary` 圓點、連接線）。
- `<article>`（line 40–41）的 `pl-16 md:pl-20` 改為一般內距 `px-4`（不再為時間軸留左欄），並把 block 做成 Mac 的日期區塊卡：保留 `selected ? " bg-selected-fill"`，加 `rounded-lg`。
- 日期 header（line 56–69）保留大數字 + 月/星期，但移除 line 61–64 那條 `bg-primary/25` 分隔線可選（Mac 無）；整列為單一 block。
- `isLast` prop 不再用於連接線；可留著不影響。

- [ ] **Step 3: build**

Run: `npx next build 2>&1 | tail -5`
Expected: 無 error、無未使用變數（`searchExpanded`/`isFiltering`/tag state 已清）。

- [ ] **Step 4: 瀏覽器實測（請使用者代跑）**

- [ ] Tasks 頁開右側 Cards 面板：**單欄**寬鬆卡片、「Recent Cards N」標題、無搜尋輸入框與 tag chips；搜尋 icon 點擊導向 `/cards`。
- [ ] `/zh-TW/notes`：清單**無垂直時間軸線與圓點**，每則為日期區塊卡；選中態 `bg-selected-fill` 正常；點某則右側詳情正確。

- [ ] **Step 5: commit + PR**（附 Step 4 清單）

---

## Task 5: Cards master-detail（branch: `feat/web-parity-r2-cards-split`）⚠️ 結構最重

把 `/cards` 由「網格 → 點擊跳全寬詳情頁」改為 Mac 的**左清單 + 右詳情同頁分割**，借用 `notes-split.tsx` 模式。同時移除頁標題/eraser/list-grid 切換。

**Files:**
- Modify: `src/components/cards/cards-feed.tsx`（移除標題列 line 138–162、view toggle line 179–208、view 邏輯）
- Create: `src/components/cards/cards-split.tsx`（左 feed + 右 detail + ResizeHandle）
- Modify: `src/app/[locale]/(app)/cards/page.tsx`（改 render `CardsSplit`）
- Modify: `src/app/[locale]/(app)/cards/[id]/page.tsx`（深連結 → render `CardsSplit` 並選中該 id）
- Reference: `src/components/notes/notes-split.tsx`（line 289–369 桌面分割樣板 + `ResizeHandle`）、`src/components/cards/card-detail.tsx`（右側詳情內容）

- [ ] **Step 1: 先讀樣板**

讀 `notes-split.tsx` 全檔，理解 `ResizeHandle`、`LS_DETAIL_WIDTH`/`clampDetailWidth`、`isMd` matchMedia、桌面 `flex` 雙欄、mobile fallback 的寫法。`CardsSplit` 直接照抄此骨架。

- [ ] **Step 2: 建 `cards-split.tsx`（桌面左清單 + 右詳情）**

骨架（對照 notes-split line 297–369）：

```tsx
"use client";
import { useEffect, useState } from "react";
// 沿用 notes-split 的 ResizeHandle / 寬度常數（可抽到共用或在此複製）
// 左：沿用 CardsFeed 的清單渲染（grid），點卡片 setSelectedId 而非 router.push
// 右：<CardDetail id={selectedId} /> 內嵌（非整頁路由）

export function CardsSplit({ initialCardId }: { initialCardId?: string }) {
  const [selectedId, setSelectedId] = useState<string | null>(initialCardId ?? null);
  const [isMd, setIsMd] = useState(false);
  const [detailWidth, setDetailWidth] = useState(480);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    setIsMd(mq.matches);
    const h = (e: MediaQueryListEvent) => setIsMd(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  // Mobile：維持原行為（點卡片走 /cards/[id] 全頁）
  if (!isMd) return <CardsFeed />;

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <div className="flex-1 min-w-0 overflow-y-auto">
        <CardsFeed selectedId={selectedId} onSelectCard={setSelectedId} />
      </div>
      <div className="flex shrink-0 border-l border-border overflow-hidden" style={{ width: detailWidth }}>
        {/* ResizeHandle 仿 notes-split */}
        <div className="flex-1 overflow-y-auto">
          {selectedId
            ? <CardDetail id={selectedId} embedded />
            : <div className="h-full flex items-center justify-center text-text-dim text-sm">{/* 空態：選一張卡片 */}</div>}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 讓 `CardsFeed` 支援受控選取（不跳頁）**

`cards-feed.tsx`：
- 新增 optional props `selectedId?: string | null; onSelectCard?: (id: string) => void;`
- 卡片點擊：若有 `onSelectCard` 則呼叫它（不 `router.push`）；否則維持原 `markOpened` + Link/router 行為（mobile / 無 split 時）。`CardGridItem`/`CardListItem` 目前以何種方式導航需確認 —— 若內部用 `<Link href={/cards/[id]}>`，則 split 模式下改用 `onSelectCard` 包一層攔截（`onClickCapture` 已存在於 line 265/275，可在此 `e.preventDefault()` + `onSelectCard(c.id)`）。
- 移除標題列（line 138–162：`<h1>`、Plus、Eraser）→ Plus「新增卡片」改放清單頂端小按鈕或保留於 split 左欄頂端（Mac 左上有 +）；Eraser 整顆移除（功能下架，符合 spec）。
- 移除 view toggle（line 179–208）與 `view`/`handleViewChange`/`VIEW_STORAGE_KEY`/`List`/`LayoutGrid` import；固定 grid 渲染（刪 list 分支 line 261–269）。

- [ ] **Step 4: 讓 `CardDetail` 支援內嵌模式**

`card-detail.tsx`：加 optional props `id?: string`（split 傳入，取代路由參數）與 `embedded?: boolean`（embedded 時隱藏/調整返回箭頭 line 159–166，因左側清單已在）。embedded 下用傳入的 `id` 取資料，非 embedded 維持原路由參數行為。

- [ ] **Step 5: 接上兩個路由 page**

- `cards/page.tsx`：`<CardsFeed />` → `<CardsSplit />`。
- `cards/[id]/page.tsx`：改 render `<CardsSplit initialCardId={params.id} />`（桌面=分割且選中該卡；mobile=CardsFeed fallback 後仍可走原 detail，視 fallback 行為微調）。確認 `params` 取法符合此版 Next.js（先讀 `node_modules/next/dist/docs/` 的 dynamic route / params 章節，**可能為 async params**）。

- [ ] **Step 6: build**

Run: `npx next build 2>&1 | tail -5`
Expected: 無 error、無未使用 import（`List`/`LayoutGrid`/`Eraser`/`view` 等已清）。

- [ ] **Step 7: 瀏覽器實測（請使用者代跑）**

- [ ] `/zh-TW/cards`：無「Cards」標題、無 Eraser、無 list/grid 切換；網格呈現。
- [ ] 點一張卡片 → **右側**開詳情、左側清單保留（不跳全寬頁）。
- [ ] 編輯標題/內文 → 存檔後左側清單預覽同步更新（SWR 失效）。
- [ ] 直開深連結 `/zh-TW/cards/<id>` → 桌面顯示分割且該卡片已選中於右側。
- [ ] 拖右側分隔線可調寬（若實作 ResizeHandle）；reload 記住寬度。
- [ ] 手機寬度（<768px）：fallback 不壞，可瀏覽卡片。
- [ ] 新增卡片 `+` 仍可建立並進入編輯。

- [ ] **Step 8: commit + PR**（附 Step 7 清單；PR 註明此批為結構改動、請重點測深連結與存檔同步）

---

## Self-Review 紀錄

- **Spec 覆蓋：** 批次 1（週列）=Task 1；批次 2（Tasks）=Task 2；批次 3（Calendar 位置）=Task 3；批次 5（面板+Notes）=Task 4；批次 4（Cards master-detail + 頁頭精簡）=Task 5。spec §2「拿掉功能清單」7 項 → inline 輸入框(T2)、FileText(T2)、list/grid 切換(T5)、Eraser+標題(T5)、全寬詳情(T5)、面板搜尋/tags(T4)、Notes 時間軸(T4) 全覆蓋。spec §3「不動」項在 Task 3 Step 2 明確守住。
- **型別一致：** `WeekNavControls`（T1 定義，T1 Step 3/4 使用）、`TaskFab`（T2 定義/使用）、`CardsSplit`/`onSelectCard`/`embedded`/`initialCardId`（T5 內定義並串接）名稱前後一致。
- **Placeholder：** 無 TBD；每改碼步驟附實際 class/程式碼。Task 5 因屬大型結構重構，部分步驟標明「先讀檔/確認導航實作」—— 這是**必要的讀檔指示**而非佔位，執行者依現有 `CardGridItem`/`CardListItem` 與此版 Next.js params 實作補齊。
- **風險：** Task 5 為唯一結構改動，已要求 Step 1 先讀 `notes-split.tsx` 樣板、Step 5 先讀 Next.js params 文件。

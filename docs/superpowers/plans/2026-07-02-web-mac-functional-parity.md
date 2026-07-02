# Web ↔ Mac 功能對齊 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 web 補齊到與 Mac app 功能一致（spec = `docs/web-parity/2026-07-02-web-parity-recheck.md` 的 A1–A4、B1–B4、B6、B7），web 領先項不動，UI 視覺留到下一輪。

**Architecture:** 全部純前端 `src/` 改動 + i18n canonical 補 key。**零後端改動** —— 封存走既有 `/api/tasks/[id]/status`、絕對提醒走既有 `PATCH /api/tasks/[id]` 的 `remindAt` 欄位（schema 已有）、刪帳號走既有 `DELETE /api/me`（Apple 已在用）。

**Tech Stack:** Next.js（注意：讀 `node_modules/next/dist/docs/` 的新版慣例）、SWR、Base UI（popover/menu 用 `render` prop 不是 `asChild`）、vitest（測試檔與 source 同層 `*.test.ts`）、next-intl。

## Global Constraints

- 顏色只准用 design token（`bg-warning`、`text-destructive` 等；`--warning/--success/--info` 已存在於 `src/app/globals.css:125-127`），禁止硬編碼 hex / Tailwind 預設色。
- i18n：唯一 source = `i18n/canonical/zh-TW.json`；en/ja 直接編輯 `i18n/canonical/en.json` / `ja.json`（本計畫的 en/ja 翻譯全部給在任務裡，鏡像自 Apple xcstrings）；改完跑 `npm run i18n:sync`；**`src/messages/*` 是生成檔不要手改**。
- 指令一律 `env -u NODE_OPTIONS` 前綴（harness 注入的 preload 檔不存在會炸 node）。
- 每個 task 結尾：`env -u NODE_OPTIONS npm test` + `env -u NODE_OPTIONS npx next build` 全綠才 commit。
- **互動功能 build 過 ≠ 完成**：所有 task 做完後要列瀏覽器實測清單給使用者代跑（見文末），實測過才 merge。**不要在使用者實測前搶著開 PR。**
- TS 坑：對 `.filter()` 後的陣列字面量不做 contextual typing —— 先 annotate 再 filter。

---

### Task 1 (A1): 描述編輯 debounce 關閉時 flush —— 修掉存檔遺失

Mac 在 blur/disappear/tab-switch 都會 flush pending save（`CardDetailView.swift:142-171`）；web 只有 800ms debounce，在窗內關 Modal / 導航會掉最後一次編輯。抽一個可測的純邏輯 `DebouncedSaver`，再接進 `TaskDetailModal` 與 `CardDetail`。

**Files:**
- Create: `src/lib/debounced-saver.ts`
- Test: `src/lib/debounced-saver.test.ts`
- Modify: `src/components/task/task-detail-modal.tsx`（`saveTimerRef` + `handleDescChange`，行 41、104-116；close/expand 路徑）
- Modify: `src/components/cards/card-detail.tsx`（`handleDescChange`，行 124-137）

**Interfaces:**
- Produces: `class DebouncedSaver<T> { constructor(save: (v: T) => void, delayMs?: number); schedule(value: T): void; flush(): void; cancel(): void }` —— `flush()` 立即執行 pending save（若有）並清 timer；`cancel()` 丟棄 pending。

- [ ] **Step 1: 寫 failing test**

```ts
// src/lib/debounced-saver.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DebouncedSaver } from "./debounced-saver";

describe("DebouncedSaver", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("延遲後只存最後一次的值", () => {
    const save = vi.fn();
    const saver = new DebouncedSaver<string>(save, 800);
    saver.schedule("a");
    saver.schedule("b");
    vi.advanceTimersByTime(799);
    expect(save).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(save).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledWith("b");
  });

  it("flush 立即存 pending 值，且 timer 不會再觸發", () => {
    const save = vi.fn();
    const saver = new DebouncedSaver<string>(save, 800);
    saver.schedule("a");
    saver.flush();
    expect(save).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledWith("a");
    vi.advanceTimersByTime(2000);
    expect(save).toHaveBeenCalledOnce(); // 不重複
  });

  it("沒有 pending 時 flush 是 no-op", () => {
    const save = vi.fn();
    new DebouncedSaver<string>(save, 800).flush();
    expect(save).not.toHaveBeenCalled();
  });

  it("cancel 丟棄 pending", () => {
    const save = vi.fn();
    const saver = new DebouncedSaver<string>(save, 800);
    saver.schedule("a");
    saver.cancel();
    vi.advanceTimersByTime(2000);
    saver.flush();
    expect(save).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 跑測試確認 fail**

Run: `env -u NODE_OPTIONS npx vitest run src/lib/debounced-saver.test.ts`
Expected: FAIL（module not found）

- [ ] **Step 3: 實作**

```ts
// src/lib/debounced-saver.ts
/**
 * Debounce 儲存 + 可 flush。對齊 Mac CardDetailView 的 flushPendingSave：
 * 關閉/離開畫面時把還沒送出的編輯立即存檔，避免 debounce 窗內的編輯遺失。
 */
export class DebouncedSaver<T> {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pending: { value: T } | null = null;

  constructor(
    private readonly save: (value: T) => void,
    private readonly delayMs = 800,
  ) {}

  schedule(value: T): void {
    this.pending = { value };
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), this.delayMs);
  }

  flush(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.pending) {
      const { value } = this.pending;
      this.pending = null;
      this.save(value);
    }
  }

  cancel(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.pending = null;
  }
}
```

- [ ] **Step 4: 跑測試確認 pass**

Run: `env -u NODE_OPTIONS npx vitest run src/lib/debounced-saver.test.ts`
Expected: PASS（4 tests）

- [ ] **Step 5: 接進 TaskDetailModal**

`src/components/task/task-detail-modal.tsx`：

1. import 換掉 timer ref：

```ts
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { DebouncedSaver } from "@/lib/debounced-saver";
```

2. 刪掉 `const saveTimerRef = useRef<...>(null);`（行 41），改成（放在 `titleDraft` state 附近）：

```ts
// onDescChange 用 ref 固定最新版，saver 只建一次
const onDescChangeRef = useRef(onDescChange);
onDescChangeRef.current = onDescChange;
const descSaver = useMemo(
  () =>
    new DebouncedSaver<string>((html) => {
      const isEmpty =
        !html ||
        html === "<p></p>" ||
        html.replace(/<[^>]*>/g, "").trim() === "";
      onDescChangeRef.current(isEmpty ? "" : html);
    }, 800),
  []
);
// unmount 時 flush（對齊 Mac onDisappear）
useEffect(() => () => descSaver.flush(), [descSaver]);
```

3. `handleDescChange`（行 104-116）改為：

```ts
const handleDescChange = useCallback(
  (html: string) => descSaver.schedule(html),
  [descSaver]
);
```

4. 所有關閉/展開路徑先 flush。加一個 wrapper 並全面替換：

```ts
const handleClose = useCallback(() => {
  descSaver.flush();
  onClose();
}, [descSaver, onClose]);
```

- Escape handler（行 68-70）`onClose()` → `handleClose()`（useEffect deps 同步改 `[open, handleClose]`）
- 背景遮罩 `onClick={onClose}`（行 130）→ `onClick={handleClose}`
- X 按鈕 `onClick={onClose}`（行 188）→ `onClick={handleClose}`
- expand 按鈕（行 170）改 `onClick={() => { descSaver.flush(); onExpand!(); }}`

- [ ] **Step 6: 接進 CardDetail（全頁）**

`src/components/cards/card-detail.tsx`：同樣模式 —— 刪 `saveTimerRef`（行 52），加：

```ts
import { DebouncedSaver } from "@/lib/debounced-saver";
```

```ts
const patchTaskRef = useRef(patchTask);
patchTaskRef.current = patchTask;
const descSaver = useMemo(
  () =>
    new DebouncedSaver<string>((html) => {
      const isEmpty =
        !html ||
        html === "<p></p>" ||
        html.replace(/<[^>]*>/g, "").trim() === "";
      patchTaskRef.current({ description: isEmpty ? "" : html });
    }, 800),
  []
);
useEffect(() => () => descSaver.flush(), [descSaver]);

const handleDescChange = useCallback(
  (html: string) => descSaver.schedule(html),
  [descSaver]
);
```

（`useMemo` 記得加進第 3 行的 react import。）

- [ ] **Step 7: 全綠 + commit**

Run: `env -u NODE_OPTIONS npm test && env -u NODE_OPTIONS npx next build`
Expected: 測試全過、build 成功

```bash
git add src/lib/debounced-saver.ts src/lib/debounced-saver.test.ts src/components/task/task-detail-modal.tsx src/components/cards/card-detail.tsx
git commit -m "fix(web/cards): 描述編輯關閉時 flush pending 存檔，對齊 Mac 防資料遺失"
```

---

### Task 2 (A4): Cards grid 選中態接線

> A2（Modal 補 tags/排程）**使用者拍板不做**（2026-07-02）——快速 Modal 維持現狀，tags/排程只在全頁。本 task 只剩 A4。

macOS 開著 Modal 時對應 grid tile 會高亮（`CardsHostView.swift:419`）；web 的 `CardGridItem` 有 `selected` prop（`card-grid-item.tsx:15-20`）但 `CardsFeed` 沒傳。

**Files:**
- Modify: `src/components/cards/cards-feed.tsx`（grid 傳 selected）

- [ ] **Step 1 (A4): grid 選中態接線**

`cards-feed.tsx` 行 225-228 改：

```tsx
<CardGridItem
  card={c}
  selected={modalCardId === c.id}
  onOpenInline={(id) => setModalCardId(id)}
/>
```

- [ ] **Step 2: 全綠 + commit**

Run: `env -u NODE_OPTIONS npm test && env -u NODE_OPTIONS npx next build`

```bash
git add src/components/cards/cards-feed.tsx
git commit -m "feat(web/cards): 開 Modal 時 grid 卡片選中高亮，對齊 Mac"
```

---

### Task 3 (A3): Calendar 頁週列圓點改吃 calendar events

`/calendar` 日檢視的週列圓點目前吃 `/api/daily/week`（任務），Mac 是從已載入的 events 算（`CalendarHostView.swift:333-336`）。host 的 day 模式本來就抓整週 events（`calendar-host.tsx:59-66` 用 `weekRange(date)`），所以只要加 override prop。**Daily 頁的週列不動**（那邊本來就該顯示任務圓點）。

**Files:**
- Modify: `src/components/calendar/calendar-nav.tsx`
- Modify: `src/components/calendar/day-view.tsx`

**Interfaces:**
- Produces: `CalendarNav` 新 prop `dotDates?: string[]`（YYYY-MM-DD；提供時完全跳過 `/api/daily/week` fetch）

- [ ] **Step 1: CalendarNav 加 override**

`calendar-nav.tsx`：interface 改成

```ts
interface CalendarNavProps {
  date: string;
  onDateChange: (date: string) => void;
  /** 圓點日期 override（YYYY-MM-DD）。提供時不打 /api/daily/week，
   *  由呼叫端決定資料源（Calendar 頁 = events；Daily 頁不傳 = 任務）。 */
  dotDates?: string[];
}
```

`CalendarNav` 函式簽名加 `dotDates`，SWR 行（38-43）改為條件 fetch：

```ts
const { data: weekData } = useSWR<{ datesWithTasks: string[] }>(
  dotDates
    ? null
    : `/api/daily/week?start=${weekStartStr}&end=${weekEndStr}`,
  fetcher,
  { keepPreviousData: true }
);
const dotSet = new Set(dotDates ?? weekData?.datesWithTasks ?? []);
```

行 55 `const hasTasks = datesWithTasks.has(dayStr);` → `const hasDot = dotSet.has(dayStr);`，行 78 的 `hasTasks` 同步改 `hasDot`。

（`WeekNavControls` 共用同一個 interface，多一個 optional prop 無影響。）

- [ ] **Step 2: day-view 傳 events 圓點**

`day-view.tsx` 的 `<CalendarNav date={date} onDateChange={onDateChange} />` 改：

```tsx
<CalendarNav
  date={date}
  onDateChange={onDateChange}
  dotDates={[...eventsByDate.entries()]
    .filter(([, evs]) => evs.length > 0)
    .map(([d]) => d)}
/>
```

- [ ] **Step 3: 全綠 + commit**

Run: `env -u NODE_OPTIONS npm test && env -u NODE_OPTIONS npx next build`

```bash
git add src/components/calendar/calendar-nav.tsx src/components/calendar/day-view.tsx
git commit -m "fix(web/calendar): 日檢視週列圓點改吃 calendar events，對齊 Mac 資料源"
```

---

### Task 4 (B7): 事件詳情時間列加日期前綴

Mac 顯示「5月7日 (三) · 09:00 – 10:00」（`CalendarEventDetailSheet.swift:102-109`）；web 只有時間。

**Files:**
- Modify: `src/components/calendar/event-popover.tsx`

- [ ] **Step 1: 加日期前綴**

`event-popover.tsx`：

```ts
import { format } from "date-fns";
import { enUS, ja, zhTW } from "date-fns/locale";
import { useTranslations, useLocale } from "next-intl";
```

`EventPopover` 內（行 25 後）：

```ts
const locale = useLocale();
const dfLocale = locale === "ja" ? ja : locale === "en" ? enUS : zhTW;
const datePrefix = format(
  new Date(event.start),
  locale === "en" ? "MMM d (EEE)" : "M月d日 (EEE)",
  { locale: dfLocale }
);

const timeLabel = event.allDay
  ? `${datePrefix} · ${t("eventAllDay")}`
  : `${datePrefix} · ${formatHHMM(event.start)} – ${formatHHMM(event.end)}`;
```

- [ ] **Step 2: 全綠 + commit**

Run: `env -u NODE_OPTIONS npm test && env -u NODE_OPTIONS npx next build`

```bash
git add src/components/calendar/event-popover.tsx
git commit -m "feat(web/calendar): 事件詳情時間列加日期前綴，對齊 Mac"
```

---

### Task 5 (B1): 任務 row 選單補「封存」+「移到今天」

Mac 每個 row 的 `…` 選單有 moveToToday（非今天時）/ skip 或 setRecurring / setReminder / archive（`TaskRowMenu.swift:62-113,169-190`）。web 只有 skip/recurrence+reminder；封存只在 overdue 有。沿用 overdue 的確認框模式（web 領先項，保留）。

**Files:**
- Modify: `src/components/task/task-card.tsx`
- Modify: `src/components/daily/daily-view.tsx`（傳 `onArchive` 給 TaskCard；找到 `<TaskCard` render 處，在 `onMoveToDate` 附近加 prop）
- Modify: `i18n/canonical/zh-TW.json`、`en.json`、`ja.json`

**Interfaces:**
- Consumes: `daily-view.tsx:260` 既有 `handleArchive(assignmentId: string, taskId: string)`（PATCH `/api/tasks/[id]/status` `{status:"archived"}`）
- Produces: `TaskCard` 新 prop `onArchive: (assignmentId: string, taskId: string) => void`

- [ ] **Step 1: i18n key**

canonical `daily` 區塊加（zh-TW / en / ja，鏡像 xcstrings 既有翻譯）：

| key | zh-TW | en | ja |
| --- | --- | --- | --- |
| `daily.moveToToday` | 移到今天 | Move to today | 今日に移動 |

跑 `env -u NODE_OPTIONS npm run i18n:sync` → 填 en/ja → 再 sync。
（`daily.archiveTitle` / `archiveConfirmBody` / `archiveButton` canonical 已有，直接用。）

- [ ] **Step 2: TaskCard 加選單項 + 確認框**

`task-card.tsx`：

1. props 加 `onArchive: (assignmentId: string, taskId: string) => void;`，解構加 `onArchive`。
2. state 加 `const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);`
3. 今天判斷（component 頂部）：

```ts
const todayStr = new Date().toISOString().slice(0, 10);
const isToday = currentDate === todayStr;
```

4. `MenuItems()`（行 73-90）改為 —— 順序對齊 Mac TaskRowMenu（moveToToday → skip/recurring → reminder → archive）：

```tsx
function MenuItems() {
  return (
    <>
      {!isToday && (
        <DropdownMenuItem onClick={() => onMoveToDate(assignment.id, todayStr)}>
          {tDaily("moveToToday")}
        </DropdownMenuItem>
      )}
      {isRecurring ? (
        <DropdownMenuItem onClick={() => setSkipDialogOpen(true)}>
          {tDaily("skipThisOccurrence")}
        </DropdownMenuItem>
      ) : (
        <DropdownMenuItem onClick={() => setScheduleDialogOpen(true)}>
          {tDaily("setRecurring")}
        </DropdownMenuItem>
      )}
      <DropdownMenuItem onClick={() => setScheduleDialogOpen(true)}>
        {tDaily("setReminder")}
      </DropdownMenuItem>
      <DropdownMenuItem
        className="text-destructive focus:text-destructive"
        onClick={() => setArchiveConfirmOpen(true)}
      >
        {tDaily("archiveButton")}
      </DropdownMenuItem>
    </>
  );
}
```

5. 右鍵 ContextMenu popup（行 180-193）同步加兩個 `ContextMenuPrimitive.Item`（同 `itemClassName`）：moveToToday（`!isToday` 時）在最上、archive 在最下（archive 的 className 補 ` text-destructive`）。
6. 確認框（放檔尾 `<SkipConfirmationDialog>` 旁邊）—— 沿用 overdue-section 的 Dialog 模式：

```tsx
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
```

```tsx
<Dialog open={archiveConfirmOpen} onOpenChange={setArchiveConfirmOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>{tDaily("archiveTitle")}</DialogTitle>
      <DialogDescription>
        {tDaily("archiveConfirmBody", { title: task.title })}
      </DialogDescription>
    </DialogHeader>
    <div className="flex justify-end gap-2">
      <button
        type="button"
        onClick={() => setArchiveConfirmOpen(false)}
        className="rounded-md border border-border px-3 py-1.5 text-sm text-text-dim hover:text-foreground hover:bg-surface-hover transition-colors"
      >
        {t("cancel") /* 若 task namespace 無 cancel，改 useTranslations("common") 取 */}
      </button>
      <button
        type="button"
        onClick={() => {
          onArchive(assignment.id, task.id);
          setArchiveConfirmOpen(false);
        }}
        className="rounded-md bg-destructive px-3 py-1.5 text-sm text-primary-foreground"
      >
        {tDaily("archiveButton")}
      </button>
    </div>
  </DialogContent>
</Dialog>
```

（實作時先看 `overdue-section.tsx:117-146` 的既有 Dialog 寫法，按鈕樣式抄它，取消鍵用 `useTranslations("common")("cancel")`。）

- [ ] **Step 3: daily-view 傳 onArchive**

`daily-view.tsx` render `<TaskCard ...>` 處（incomplete 與 completed 兩個清單都要）加：

```tsx
onArchive={handleArchive}
```

- [ ] **Step 4: 全綠 + commit**

Run: `env -u NODE_OPTIONS npm test && env -u NODE_OPTIONS npx next build`

```bash
git add src/components/task/task-card.tsx src/components/daily/daily-view.tsx i18n/canonical src/messages
git commit -m "feat(web/daily): 任務 row 選單補封存(含確認)與移到今天，對齊 Mac TaskRowMenu"
```

---

### Task 6 (B2): 一次性任務的絕對時間提醒

Mac：提醒 toggle 獨立於重複；有 preset → time-of-day，無 preset → 日期+時間（存 `tasks.remindAt`，`ScheduleSection.swift:257-307`）。web 現在 `preset===null` 直接顯示「先設定重複」。**後端已支援**：`PATCH /api/tasks/[id]` 收 `remindAt`（route 行 77），`/api/reminders` 已把兩種提醒都吐給裝置排程。

**Files:**
- Create: `src/lib/reminder-time.ts`
- Test: `src/lib/reminder-time.test.ts`
- Modify: `src/components/task/schedule-section.tsx`（reminder 區塊，行 290-318 + 相關 state/save）
- Modify: `i18n/canonical/zh-TW.json`、`en.json`、`ja.json`

**Interfaces:**
- Produces: `composeRemindAtISO(date: string, time: string): string`（local `YYYY-MM-DD` + `HH:MM` → UTC ISO）與 `splitRemindAtISO(iso: string): { date: string; time: string }`（反向、local）
- Consumes: `useTaskRecurrence` 既有 `save(rule)`；`PATCH /api/tasks/[id]` 的 `remindAt` 欄位

- [ ] **Step 1: 寫 failing test**

```ts
// src/lib/reminder-time.test.ts
import { describe, it, expect } from "vitest";
import { composeRemindAtISO, splitRemindAtISO } from "./reminder-time";

describe("reminder-time", () => {
  it("compose → split round-trips（local）", () => {
    const iso = composeRemindAtISO("2026-07-15", "09:30");
    const { date, time } = splitRemindAtISO(iso);
    expect(date).toBe("2026-07-15");
    expect(time).toBe("09:30");
  });

  it("compose 輸出合法 ISO（可被 Date parse）", () => {
    const iso = composeRemindAtISO("2026-01-02", "23:05");
    expect(Number.isNaN(new Date(iso).getTime())).toBe(false);
    expect(iso.endsWith("Z")).toBe(true);
  });
});
```

- [ ] **Step 2: 跑測試確認 fail**

Run: `env -u NODE_OPTIONS npx vitest run src/lib/reminder-time.test.ts`
Expected: FAIL（module not found）

- [ ] **Step 3: 實作**

```ts
// src/lib/reminder-time.ts
/**
 * 絕對提醒時間（tasks.remindAt）的組裝/拆解。
 * 存 UTC ISO（Apple 端 parseISODateTime 可讀）；輸入輸出都用使用者 local 時區。
 */
export function composeRemindAtISO(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
}

export function splitRemindAtISO(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}
```

- [ ] **Step 4: 跑測試確認 pass**

Run: `env -u NODE_OPTIONS npx vitest run src/lib/reminder-time.test.ts`
Expected: PASS

- [ ] **Step 5: i18n key**

canonical `schedule.reminder` 加（鏡像 xcstrings）：

| key | zh-TW | en | ja |
| --- | --- | --- | --- |
| `schedule.reminder.enabled` | 推播通知 | Push notification | プッシュ通知 |
| `schedule.reminder.dateTime` | 提醒時間 | Reminder time | 通知日時 |

sync → 填 en/ja → 再 sync。（既有 `reminder.label`=提醒時間 給 time-of-day row 用；`requiresPreset` 之後不再被引用，key 先留著。）

- [ ] **Step 6: ScheduleSection 改 reminder 區塊**

`schedule-section.tsx`：

1. import 加：

```ts
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { composeRemindAtISO, splitRemindAtISO } from "@/lib/reminder-time";
```

2. state 區加（`remindAt` state 附近）：

```ts
// 絕對提醒（無重複時用）— 存 tasks.remindAt
const { data: taskData, mutate: mutateTask } = useSWR<{ remindAt: string | null }>(
  `/api/tasks/${taskId}`,
  fetcher
);
const [hasReminder, setHasReminder] = useState(false);
const [absDate, setAbsDate] = useState(today());
const [absTime, setAbsTime] = useState("09:00");
const [didApplyTask, setDidApplyTask] = useState(false);
```

3. 從 server 同步絕對提醒（一次）：

```ts
useEffect(() => {
  if (taskData === undefined || didApplyTask) return;
  if (taskData?.remindAt) {
    const { date, time } = splitRemindAtISO(taskData.remindAt);
    setAbsDate(date);
    setAbsTime(time);
    setHasReminder(true);
  }
  setDidApplyTask(true);
}, [taskData, didApplyTask]);
```

4. 既有 recurrence 同步 effect（行 75-90）補一行：`if (data?.remindAtTimeOfDay) setHasReminder(true);`
5. 儲存絕對提醒的 helper：

```ts
async function saveAbsoluteReminder(value: string | null) {
  await fetch(`/api/tasks/${taskId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ remindAt: value }),
  });
  mutateTask();
}
```

6. debounce save effect 的 deps（行 114-123）加 `hasReminder, absDate, absTime`；`doSave()` 改成兩軌（對齊 Mac：preset 存在時清絕對提醒、反之亦然）：

```ts
async function doSave() {
  if (preset === null) {
    await save(null); // 清 recurrence
    await saveAbsoluteReminder(
      hasReminder ? composeRemindAtISO(absDate, absTime) : null
    );
    return;
  }
  const rule: RecurrenceRule = {
    preset,
    weekdays:
      preset === "weekly" || preset === "biweekly"
        ? weekdaysToCsv(weekdays)
        : null,
    monthDay:
      preset === "monthly_day"
        ? new Date(startDate + "T00:00").getDate()
        : null,
    monthNth: preset === "monthly_nth_weekday" ? monthNth : null,
    monthNthWeekday:
      preset === "monthly_nth_weekday" ? monthNthWeekday : null,
    startDate,
    endDate: hasEndDate ? endDate : null,
    remindAtTimeOfDay: hasReminder && remindAt ? remindAt : null,
  };
  try {
    await save(rule);
    await saveAbsoluteReminder(null); // recurrence 提醒與絕對提醒互斥
  } catch {
    /* 同現狀：debounce 內錯誤先吞 */
  }
}
```

7. reminder 區塊 UI（行 290-318）整段換成 —— toggle 永遠可用，分兩型：

```tsx
<div className="space-y-3 border-t border-border pt-4">
  <label className="flex items-center justify-between gap-3 text-sm font-medium text-foreground">
    {t("schedule.reminder.enabled")}
    <input
      type="checkbox"
      role="switch"
      checked={hasReminder}
      onChange={(e) => {
        setHasReminder(e.target.checked);
        if (!e.target.checked) setRemindAt("");
      }}
      aria-label={t("schedule.reminder.enabled")}
    />
  </label>

  {hasReminder && preset !== null && (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-foreground">{t("schedule.reminder.label")}</span>
      <input
        type="time"
        value={remindAt || "09:00"}
        onChange={(e) => setRemindAt(e.target.value)}
        className="rounded-md border border-border bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        aria-label={t("schedule.reminder.label")}
      />
    </div>
  )}

  {hasReminder && preset === null && (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-foreground">{t("schedule.reminder.dateTime")}</span>
      <div className="flex gap-2">
        <input
          type="date"
          value={absDate}
          onChange={(e) => setAbsDate(e.target.value)}
          className="rounded-md border border-border bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          aria-label={t("schedule.reminder.dateTime")}
        />
        <input
          type="time"
          value={absTime}
          onChange={(e) => setAbsTime(e.target.value)}
          className="rounded-md border border-border bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          aria-label={t("schedule.reminder.dateTime")}
        />
      </div>
    </div>
  )}
</div>
```

注意細節：toggle 開啟且 `preset !== null` 但 `remindAt` 為空時，把 `remindAt` 預設成 `"09:00"`（在 onChange toggle 裡 `if (e.target.checked && preset !== null && !remindAt) setRemindAt("09:00");`），否則 rule 存進去 remindAtTimeOfDay 是 null、toggle 看起來開了卻沒效果。

- [ ] **Step 7: 全綠 + commit**

Run: `env -u NODE_OPTIONS npm test && env -u NODE_OPTIONS npx next build`

```bash
git add src/lib/reminder-time.ts src/lib/reminder-time.test.ts src/components/task/schedule-section.tsx i18n/canonical src/messages
git commit -m "feat(web/schedule): 一次性任務可設絕對日期+時間提醒，對齊 Mac（後端 remindAt 既有）"
```

---

### Task 7 (B3): 重複選項補 weekdays/yearly + monthly_day 可選日

schema enum、web `occurs()`（`src/lib/recurrence.ts`）、API 都已支援全部 preset —— 純 UI 缺口。Mac 有 1-31 Stepper（`ScheduleSection.swift:128-141`）。

**Files:**
- Modify: `src/components/task/schedule-section.tsx`
- Modify: `i18n/canonical/zh-TW.json`、`en.json`、`ja.json`

- [ ] **Step 1: 確認 recurrence 純邏輯已支援（不改邏輯，只驗證）**

Run: `env -u NODE_OPTIONS npx vitest run src/lib/recurrence.test.ts`
Expected: PASS。若 weekdays/yearly 沒測試 case，補兩個：

```ts
it("weekdays: 週一到週五 occur、週末不 occur", () => {
  const rule = { preset: "weekdays", weekdays: null, monthDay: null, monthNth: null, monthNthWeekday: null, startDate: "2026-06-01", endDate: null };
  expect(occurs(rule as never, "2026-07-01")).toBe(true);  // 週三
  expect(occurs(rule as never, "2026-07-04")).toBe(false); // 週六
});
it("yearly: 每年同月日 occur", () => {
  const rule = { preset: "yearly", weekdays: null, monthDay: null, monthNth: null, monthNthWeekday: null, startDate: "2025-07-02", endDate: null };
  expect(occurs(rule as never, "2026-07-02")).toBe(true);
  expect(occurs(rule as never, "2026-07-03")).toBe(false);
});
```

（實際欄位名以 `recurrence.ts` 的型別為準，照既有測試檔的寫法。）

- [ ] **Step 2: i18n key**

canonical `schedule.preset` 加：

| key | zh-TW | en | ja |
| --- | --- | --- | --- |
| `schedule.preset.weekdays` | 平日 | Weekdays | 平日 |
| `schedule.preset.yearly` | 每年 | Yearly | 毎年 |

sync → 填 en/ja → 再 sync。

- [ ] **Step 3: ScheduleSection 改**

1. `PRESETS`（行 17-24）改：

```ts
const PRESETS: (RecurrencePreset | null)[] = [
  null,
  "daily",
  "weekdays",
  "weekly",
  "biweekly",
  "monthly_day",
  "monthly_nth_weekday",
  "yearly",
];
```

2. `presetToI18nKey`（行 32-51）加 case、改回傳型別：

```ts
function presetToI18nKey(
  p: RecurrencePreset,
): "daily" | "weekdays" | "weekly" | "biweekly" | "monthlyDay" | "monthlyNthWeekday" | "yearly" {
  switch (p) {
    case "daily": return "daily";
    case "weekdays": return "weekdays";
    case "weekly": return "weekly";
    case "biweekly": return "biweekly";
    case "monthly_day": return "monthlyDay";
    case "monthly_nth_weekday": return "monthlyNthWeekday";
    case "yearly": return "yearly";
  }
}
```

3. monthDay state：

```ts
const [monthDay, setMonthDay] = useState<number>(() => new Date().getDate());
```

server 同步 effect 加 `setMonthDay(data.monthDay ?? new Date(data.startDate + "T00:00").getDate());`；debounce deps 加 `monthDay`。

4. `doSave()` 的 `monthDay` 改用 state：`monthDay: preset === "monthly_day" ? monthDay : null,`（Task 6 已改過此函式，這裡把衍生值換成 state。）
5. 唯讀文字（行 217-223）換成 select：

```tsx
{preset === "monthly_day" && (
  <select
    value={monthDay}
    onChange={(e) => setMonthDay(parseInt(e.target.value, 10))}
    className="rounded-md border border-border bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    aria-label={t("schedule.preset.monthlyDay")}
  >
    {Array.from({ length: 31 }, (_, i) => i + 1).map((n) => (
      <option key={n} value={n}>
        {t("schedule.recurrence.monthDayN", { n })}
      </option>
    ))}
  </select>
)}
```

（`validateWeeklyHasWeekday` 只 gate weekly/biweekly —— weekdays/yearly 不需要新驗證。）

- [ ] **Step 4: 全綠 + commit**

Run: `env -u NODE_OPTIONS npm test && env -u NODE_OPTIONS npx next build`

```bash
git add src/components/task/schedule-section.tsx src/lib/recurrence.test.ts i18n/canonical src/messages
git commit -m "feat(web/schedule): 重複補平日/每年 preset + 每月幾號可選，對齊 Mac"
```

---

### Task 8 (B4): Daily 離線 / 錯誤 banner

Mac 在週列上方有 `OfflineBannerView`（wifi-slash + 上次更新時間、warning 底）與 `ErrorBannerView`（三角驚嘆 + retry 鈕、destructive 底）。web 只在 401 跳轉、其他錯誤靜默。`--warning` token 已存在（`globals.css:126`）。

**Files:**
- Create: `src/components/daily/daily-banners.tsx`
- Create: `src/hooks/use-online.ts`
- Modify: `src/components/daily/daily-view.tsx`
- Modify: `i18n/canonical/zh-TW.json`、`en.json`、`ja.json`

**Interfaces:**
- Produces: `useOnline(): boolean`；`<OfflineBanner lastUpdated={string} />`；`<ErrorBanner onRetry={() => void} />`

- [ ] **Step 1: i18n key**

canonical 新增 top-level `offline` / `error` namespace + `common.retry`（鏡像 xcstrings；ICU 參數用 `{lastUpdated}`）：

| key | zh-TW | en | ja |
| --- | --- | --- | --- |
| `offline.banner` | 離線中。上次更新於 {lastUpdated} | Offline. Last updated at {lastUpdated}. | オフライン。最終更新: {lastUpdated} |
| `error.unknown` | 發生錯誤 | Something went wrong | エラーが発生しました |
| `common.retry` | 重試 | Retry | 再試行 |

sync → 填 en/ja → 再 sync。

- [ ] **Step 2: useOnline hook**

```ts
// src/hooks/use-online.ts
"use client";

import { useEffect, useState } from "react";

/** navigator.onLine + online/offline 事件。SSR 期間回 true 避免 hydration 閃爍。 */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}
```

- [ ] **Step 3: banner 元件**

```tsx
// src/components/daily/daily-banners.tsx
"use client";

import { useTranslations } from "next-intl";
import { WifiOff, AlertTriangle, RotateCw } from "lucide-react";

/** 對齊 Mac OfflineBannerView：warning 底、wifi-slash、上次更新時間。 */
export function OfflineBanner({ lastUpdated }: { lastUpdated: string }) {
  const t = useTranslations("offline");
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-warning/10 text-sm text-foreground">
      <WifiOff className="h-4 w-4 text-warning shrink-0" aria-hidden="true" />
      <span>{t("banner", { lastUpdated })}</span>
    </div>
  );
}

/** 對齊 Mac ErrorBannerView：destructive 底、三角驚嘆、retry 鈕。 */
export function ErrorBanner({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("error");
  const tCommon = useTranslations("common");
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-destructive/10 text-sm text-foreground">
      <AlertTriangle className="h-4 w-4 text-destructive shrink-0" aria-hidden="true" />
      <span className="flex-1">{t("unknown")}</span>
      <button
        type="button"
        onClick={onRetry}
        aria-label={tCommon("retry")}
        title={tCommon("retry")}
        className="flex items-center justify-center h-9 min-w-11 rounded-md text-primary hover:bg-surface-hover transition-colors"
      >
        <RotateCw className="h-4 w-4" />
      </button>
    </div>
  );
}
```

- [ ] **Step 4: daily-view 接線**

`daily-view.tsx`：

1. import：

```ts
import { OfflineBanner, ErrorBanner } from "./daily-banners";
import { useOnline } from "@/hooks/use-online";
```

2. component 內：

```ts
const online = useOnline();
// 最後一次成功載入的時間（offline banner 顯示用）
const lastUpdatedRef = useRef<string>("");
useEffect(() => {
  if (data) {
    const d = new Date();
    lastUpdatedRef.current = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
}, [data]);
```

3. 401 redirect 區塊（行 340-345）之後、loading return 之前加非 401 錯誤不再靜默的旗標：

```ts
const showErrorBanner = !!error && (error as { status?: number }).status !== 401;
```

4. 主內容最上方（date header / 週列之前，跟 Mac 一樣在 strip 上面）render：

```tsx
{!online && <OfflineBanner lastUpdated={lastUpdatedRef.current} />}
{online && showErrorBanner && <ErrorBanner onRetry={() => mutate()} />}
```

（放的位置實作時對一下 daily-view 的 JSX 結構：緊貼主欄容器頂部、在 `DateHeading` 之前。）

- [ ] **Step 5: 全綠 + commit**

Run: `env -u NODE_OPTIONS npm test && env -u NODE_OPTIONS npx next build`

```bash
git add src/components/daily/daily-banners.tsx src/hooks/use-online.ts src/components/daily/daily-view.tsx i18n/canonical src/messages
git commit -m "feat(web/daily): 離線/錯誤 banner + retry，對齊 Mac OfflineBanner/ErrorBanner"
```

---

### Task 9 (B6): 設定頁補「刪除帳號」

Apple 已有（`SettingsView.swift:436-442`，打 `DELETE /api/me`）；web 危險區只有清空白卡片 + 登出。**canonical 已有全部 `settings.deleteAccount.*` key**（含 en/ja，因為 Apple 那次加過）——不用新增 i18n。沿用 web 危險區的 inline confirm 模式。

**Files:**
- Modify: `src/components/settings/settings-content.tsx`（危險區 section，行 252-345）

- [ ] **Step 1: state + handler**

component 內（`confirmLogout` state 附近）加：

```ts
const [confirmDelete, setConfirmDelete] = useState(false);
const [isDeleting, setIsDeleting] = useState(false);
const [deleteError, setDeleteError] = useState(false);

const handleDeleteAccount = async () => {
  setIsDeleting(true);
  setDeleteError(false);
  try {
    const res = await fetch("/api/me", { method: "DELETE" });
    if (!res.ok) throw new Error(`delete failed: ${res.status}`);
    // 帳號已刪 — 登出並回登入頁
    await signOut({ callbackUrl: "/login" });
  } catch {
    setIsDeleting(false);
    setDeleteError(true);
  }
};
```

（`signOut` 已在檔內 import 給 logout 用。）

- [ ] **Step 2: UI 區塊**

危險區「登出」div **之後**加一個結構相同的 div（照抄 logout 的 inline confirm 版式，行 306-343）：

```tsx
{/* 刪除帳號 */}
<div>
  {!confirmDelete ? (
    <div className="flex items-center justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="text-sm text-foreground">{t("deleteAccount.label")}</div>
      </div>
      <button
        type="button"
        onClick={() => setConfirmDelete(true)}
        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-destructive/40 text-destructive hover:bg-destructive/10 transition-colors text-sm font-medium"
      >
        <Trash2 className="h-3.5 w-3.5" />
        {t("deleteAccount.label")}
      </button>
    </div>
  ) : (
    <div className="rounded-md border border-destructive/30 p-3 space-y-2">
      <div className="text-sm font-medium text-foreground">{t("deleteAccount.confirmTitle")}</div>
      <div className="text-xs text-text-dim">{t("deleteAccount.confirmBody")}</div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleDeleteAccount}
          disabled={isDeleting}
          className="rounded-md bg-destructive px-3 py-1 text-sm text-primary-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {isDeleting ? t("deleteAccount.labelLoading") : t("deleteAccount.confirmOk")}
        </button>
        <button
          type="button"
          onClick={() => setConfirmDelete(false)}
          disabled={isDeleting}
          className="rounded-md border border-border px-3 py-1 text-sm text-text-dim hover:text-foreground hover:bg-surface-hover disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          {tCommon("cancel")}
        </button>
      </div>
      {deleteError && (
        <p className="text-xs text-destructive" role="alert">{tCommon("errorSaving")}</p>
      )}
    </div>
  )}
</div>
```

- [ ] **Step 3: 全綠 + commit**

Run: `env -u NODE_OPTIONS npm test && env -u NODE_OPTIONS npx next build`

```bash
git add src/components/settings/settings-content.tsx
git commit -m "feat(web/settings): 危險區補刪除帳號（DELETE /api/me），對齊 Apple"
```

---

## 收尾

- [ ] `env -u NODE_OPTIONS npm run i18n:check` 確認 in sync
- [ ] `env -u NODE_OPTIONS npm run lint`
- [ ] `env -u NODE_OPTIONS npm test` + `env -u NODE_OPTIONS npx next build` 最終全綠

## 瀏覽器實測清單（使用者代跑；**實測過才 merge / PR**）

1. **A1 掉存檔**：Cards 開快速 Modal → 打幾個字 → 立刻（<0.8s）按 Esc 關 → 重開同卡 → 文字還在。全頁 `/cards/[id]` 打字後立刻點側欄離開 → 回來文字還在。
2. **A4**：開 Modal 時背後對應卡片有 selected 高亮，關掉即消失。
4. **A3**：`/calendar` 日檢視 → 週列圓點 = 有「行事曆事件」的日子（不是有任務的日子）；Daily 頁週列圓點仍然是任務。
5. **B7**：點事件 → popover 第一行含日期（如「7月2日 (三) · 09:00 – 10:00」），en locale 顯示「Jul 2 (Wed)」。
6. **B1**：今日任務 `…` 選單 → 封存 → 確認框 → 確認後從列表消失；非今日的日期頁有「移到今天」。右鍵選單同樣有。
7. **B2**：無重複的任務開排程 → 提醒 toggle 開 → 出現日期+時間輸入 → 設定 → 關掉重開還在；改成有重複 → 變 time-of-day 輸入。
8. **B3**：重複下拉有「平日」「每年」；選「每月某日」可挑 1–31。
9. **B4**：DevTools offline → Daily 出現離線 banner（含上次更新時間）；恢復連線消失。（錯誤 banner 可用 DevTools block `/api/daily/*` 觸發。）
10. **B6**：⚠️ 用**測試帳號**測刪除帳號（真的會刪資料）：確認 → 登出回 /login → 該帳號登入應為全新資料。

## Self-review 紀錄

- Spec 覆蓋：A1(T1)、A3(T3)、A4(T2)、B1(T5)、B2(T6)、B3(T7)、B4(T8)、B6(T9)、B7(T4) ✅；**A2 使用者拍板不做**；B5/B8/B9 依拍板出範圍。
- Task 6 與 Task 7 都動 `doSave()`：T6 先改結構、T7 只把 `monthDay` 衍生值換 state —— 順序執行不衝突。
- 型別一致：`DebouncedSaver.schedule/flush/cancel`、`onArchive(assignmentId, taskId)`、`dotDates?: string[]`、`composeRemindAtISO(date, time)` 前後引用一致。

# Web ↔ Mac Parity Implementation Plan（P0–P5）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓 Web（桌機瀏覽器優先）對標 macOS App 的設計與交互；本計畫覆蓋 P0 地基 → P5 收尾全部 phase。

**Architecture:** 依 `docs/web-parity/2026-06-10-web-mac-parity-audit.md` 的 delta 清單分 6 個 phase。P0（登入恢復 + design token/字級系統）與 P1（Calendar build-out）為完整可執行細度；P2–P5 為已鎖定範圍的任務級定義，**各 phase 開工時再展開成 bite-size 步驟**（依賴前面 phase 的視覺回饋，現在寫死細步會不準 —— 使用者已同意此結構）。每個 phase 一條 branch、一個 PR、瀏覽器實測後才 merge。

**Tech Stack:** Next.js（App Router, `src/`）、Tailwind v4（`@theme inline` tokens）、SWR、Radix（既有 `src/components/ui/popover.tsx` 等）、next-intl、vitest（純邏輯）。

**已拍板決策（全計畫適用）：**
1. 恢復 web 登入（revert PR #20）。
2. Calendar：獨立 `/calendar` 路由 + sidebar 入口；URL state `?mode=&date=`（可書籤），預設 mode 記 localStorage。
3. 事件詳情：**popover 錨在事件上**（Radix Popover，點外/Esc 關）。
4. 月格切日檢視：**再點已選日**切到日檢視（同 Mac；雙擊自然也觸發）。
5. 桌機優先；手機瀏覽器不壞即可。
6. 後端 `/api/calendar/events` 已支援 `date+endDate+tz` 任意區間 —— **全計畫零後端改動**。

**通用工作守則：**
- 新 i18n key 一律：改 `i18n/canonical/zh-TW.json` → `npm run i18n:sync` →（en/ja 翻譯列入 `.pending-translations.md`，對話中請使用者翻）→ 再 sync。**不可手改 `src/messages/*.json`**。
- 顏色一律 token（`text-*`/`bg-*` + globals.css 變數）；禁止硬編碼 hex / Tailwind 預設色。
- 每 phase 完成定義：`npx next build` 通過 + **使用者瀏覽器實測**（每 phase 附清單）+ commit/PR。
- 純邏輯（日期計算等）放 `src/lib/`，同層 `*.test.ts`，vitest 紅→綠。

---

## Phase 0 — 地基（branch: `feat/web-parity-p0`）

### Task 0.1: 恢復 web 登入

**Files:**
- Revert commit `266d99a`（`src/app/[locale]/login/page.tsx` + `src/components/landing/sign-in-form.tsx`）

- [ ] **Step 1: 確認 revert 分支已存在**

`revert/restore-web-login` 分支已在本機建立並完成 `git revert --no-edit 266d99a`（2 files, +96/−17）。若不存在：

```bash
git checkout main && git pull --ff-only origin main
git checkout -b revert/restore-web-login
git revert --no-edit 266d99a
```

- [ ] **Step 2: build 驗證**

```bash
npx next build 2>&1 | tail -3
```
Expected: route 表正常輸出、無 error。

- [ ] **Step 3: push + PR + 請使用者瀏覽器驗證**

```bash
git push -u origin revert/restore-web-login
gh pr create --base main --head revert/restore-web-login \
  --title "revert(web): 恢復 web 登入（還原 PR #20）" \
  --body "Web 對標 Mac 計畫啟動，web 回歸正式平台。還原 login 頁 Google 登入與 landing CTA。

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```
使用者實測：`/login` 出現 Google 登入鈕、landing 兩處 CTA 恢復、可成功登入進 `/day`。merge 後更新 memory `project_apple_only_web_disabled`（web 登入已恢復、轉回雙平台）。

### Task 0.2: 互動態 / 語意狀態色 token

**Files:**
- Modify: `src/app/globals.css`（`@theme inline` 區塊 + `:root` + `.dark`）

- [ ] **Step 1: `:root` 加 token**（light 值；`--primary: #a87a45`）

```css
  /* Interaction-state fills（對齊 Mac nudgeHoverFill/SelectedFill/SelectedStroke） */
  --selected-fill: rgb(168 122 69 / 0.14);
  --selected-stroke: rgb(168 122 69 / 0.6);
  /* 語意狀態色 */
  --success: #5a7050;
  --warning: #a87a45;
  --info: #5a6b7c;
```

- [ ] **Step 2: `.dark` 加對應**（dark `--primary: #c89968`）

```css
  --selected-fill: rgb(200 153 104 / 0.14);
  --selected-stroke: rgb(200 153 104 / 0.6);
  --success: #6f8a64;
  --warning: #c89968;
  --info: #7d93a8;
```

- [ ] **Step 3: `@theme inline` 加映射**

```css
  --color-selected-fill: var(--selected-fill);
  --color-selected-stroke: var(--selected-stroke);
  --color-success: var(--success);
  --color-warning: var(--warning);
  --color-info: var(--info);
```

- [ ] **Step 4: 色值對帳（audit §2）**

抽查 web `globals.css` 與 Mac `apple/NudgeKit/Sources/NudgeUI/Resources/Assets.xcassets/nudge.*.colorset/Contents.json` 的 hex 是否一致（至少 background / foreground / primary / textDim / border 的 light+dark 各 5 組）。已知 `nudge.foreground` light `#1C1B18` / dark `#EBE5D4` 與 web 一致；若發現分歧，記入 PR 描述、以 Mac 值為準修 web。

- [ ] **Step 5: build + commit**

```bash
npx next build 2>&1 | tail -3
git add src/app/globals.css
git commit -m "feat(web/tokens): selected-fill/stroke + success/warning/info token（對齊 Mac）"
```

### Task 0.3: 語意字級系統（對齊 Mac `Font+Nudge` 22 角色）

**Files:**
- Modify: `src/app/globals.css`（新增 `@layer utilities` 區塊）

- [ ] **Step 1: 在 globals.css 末端加 utilities**

依 `Font+Nudge.swift` macOS 分支值（pt→px 1:1）。weight: 400=regular, 500=medium, 600=semibold, 700=bold：

```css
/* Nudge semantic type scale — 對齊 apple Font+Nudge.swift macOS 值。
   後續 surface 改版逐步換用；不強制一次全站替換。 */
@layer utilities {
  .text-column-title        { font-size: 15px; font-weight: 600; }
  .text-column-title-acc    { font-size: 12px; font-weight: 500; }
  .text-section-header      { font-size: 14px; font-weight: 600; }
  .text-row-title           { font-size: 13px; font-weight: 400; }
  .text-row-title-em        { font-size: 13px; font-weight: 600; }
  .text-primary-row-title   { font-size: 14px; font-weight: 400; }
  .text-row-body            { font-size: 12px; font-weight: 400; }
  .text-row-meta            { font-size: 12px; font-weight: 500; }
  .text-row-meta-em         { font-size: 12px; font-weight: 600; }
  .text-field               { font-size: 13px; font-weight: 400; }
  .text-chip-label          { font-size: 11px; font-weight: 500; }
  .text-inline-button       { font-size: 13px; font-weight: 600; }
  .text-empty-state         { font-size: 13px; font-weight: 400; }
  .text-column-detail-title { font-size: 17px; font-weight: 600; }
  .text-weekday-label       { font-size: 11px; font-weight: 500; }
  .text-weekday-number      { font-size: 16px; font-weight: 600; }
  .text-date-eyebrow        { font-size: 12px; font-weight: 500; }
  .text-date-title          { font-size: 28px; font-weight: 700; }
  .text-card-title          { font-size: 16px; font-weight: 600; }
}
```
（Mac 的 sectionChevron/errorMeta/fieldIcon 是 icon 尺寸用，web 用既有 icon size class 即可，不建 token。）

- [ ] **Step 2: build + commit**

```bash
npx next build 2>&1 | tail -3
git add src/app/globals.css
git commit -m "feat(web/tokens): 語意字級 utilities（對齊 Mac Font+Nudge 角色）"
```

- [ ] **Step 3: 開 PR（P0 收尾）**

```bash
git push -u origin feat/web-parity-p0
gh pr create --base main --head feat/web-parity-p0 --title "feat(web): parity P0 — token + 語意字級地基" --body "..."
```
使用者實測：純新增 token/utility、無視覺變化 —— 確認全站外觀無 regression 即可。

---

## Phase 1 — Calendar build-out（branch: `feat/web-calendar`）

> 目標畫面 = Mac Calendar tab：`日|週|月` 切換、日/週置中 720px、TimeTree 月格。

### Task 1.1: 日期純邏輯 util（TDD）

**Files:**
- Create: `src/lib/calendar-dates.ts`
- Test: `src/lib/calendar-dates.test.ts`

- [ ] **Step 1: 寫失敗測試**

```ts
import { describe, it, expect } from "vitest";
import { weekRange, monthGrid, isoToday, addDays, addMonths } from "./calendar-dates";

describe("weekRange", () => {
  it("returns Mon..Sun containing the date", () => {
    expect(weekRange("2026-06-10")).toEqual({ start: "2026-06-08", end: "2026-06-14" });
  });
  it("Sunday belongs to the week starting previous Monday", () => {
    expect(weekRange("2026-06-14")).toEqual({ start: "2026-06-08", end: "2026-06-14" });
  });
});

describe("monthGrid", () => {
  it("returns 6 weeks × 7 days starting Monday, covering the month", () => {
    const grid = monthGrid("2026-06-15");
    expect(grid).toHaveLength(6);
    expect(grid[0]).toHaveLength(7);
    expect(grid[0][0]).toBe("2026-06-01"); // 2026-06-01 是週一
    expect(grid[5][6]).toBe("2026-07-12");
  });
  it("pads previous month when month starts mid-week", () => {
    const grid = monthGrid("2026-05-15"); // 2026-05-01 是週五
    expect(grid[0][0]).toBe("2026-04-27");
    expect(grid[0][4]).toBe("2026-05-01");
  });
});

describe("addDays / addMonths", () => {
  it("addDays crosses month boundary", () => {
    expect(addDays("2026-06-30", 1)).toBe("2026-07-01");
  });
  it("addMonths clamps day to month length", () => {
    expect(addMonths("2026-05-31", 1)).toBe("2026-06-30");
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

```bash
npx vitest run src/lib/calendar-dates.test.ts
```
Expected: FAIL（module 不存在）。

- [ ] **Step 3: 實作**

```ts
/** Calendar 純日期邏輯 — 全部走 YYYY-MM-DD 字串 + local Date，避免時區位移。
 *  鏡像 apple CalendarHostView.weekStart / CalendarMonthGrid 的語意（週一起始、6 週網格）。 */

function parse(d: string): Date {
  const [y, m, dd] = d.split("-").map(Number);
  return new Date(y, m - 1, dd);
}
function fmt(x: Date): string {
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

export function isoToday(): string {
  return fmt(new Date());
}

export function addDays(date: string, n: number): string {
  const d = parse(date);
  d.setDate(d.getDate() + n);
  return fmt(d);
}

export function addMonths(date: string, n: number): string {
  const d = parse(date);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return fmt(d);
}

/** 該日所屬週（週一起始）的起迄 */
export function weekRange(date: string): { start: string; end: string } {
  const d = parse(date);
  const offsetToMon = (d.getDay() + 6) % 7; // Sun=6, Mon=0
  const mon = new Date(d);
  mon.setDate(d.getDate() - offsetToMon);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return { start: fmt(mon), end: fmt(sun) };
}

/** 6 週 × 7 天月網格（週一起始），含前後月 padding 日 */
export function monthGrid(anchor: string): string[][] {
  const d = parse(anchor);
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const { start } = weekRange(fmt(first));
  const rows: string[][] = [];
  let cur = start;
  for (let w = 0; w < 6; w++) {
    const row: string[] = [];
    for (let i = 0; i < 7; i++) {
      row.push(cur);
      cur = addDays(cur, 1);
    }
    rows.push(row);
  }
  return rows;
}
```

- [ ] **Step 4: 跑測試確認通過** — `npx vitest run src/lib/calendar-dates.test.ts` → PASS

- [ ] **Step 5: 重構 `use-calendar-events.ts` 改用共用 util**

把 `src/hooks/use-calendar-events.ts:17-29` 的 inline `getWeekRange` 換成 `import { weekRange } from "@/lib/calendar-dates"`（行為相同，刪重複碼）。跑 `npx vitest run` 全綠 + `npx next build` 過。

- [ ] **Step 6: Commit** — `feat(web/calendar): calendar-dates 純邏輯 util + tests`

### Task 1.2: 區間事件 hook

**Files:**
- Create: `src/hooks/use-calendar-range.ts`

- [ ] **Step 1: 實作 hook**（模式照抄 `use-calendar-events.ts` 的 SWR 配置；回傳「依日分組」的 map，月/週檢視 O(1) 取格）

```ts
"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import type { EventsResponse, CalendarEvent } from "@/lib/google-calendar/types";

function getUserTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function localDateOf(e: CalendarEvent): string {
  const d = new Date(e.start);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 抓任意起迄區間的事件（週/月檢視用），並預先依 local 日期分組。 */
export function useCalendarRange(start: string, end: string) {
  const tz = getUserTz();
  const key = `/api/calendar/events?date=${start}&endDate=${end}&tz=${encodeURIComponent(tz)}`;
  const { data, error, isLoading, mutate } = useSWR<EventsResponse>(key, fetcher, {
    revalidateOnMount: true,
    revalidateOnFocus: true,
    dedupingInterval: 5 * 60 * 1000,
    shouldRetryOnError: false,
  });

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    if (data?.connected) {
      for (const e of data.events) {
        const k = localDateOf(e);
        const arr = map.get(k) ?? [];
        arr.push(e);
        map.set(k, arr);
      }
    }
    return map;
  }, [data]);

  return { data, eventsByDate, error, isLoading, refresh: () => mutate() };
}
```

- [ ] **Step 2: build + commit** — `feat(web/calendar): useCalendarRange 區間 hook`

### Task 1.3: i18n keys

**Files:**
- Modify: `i18n/canonical/zh-TW.json`

- [ ] **Step 1: 盤點缺漏**

```bash
python3 -c "
import json
d=json.load(open('i18n/canonical/zh-TW.json'))
need=['nav.calendar','calendar.modeDay','calendar.modeWeek','calendar.modeMonth','calendar.today','calendar.thisWeek','calendar.weekEmpty','calendar.monthEmpty','calendar.eventAllDay','calendar.morning','calendar.afternoon','calendar.evening']
def get(o,p):
    for k in p.split('.'):
        if not isinstance(o,dict) or k not in o: return None
        o=o[k]
    return o
[print(('OK ' if get(d,k) else 'MISSING '),k) for k in need]"
```

- [ ] **Step 2: 補 MISSING 的 key 進 canonical**（中文值：日曆 / 日 / 週 / 月 / 今天 / 本週 / 本週沒有行程 / 本月沒有行程 / 全天 / 上午 / 下午 / 晚上）→ `npm run i18n:sync` → en/ja 翻譯在對話中補 → 再 `npm run i18n:sync`。

- [ ] **Step 3: Commit** — `feat(i18n): web calendar keys`

### Task 1.4: `/calendar` 路由 + sidebar 入口 + Host（mode/URL state）

**Files:**
- Create: `src/app/[locale]/(app)/calendar/page.tsx`
- Create: `src/components/calendar/calendar-host.tsx`
- Modify: `src/components/sidebar/app-sidebar.tsx:16-40`（navItems）

- [ ] **Step 1: page（server component，模式照 `(app)/cards/page.tsx` 的 auth/locale 慣例）**

```tsx
import { CalendarHost } from "@/components/calendar/calendar-host";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; date?: string }>;
}) {
  const { mode, date } = await searchParams;
  return <CalendarHost initialMode={mode} initialDate={date} />;
}
```

- [ ] **Step 2: CalendarHost（client）**

職責：mode/date 狀態（URL 為準、localStorage 記預設 mode）、`日|週|月` segmented、依 mode 算 range、render 對應 view。骨架：

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, usePathname } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { isoToday, weekRange, monthGrid } from "@/lib/calendar-dates";
import { useCalendarRange } from "@/hooks/use-calendar-range";
import { CalendarDayView } from "./day-view";
import { CalendarWeekView } from "./week-view";
import { CalendarMonthView } from "./month-view";
import { CalendarEmptyState } from "./calendar-empty-state";

type Mode = "day" | "week" | "month";
const MODE_KEY = "calendar.web.mode";

export function CalendarHost({ initialMode, initialDate }: { initialMode?: string; initialDate?: string }) {
  const t = useTranslations("calendar");
  const router = useRouter();
  const pathname = usePathname();

  const [mode, setMode] = useState<Mode>(() =>
    ["day", "week", "month"].includes(initialMode ?? "")
      ? (initialMode as Mode)
      : ((typeof window !== "undefined" && (localStorage.getItem(MODE_KEY) as Mode)) || "day")
  );
  const [date, setDate] = useState<string>(initialDate ?? isoToday());

  // URL 同步（可書籤）；replace 不疊 history
  useEffect(() => {
    router.replace(`${pathname}?mode=${mode}&date=${date}`, { scroll: false });
    try { localStorage.setItem(MODE_KEY, mode); } catch {}
  }, [mode, date, pathname, router]);

  // range：day 抓整週（週 strip 圓點）、week 抓週、month 抓 6 週網格界
  const range = (() => {
    if (mode === "month") {
      const grid = monthGrid(date);
      return { start: grid[0][0], end: grid[5][6] };
    }
    return weekRange(date);
  })();
  const { data, eventsByDate, isLoading, refresh } = useCalendarRange(range.start, range.end);

  const openDay = useCallback((d: string) => { setDate(d); setMode("day"); }, []);

  if (data && !data.connected) {
    return <CalendarEmptyState variant={data.reason === "reauth_required" ? "reauth" : "not_connected"} />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* 模式 segmented — 對齊 Mac 日|週|月 palette */}
      <div className="flex justify-center pt-4">
        <div className="inline-flex rounded-lg border border-border p-1 gap-1">
          {(["day", "week", "month"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={`px-4 py-1.5 rounded-md text-inline-button transition-colors ${
                mode === m ? "bg-primary text-primary-foreground" : "text-text-dim hover:text-foreground"
              }`}
            >
              {t(m === "day" ? "modeDay" : m === "week" ? "modeWeek" : "modeMonth")}
            </button>
          ))}
        </div>
      </div>

      {mode === "day" && (
        <div className="mx-auto max-w-[720px] px-4">
          <CalendarDayView date={date} onDateChange={setDate} eventsByDate={eventsByDate} isLoading={isLoading} />
        </div>
      )}
      {mode === "week" && (
        <div className="mx-auto max-w-[720px] px-4">
          <CalendarWeekView date={date} onDateChange={setDate} eventsByDate={eventsByDate} isLoading={isLoading} />
        </div>
      )}
      {mode === "month" && (
        <CalendarMonthView date={date} onSelectDate={setDate} onOpenDay={openDay} eventsByDate={eventsByDate} isLoading={isLoading} />
      )}
    </div>
  );
}
```
（`CalendarEmptyState` 既有元件 props 以實際檔案為準，接的時候核對 `calendar-empty-state.tsx`。）

- [ ] **Step 3: sidebar 加 Calendar 入口**

`app-sidebar.tsx`：import `CalendarDays`（lucide），navItems 在 tasks 之後插入：

```ts
  {
    href: "/calendar",
    match: "/calendar",
    icon: CalendarDays,
    labelKey: "calendar",
  },
```
並把 `labelKey` 型別 union 擴成 `"tasks" | "calendar" | "notes" | "cards"`。

- [ ] **Step 4: 暫時 stub 三個 view**（讓 build 過、路由可走）：`day-view.tsx` / `week-view.tsx` / `month-view.tsx` 先 export 接 props 的 placeholder（之後 task 實作替換）。

- [ ] **Step 5: build + commit** — `feat(web/calendar): /calendar 路由 + host + sidebar 入口`

### Task 1.5: 日檢視

**Files:**
- Create: `src/components/calendar/day-view.tsx`（取代 stub）
- Reuse: `calendar-nav.tsx`（週 strip）、`calendar-event-item.tsx`（事件卡）

行為（= Mac CalendarDayView）：
- 頂部週 strip：複用 `CalendarNav`（prev/next 週、今天、7 日鈕）。**圓點資料源改吃 calendar events**：把 `eventsByDate` 的 keys 當 `datesWithTasks` 傳入（核對 `calendar-nav.tsx` 的 prop 名後直接餵）。
- 事件依開始時間分三段：上午（<12）/ 下午（12–17）/ 晚上（≥18），全天事件置頂獨立段。段標題用 `.text-section-header` + `text-text-dim`，i18n `calendar.morning/afternoon/evening`。
- 每段內 render `CalendarEventItem`（既有元件，含展開細節）。
- 空日：置中 `calendar.panelEmpty`（既有 key）。Loading：置中 spinner（照 `cards-feed` 既有 pattern）。
- Commit：`feat(web/calendar): 日檢視（週 strip + 分段事件）`

### Task 1.6: 週檢視

**Files:**
- Create: `src/components/calendar/week-view.tsx`（取代 stub）

行為（= Mac CalendarWeekView agenda 式）：
- Header：`‹` `M/d – M/d`（`.text-column-detail-title`）`本週` `›`；prev/next = `onDateChange(addDays(date, ±7))`，本週 = `onDateChange(isoToday())`。
- 主體：`weekRange(date)` 7 天縱向分組。每天：標籤（`EEEE M/d`，date-fns locale-aware）—— 有事件 `.text-section-header text-foreground`、空日 `text-text-dim` 且只佔一行不留 placeholder。
- 事件 row：`[HH:MM（monospaced, w-14） | 標題]`，卡片 `rounded-xl bg-foreground/[0.04]`，過去事件 `text-text-dim bg-foreground/[0.02]`（過去判定：`new Date(e.end) < now`）。
- 整週無事件：置中 `calendar.weekEmpty`。
- Commit：`feat(web/calendar): 週檢視（agenda 式）`

### Task 1.7: 月檢視（TimeTree 式）+ 事件 popover

**Files:**
- Create: `src/components/calendar/month-view.tsx`（取代 stub）
- Create: `src/components/calendar/event-popover.tsx`
- Reuse: `src/components/ui/popover.tsx`（Radix）

月格行為（= Mac CalendarMonthView）：
- Header：`‹` `yyyy 年 M 月`（`.text-column-detail-title`）`今天` `›`；prev/next = `addMonths(date, ±1)`。
- 星期列：一～日，`.text-weekday-label text-text-dim`。
- 6×7 grid：`grid grid-cols-7 auto-rows-fr` 外層 `h-[calc(100dvh-<header高>)]` 等高撐滿（實作時量 header 實高）。
- 格内：日數字置中於 24px 圓（今天 = `bg-primary text-primary-foreground` 實心；選中非今天 = `ring-2 ring-foreground`）；pad 日 `text-text-dim`。
- 事件 bar：最多 **3** 條，`.text-chip-label text-primary-foreground bg-primary rounded px-1 truncate`，過去事件 `bg-primary/30 text-text-dim`；溢出 `+N`（`text-text-dim`）。
- 互動：點格空白 → `onSelectDate(iso)`（選中底 `bg-selected-fill`）；**點已選日 → `onOpenDay(iso)`**（切日檢視）；點事件 bar → 開 popover（`stopPropagation`，不觸發選日）。
- 手機降級（不壞即可）：`sm` 以下事件 bar 改成 1 條 + `+N`，格高 `minmax(64px, 1fr)`。

事件 popover（`event-popover.tsx`）：
- Radix Popover 錨在被點的 bar/卡上；內容 = 時間（monospaced）+ 標題（`.text-card-title`）+ Join Meeting 鈕（有 `hangoutLink` 時，`bg-primary` pill）+ 地點/日曆名/描述/出席者 + Google Calendar 連結。內容結構照 `calendar-event-item.tsx` 展開區搬。
- 寬 `w-[380px] max-w-[90vw]`；點外/Esc 關（Radix 內建）。
- 日/週檢視的事件點擊也接同一個 popover（`CalendarEventItem` 既有展開行為保留 —— 月格才用 popover；若實測覺得不一致，再統一，留待實測決定）。
- Commit：`feat(web/calendar): TimeTree 月檢視 + 事件 popover`

### Task 1.8: P1 收尾驗證

- [ ] `npx next build` + `npx vitest run` 全綠
- [ ] `npm run lint`（僅確認無新增 error；既有 83 errors 是歷史債不擋）
- [ ] PR `feat/web-calendar`，附使用者實測清單：
  - sidebar 出現日曆入口 → `/calendar` 開啟、預設日檢視
  - `日|週|月` 點擊直接切換；重新整理保留（URL）；新分頁貼 URL 還原同視圖
  - 日：週 strip 圓點對、事件分上午/下午/晚上、prev/next 週
  - 週：區間 header、空日淡化、過去事件淡化
  - 月：等高格撐滿、每格 ≤3 bar + `+N`、今天實心圓、點格選日、再點切日檢視、點 bar 開 popover（點外/Esc 關）
  - 未連線 Google → connect CTA；手機寬度不破版

---

## Phase 2 — Daily 對齊（branch: `feat/web-daily-parity`）

> **開工時展開 bite-size**（依 P0 token + P1 結果微調）。範圍已鎖定如下。

| # | 任務 | 檔案 | 行為定義 | 工數 |
|---|---|---|---|---|
| 2.1 | 兩行日期 header | `src/components/calendar/date-heading.tsx` | weekday eyebrow（`.text-date-eyebrow text-text-dim`）上、大日期（`.text-date-title`）下；對齊 Mac dashboardDateHeader | S |
| 2.2 | 右側面板升級 | `src/components/daily/daily-view.tsx` + 新 `daily-right-panel.tsx` | 固定 300px Calendar → 可開關（header 鈕，狀態 localStorage `daily.web.rightPanelOpen`）+ Calendar/Cards 切換（`daily.web.rightPanelKind`）+ 拖拉寬 280–720（新 `resize-handle.tsx`，寬度 localStorage） | L |
| 2.3 | Cards 面板 | 新 `daily-cards-panel.tsx` | 近期卡 grid（reuse `card-grid-item`）+ 放大鏡 toggle 展開搜尋（300ms debounce、tag chips AND 篩選；邏輯照 Mac dashboardCardSearch / web cards-feed 既有 fetch） | M |
| 2.4 | Row 整理 | `src/components/task/task-card.tsx` | Repeat/Bell badge 移出 row（留 detail）；move-to-date 升為獨立 calendar icon；`…` 留次要動作 | S |
| 2.5 | 已完成分組 | `daily-view.tsx` | 「已完成 (N)」可收合 header（chevron；預設展開；i18n key 跟 Mac `daily.completedHeader` 對齊，沒有就走 canonical 流程加） | S |
| 2.6 | 空態/細節 | `daily-view.tsx`, `task-card.tsx` | 空態加 sparkles icon；完成任務標題刪除線 | S |
| 2.7 | Task detail 改置中卡 popover | `task-detail-modal.tsx` | 全螢幕 modal → Heptabase 式置中卡（max-w-[500px]、backdrop blur、點外關）；內容不變 | M |

保留不動：inline 改標題、dnd-kit 拖序、quick-add inline form、SWR、Radix context menu。
實測清單於展開時隨任務生成。

## Phase 3 — Cards 細節（branch: `feat/web-cards-parity`）

| # | 任務 | 檔案 | 行為定義 | 工數 |
|---|---|---|---|---|
| 3.1 | 搜尋列釘頂 | `cards-feed.tsx` | search field + tag chips 移到內容欄頂端常駐（list/grid 切換鈕同列右側）；filtering 中不顯示分頁 footer | M |
| 3.2 | 空態版位 | `cards-feed.tsx` | 查無結果：搜尋列固定頂、放大鏡+「沒有符合的卡片」置中剩餘空間（= Mac macContentBody 行為） | S |
| 3.3 | Row 降噪 | `card-list-item.tsx`, `card-grid-item.tsx` | rows 拿掉 tag badges；grid 預覽 120→240 字；Untitled 斜體 `text-text-dim` | S |
| 3.4 | Grid 選中態 | `cards-feed.tsx`, `card-grid-item.tsx` | 記 `selectedCardId`（最近開啟）；對應卡 `bg-selected-fill ring-1 ring-selected-stroke` | M |
| 3.5 | Detail header | `card-detail.tsx` | 返回鍵 ArrowLeft → ChevronLeft `text-primary`、與標題同列、移除 header 下分隔線 | S |

保留不動：route 式 detail、list/grid 切換、clean-untitled、inline tag picker、inline 改標題。

## Phase 4 — Notes split pane（branch: `feat/web-notes-parity`）

| # | 任務 | 檔案 | 行為定義 | 工數 |
|---|---|---|---|---|
| 4.1 | 桌機 split pane | `src/app/[locale]/(app)/notes/*` + 新 `notes-split.tsx` | md+ 左 feed（max-w-[720px] 置中）+ 右 canvas（360–900 拖寬、localStorage `notes.web.detailWidth`，reuse P2 的 resize-handle）；md 以下維持現有 route toggle | L |
| 4.2 | Feed 預覽純文字 | `note-entry.tsx` | HTML 直渲 → strip 後 ~220 字純文字；row min-h-[88px] 標準化 | S |
| 4.3 | 今天 placeholder row | feed 元件 | 今日無 entry 時頂部假 row（`notes.todayPlaceholder` 走 canonical 流程）；點了右側開今天 canvas；存檔後變真 row | M |
| 4.4 | 存檔 refetch | canvas 編輯器 + feed | canvas debounce 存檔成功 → mutate feed SWR key | S |

## Phase 5 — Shell / Settings 收尾（branch: `feat/web-shell-parity`）

| # | 任務 | 檔案 | 行為定義 | 工數 |
|---|---|---|---|---|
| 5.1 | Sidebar 標籤化 | `app-sidebar.tsx` | 桌機 icon+文字側欄（寬 ~200px，窄窗 <1000px 自動收回純 icon —— 對齊 Mac 收合概念）；手機底欄不動 | M |
| 5.2 | `/settings` 路由 | 新 `(app)/settings/page.tsx` | 現有 settings-modal 內容抽成 sections 共用，page 版置中 max-w-[720px]；modal 保留 | M |
| 5.3 | Danger Zone | settings sections | 登出 + Clean Untitled Cards（呼叫 `/api/cards/untitled` DELETE，同 Mac）合併段落、紅字框 | S |
| 5.4 | Tags 細節 | `tag-manager.tsx`, `tag-picker.tsx` | 拖把手獨立手勢區、刪除加確認 dialog、新增列 plus icon、picker 搜尋框 icon + clear 鈕 | S |

保留不動：theme/語言按鈕組、紙紋理、tag badge 尺寸、頭像帳號卡。

---

## 全計畫驗證方式

- 每 phase：`npx next build` + `npx vitest run` + `npm run lint`（不新增 error）→ PR → **使用者瀏覽器逐項實測**（互動完成定義依 AGENTS.md；AI 無法操作瀏覽器，實測清單列在各 phase PR）→ merge。
- i18n：每次加 key 後 `npm run i18n:check` 過。
- 跨 phase 回歸：P2 動 daily 時回測 P1 calendar 連動（週 strip 日期同步）；P5 sidebar 改版時回測所有路由 active 態。

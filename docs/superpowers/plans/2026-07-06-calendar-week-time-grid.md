# 行事曆週檢視 Time Grid 改版（Web + Mac）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `/calendar` 週檢視從 agenda 列表改成 Google Calendar 式時間軸網格（Web + macOS），並把 Web 與 macOS 的預設行事曆檢視改為週檢視。

**Architecture:** 重疊避讓是一支純函式（分鐘區間 → 欄位配置），TS 與 Swift 各一份鏡像實作、共用同一組測試案例（比照 `recurrence.ts` ↔ `RecurrenceCalculator.swift` 模式）。Web 重寫 `week-view.tsx` 為絕對定位網格；Mac 新增 `CalendarWeekGridView.swift`（macOS 專用），iOS 維持現有 `CalendarWeekView` agenda 列表。資料源、後端、schema 全部不動。

**Tech Stack:** Next.js + Tailwind（design tokens）、vitest；SwiftUI、XCTest。

**Spec:** `docs/superpowers/specs/2026-07-06-calendar-week-time-grid-design.md`（含已驗收 mockup 連結）。

## Global Constraints

- 顏色只准用 design token：Web 用 `bg-*`/`text-*`/`border-*` + token 名（`primary`、`border`、`border-light`、`text-dim`、`text-faint`、`surface-hover`…），Swift 只准 `Color.nudgeXxx`。禁止硬編碼 hex / Tailwind 預設色 / `Color.blue` 等。
- i18n：Web 字串走 `useTranslations("calendar")` 既有 key；Swift 用 `Text("key", bundle: .module)`。本計畫**不新增 key**（全天 = 既有 `calendar.eventAllDay`；時間刻度 `HH:MM` 無需 key）。
- iOS 行為不得改變：週檢視仍是 agenda 列表、預設檢視仍是 `.day`。
- 唯讀：不做建立/拖拉事件、不做現在時刻紅線。
- 網格內容只有 Google Calendar 事件（無 Nudge 任務）。
- 每小時高度 48（web px / mac pt）；短事件（≤30 分鐘）單行緊湊排版；過去事件淡化；初始捲動 = 今天首個非全天事件前一小時、無事件則 08:00。
- 互動改動 build 過 ≠ 完成：等使用者實測完才算 done（不要搶 commit 最終驗收；中途各 task 的單元測試 commit 照常）。

---

### Task 1: TS 重疊避讓純函式 `layoutDayEvents`

**Files:**
- Create: `src/lib/calendar-layout.ts`
- Test: `src/lib/calendar-layout.test.ts`

**Interfaces:**
- Consumes: 無（純函式，零依賴）
- Produces: `layoutDayEvents(intervals: EventInterval[]): EventPlacement[]`，其中 `EventInterval = { startMin: number; endMin: number }`（當日 00:00 起算分鐘數）、`EventPlacement = { column: number; columnCount: number }`。**回傳陣列與輸入同序同長**。Task 3（Web view）靠這個簽名；Task 2（Swift）鏡像同一組測試案例。

- [ ] **Step 1: 寫失敗測試**

```ts
// src/lib/calendar-layout.test.ts
import { describe, expect, it } from "vitest";
import { layoutDayEvents, type EventInterval } from "./calendar-layout";

/** 這組案例與 apple CalendarWeekLayoutTests.swift 鏡像 — 改一邊，兩邊都要改。 */
const iv = (startMin: number, endMin: number): EventInterval => ({ startMin, endMin });

describe("layoutDayEvents", () => {
  it("不重疊：各自獨占一欄（含首尾相接）", () => {
    // 9:00-10:00, 10:00-11:00 — 相接不算重疊
    const r = layoutDayEvents([iv(540, 600), iv(600, 660)]);
    expect(r).toEqual([
      { column: 0, columnCount: 1 },
      { column: 0, columnCount: 1 },
    ]);
  });

  it("二重疊：左右分欄、columnCount 都是 2", () => {
    // 9:00-10:30 vs 10:00-11:00
    const r = layoutDayEvents([iv(540, 630), iv(600, 660)]);
    expect(r).toEqual([
      { column: 0, columnCount: 2 },
      { column: 1, columnCount: 2 },
    ]);
  });

  it("三連鎖：A-B 重疊、B-C 重疊、A-C 不重疊 → 同叢集兩欄，C 回收 A 的欄", () => {
    // A 9-11, B 10-12, C 11-13
    const r = layoutDayEvents([iv(540, 660), iv(600, 720), iv(660, 780)]);
    expect(r).toEqual([
      { column: 0, columnCount: 2 },
      { column: 1, columnCount: 2 },
      { column: 0, columnCount: 2 },
    ]);
  });

  it("包含關係：長事件 col 0、被包含的短事件 col 1", () => {
    // A 9-13 包含 B 10-11
    const r = layoutDayEvents([iv(540, 780), iv(600, 660)]);
    expect(r).toEqual([
      { column: 0, columnCount: 2 },
      { column: 1, columnCount: 2 },
    ]);
  });

  it("零長度事件視為至少 1 分鐘、佔得住一欄", () => {
    // A 10:00-10:00（零長度）與 B 10:00-10:30 重疊；同 start 時長者優先 → B col 0
    const r = layoutDayEvents([iv(600, 600), iv(600, 630)]);
    expect(r).toEqual([
      { column: 1, columnCount: 2 },
      { column: 0, columnCount: 2 },
    ]);
  });

  it("跨叢集互不影響：前叢集兩欄，不影響後面獨立事件的 columnCount", () => {
    // 9-10 與 9:30-10 重疊；13-14 獨立
    const r = layoutDayEvents([iv(540, 600), iv(570, 600), iv(780, 840)]);
    expect(r).toEqual([
      { column: 0, columnCount: 2 },
      { column: 1, columnCount: 2 },
      { column: 0, columnCount: 1 },
    ]);
  });

  it("空輸入回空陣列", () => {
    expect(layoutDayEvents([])).toEqual([]);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/lib/calendar-layout.test.ts`
Expected: FAIL（`Cannot find module './calendar-layout'`）

- [ ] **Step 3: 最小實作**

```ts
// src/lib/calendar-layout.ts
/** 週檢視 time grid 重疊避讓 — 純函式，鏡像 apple
 *  NudgeUI/Calendar/CalendarWeekLayout.swift。改一邊，兩邊測試都要過。
 *
 *  演算法：
 *  1. 依 startMin 升冪排序（同 start 時長者優先）。
 *  2. 掃描切「重疊叢集」：下一事件 start >= 叢集最大 end 時封叢集。
 *  3. 叢集內貪婪分欄：放進第一個 columnEnd <= start 的欄，否則開新欄。
 *  4. 叢集內所有事件 columnCount = 叢集欄數。
 */

export interface EventInterval {
  /** 從當日 00:00 起算的分鐘數 */
  startMin: number;
  endMin: number;
}

export interface EventPlacement {
  column: number;
  columnCount: number;
}

/** 回傳與輸入同序的欄位配置。 */
export function layoutDayEvents(intervals: EventInterval[]): EventPlacement[] {
  const order = intervals
    .map((_, i) => i)
    .sort((a, b) => {
      return (
        intervals[a].startMin - intervals[b].startMin ||
        intervals[b].endMin - intervals[a].endMin
      );
    });
  const placements: EventPlacement[] = intervals.map(() => ({
    column: 0,
    columnCount: 1,
  }));

  // 零長度事件 layout 上視為至少 1 分鐘，才佔得住一欄
  const endOf = (i: number) =>
    Math.max(intervals[i].endMin, intervals[i].startMin + 1);

  let cluster: number[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    if (cluster.length === 0) return;
    const colEnds: number[] = [];
    const cols: number[] = [];
    for (const i of cluster) {
      let col = colEnds.findIndex((end) => end <= intervals[i].startMin);
      if (col === -1) {
        col = colEnds.length;
        colEnds.push(0);
      }
      colEnds[col] = endOf(i);
      cols.push(col);
    }
    cluster.forEach((i, k) => {
      placements[i] = { column: cols[k], columnCount: colEnds.length };
    });
    cluster = [];
    clusterEnd = -Infinity;
  };

  for (const i of order) {
    if (cluster.length > 0 && intervals[i].startMin >= clusterEnd) flush();
    cluster.push(i);
    clusterEnd = Math.max(clusterEnd, endOf(i));
  }
  flush();
  return placements;
}
```

- [ ] **Step 4: 跑測試確認全綠**

Run: `npx vitest run src/lib/calendar-layout.test.ts`
Expected: 7 passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/calendar-layout.ts src/lib/calendar-layout.test.ts
git commit -m "feat(calendar): 週檢視重疊避讓純函式 layoutDayEvents（TS 側）"
```

---

### Task 2: Swift 鏡像 `CalendarWeekLayout`

**Files:**
- Create: `apple/NudgeKit/Sources/NudgeUI/Calendar/CalendarWeekLayout.swift`
- Test: `apple/NudgeKit/Tests/NudgeCoreTests/CalendarWeekLayoutTests.swift`（test target 已依賴 NudgeUI，可直接 `@testable import NudgeUI`）

**Interfaces:**
- Consumes: 無（純函式）
- Produces: `CalendarWeekLayout.layoutDayEvents(_ intervals: [CalendarWeekLayout.Interval]) -> [CalendarWeekLayout.Placement]`；`Interval(startMin: Double, endMin: Double)`、`Placement(column: Int, columnCount: Int)`，回傳與輸入同序。Task 5（Mac view）使用。

- [ ] **Step 1: 寫失敗測試（案例與 Task 1 完全鏡像，含註解）**

```swift
// apple/NudgeKit/Tests/NudgeCoreTests/CalendarWeekLayoutTests.swift
import XCTest
@testable import NudgeUI

/// 這組案例與 web src/lib/calendar-layout.test.ts 鏡像 — 改一邊，兩邊都要改。
final class CalendarWeekLayoutTests: XCTestCase {
    private func iv(_ startMin: Double, _ endMin: Double) -> CalendarWeekLayout.Interval {
        CalendarWeekLayout.Interval(startMin: startMin, endMin: endMin)
    }
    private func pl(_ column: Int, _ columnCount: Int) -> CalendarWeekLayout.Placement {
        CalendarWeekLayout.Placement(column: column, columnCount: columnCount)
    }

    func test_noOverlap_backToBack() {
        // 9:00-10:00, 10:00-11:00 — 相接不算重疊
        let r = CalendarWeekLayout.layoutDayEvents([iv(540, 600), iv(600, 660)])
        XCTAssertEqual(r, [pl(0, 1), pl(0, 1)])
    }

    func test_twoOverlapping_splitColumns() {
        // 9:00-10:30 vs 10:00-11:00
        let r = CalendarWeekLayout.layoutDayEvents([iv(540, 630), iv(600, 660)])
        XCTAssertEqual(r, [pl(0, 2), pl(1, 2)])
    }

    func test_chainOfThree_reusesColumn() {
        // A 9-11, B 10-12, C 11-13 — C 回收 A 的欄
        let r = CalendarWeekLayout.layoutDayEvents([iv(540, 660), iv(600, 720), iv(660, 780)])
        XCTAssertEqual(r, [pl(0, 2), pl(1, 2), pl(0, 2)])
    }

    func test_containment() {
        // A 9-13 包含 B 10-11
        let r = CalendarWeekLayout.layoutDayEvents([iv(540, 780), iv(600, 660)])
        XCTAssertEqual(r, [pl(0, 2), pl(1, 2)])
    }

    func test_zeroLength_occupiesColumn() {
        // A 10:00-10:00（零長度）與 B 10:00-10:30 重疊；同 start 時長者優先 → B col 0
        let r = CalendarWeekLayout.layoutDayEvents([iv(600, 600), iv(600, 630)])
        XCTAssertEqual(r, [pl(1, 2), pl(0, 2)])
    }

    func test_clustersIndependent() {
        // 9-10 與 9:30-10 重疊；13-14 獨立
        let r = CalendarWeekLayout.layoutDayEvents([iv(540, 600), iv(570, 600), iv(780, 840)])
        XCTAssertEqual(r, [pl(0, 2), pl(1, 2), pl(0, 1)])
    }

    func test_emptyInput() {
        XCTAssertEqual(CalendarWeekLayout.layoutDayEvents([]), [])
    }
}
```

- [ ] **Step 2: 跑測試確認編譯失敗**

Run: `cd apple/NudgeKit && swift test --filter CalendarWeekLayoutTests`
Expected: FAIL（`cannot find 'CalendarWeekLayout' in scope`）

- [ ] **Step 3: 最小實作**

```swift
// apple/NudgeKit/Sources/NudgeUI/Calendar/CalendarWeekLayout.swift
import Foundation

/// 週檢視 time grid 重疊避讓 — 純函式，鏡像 web src/lib/calendar-layout.ts。
/// 改一邊，兩邊測試都要過。
///
/// 演算法：
/// 1. 依 startMin 升冪排序（同 start 時長者優先）。
/// 2. 掃描切「重疊叢集」：下一事件 start >= 叢集最大 end 時封叢集。
/// 3. 叢集內貪婪分欄：放進第一個 columnEnd <= start 的欄，否則開新欄。
/// 4. 叢集內所有事件 columnCount = 叢集欄數。
public enum CalendarWeekLayout {
    public struct Interval: Equatable, Sendable {
        /// 從當日 00:00 起算的分鐘數
        public let startMin: Double
        public let endMin: Double
        public init(startMin: Double, endMin: Double) {
            self.startMin = startMin
            self.endMin = endMin
        }
    }

    public struct Placement: Equatable, Sendable {
        public let column: Int
        public let columnCount: Int
        public init(column: Int, columnCount: Int) {
            self.column = column
            self.columnCount = columnCount
        }
    }

    /// 回傳與輸入同序的欄位配置。
    public static func layoutDayEvents(_ intervals: [Interval]) -> [Placement] {
        let order = intervals.indices.sorted { a, b in
            if intervals[a].startMin != intervals[b].startMin {
                return intervals[a].startMin < intervals[b].startMin
            }
            return intervals[a].endMin > intervals[b].endMin
        }
        var placements = [Placement](
            repeating: Placement(column: 0, columnCount: 1),
            count: intervals.count
        )

        // 零長度事件 layout 上視為至少 1 分鐘，才佔得住一欄
        func endOf(_ i: Int) -> Double {
            max(intervals[i].endMin, intervals[i].startMin + 1)
        }

        var cluster: [Int] = []
        var clusterEnd = -Double.infinity

        func flush() {
            guard !cluster.isEmpty else { return }
            var colEnds: [Double] = []
            var cols: [Int] = []
            for i in cluster {
                if let col = colEnds.firstIndex(where: { $0 <= intervals[i].startMin }) {
                    colEnds[col] = endOf(i)
                    cols.append(col)
                } else {
                    colEnds.append(endOf(i))
                    cols.append(colEnds.count - 1)
                }
            }
            for (k, i) in cluster.enumerated() {
                placements[i] = Placement(column: cols[k], columnCount: colEnds.count)
            }
            cluster = []
            clusterEnd = -Double.infinity
        }

        for i in order {
            if !cluster.isEmpty && intervals[i].startMin >= clusterEnd { flush() }
            cluster.append(i)
            clusterEnd = max(clusterEnd, endOf(i))
        }
        flush()
        return placements
    }
}
```

- [ ] **Step 4: 跑測試確認全綠**

Run: `cd apple/NudgeKit && swift test --filter CalendarWeekLayoutTests`
Expected: 7 tests passed

- [ ] **Step 5: Commit**

```bash
git add apple/NudgeKit/Sources/NudgeUI/Calendar/CalendarWeekLayout.swift apple/NudgeKit/Tests/NudgeCoreTests/CalendarWeekLayoutTests.swift
git commit -m "feat(calendar): 週檢視重疊避讓 CalendarWeekLayout（Swift 鏡像 + 同組測試）"
```

---

### Task 3: Web 週檢視重寫為 time grid

**Files:**
- Modify: `src/components/calendar/week-view.tsx`（整檔重寫）
- Modify: `src/components/calendar/calendar-host.tsx:141-150`（week 容器加寬）

**Interfaces:**
- Consumes: `layoutDayEvents` / `EventInterval`（Task 1）；`EventPopover`（既有，`{ event, children }`）；`weekRange/addDays/isoToday`（既有）；props 不變：`{ date, onDateChange, eventsByDate, isLoading }`。
- Produces: 對外介面（props、元件名 `CalendarWeekView`）不變，`calendar-host.tsx` 呼叫處只改容器寬。

視覺規格（依已驗收 mockup）：
- 頂部導覽列（`‹ 範圍 本週 ›`）沿用現有 JSX 不動。
- 網格外框：`border border-border rounded-xl overflow-hidden`；手機寬度外層 `overflow-x-auto`、內層 `min-w-[760px]`。
- 日 header：7 欄置中，星期（`text-[11px] text-text-dim`）+ 日期數字；今天：星期字 `text-primary font-semibold`、數字 `bg-primary text-primary-foreground rounded-full`。
- 全天列：header 下方，左欄「全天」標籤用 `t("eventAllDay")`（`text-[10px] text-text-faint`），chip：`bg-primary/15 border-l-[3px] border-primary rounded-md`。
- 時間網格：左欄 56px 時間軸（`HH:MM`、`text-text-faint tabular-nums`，每小時一個、貼齊格線置中）；7 日欄 `border-l border-border`；每小時格線 `border-t border-border opacity-55`；總高 `24 * 48px`，包在 `overflow-y-auto` 容器（高度 `h-[calc(100dvh-240px)] min-h-[320px]`，實測時微調）。
- 事件塊：絕對定位；`top = startMin/60*48`、`height = max(durMin/60*48 - 3, 14)`；寬/左偏移由 `layoutDayEvents` 的 `column/columnCount` 換算百分比；樣式 `bg-primary/15 hover:bg-primary/25 border-l-[3px] border-primary rounded-[7px]`；標題 `text-xs font-semibold` 最多 2 行 + 起訖時間 `text-[10.5px] text-text-dim`。
- ≤30 分鐘短事件：單行、只顯示標題（`text-[11.5px]`）、不顯示時間。
- 過去事件（`!allDay && new Date(end) < now`）：`bg-foreground/[0.05] border-border-light`、文字 `text-dim`。
- 點事件：包 `EventPopover`（trigger 是絕對定位的 `<button>`）。
- 初始捲動：資料載入後一次，捲到「今天第一個非全天事件前一小時」（不足取 0），今天無事件（或今天不在本週）→ 08:00。
- Loading：沿用現有 spinner 條件；**移除整週空狀態文字**，空週也照樣顯示網格（網格本身即是空態）。
- 跨午夜事件：`endMin` 夾到 1440（事件只畫在 start 那天的欄）。

- [ ] **Step 1: 重寫 `week-view.tsx`**

```tsx
"use client";

import { useEffect, useRef } from "react";
import { format } from "date-fns";
import { enUS, ja, zhTW } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { weekRange, addDays, isoToday } from "@/lib/calendar-dates";
import { layoutDayEvents, type EventInterval } from "@/lib/calendar-layout";
import type { CalendarEvent } from "@/lib/google-calendar/types";
import { EventPopover } from "./event-popover";

const HOUR_H = 48; // px per hour — 與 mac CalendarWeekGridView.hourHeight 對齊

function formatHHMM(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** 當日 00:00 起算分鐘數（local time，與 formatHHMM 同一時區語意） */
function minutesOfDay(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

/** 事件在該日欄的分鐘區間 — 跨午夜夾到 24:00 */
function dayInterval(e: CalendarEvent, dayStr: string): EventInterval {
  const startMin = minutesOfDay(e.start);
  const endsSameDay = format(new Date(e.end), "yyyy-MM-dd") === dayStr;
  const endMin = endsSameDay ? minutesOfDay(e.end) : 24 * 60;
  return { startMin, endMin: Math.max(endMin, startMin) };
}

interface Props {
  date: string;
  onDateChange: (d: string) => void;
  eventsByDate: Map<string, CalendarEvent[]>;
  isLoading: boolean;
}

export function CalendarWeekView({ date, onDateChange, eventsByDate, isLoading }: Props) {
  const t = useTranslations("calendar");
  const tDaily = useTranslations("daily");
  const locale = useLocale();
  const dateFnsLocale = locale === "ja" ? ja : locale === "en" ? enUS : zhTW;

  const { start, end } = weekRange(date);
  const today = isoToday();

  const days: string[] = [];
  let cur = start;
  for (let i = 0; i < 7; i++) {
    days.push(cur);
    cur = addDays(cur, 1);
  }

  const startDate = new Date(start + "T00:00:00");
  const endDate = new Date(end + "T00:00:00");
  const rangeLabel = `${startDate.getMonth() + 1}/${startDate.getDate()} – ${endDate.getMonth() + 1}/${endDate.getDate()}`;

  const allWeekEvents = days.flatMap((d) => eventsByDate.get(d) ?? []);
  const now = new Date();

  // 初始捲動：資料首次到位後捲一次到今天首個非全天事件前一小時；
  // 今天無事件（或不在本週）→ 08:00。之後切週不再重捲。
  const scrollRef = useRef<HTMLDivElement>(null);
  const didScrollRef = useRef(false);
  useEffect(() => {
    if (didScrollRef.current || isLoading) return;
    const el = scrollRef.current;
    if (!el) return;
    const todayEvents = (eventsByDate.get(today) ?? []).filter((e) => !e.allDay);
    const firstMin = todayEvents.length
      ? Math.min(...todayEvents.map((e) => minutesOfDay(e.start)))
      : 9 * 60;
    el.scrollTop = (Math.max(firstMin - 60, 0) / 60) * HOUR_H;
    didScrollRef.current = true;
  }, [isLoading, eventsByDate, today]);

  return (
    <div className="pt-4 pb-8 space-y-5">
      {/* Header row（沿用原版） */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onDateChange(addDays(date, -7))}
          aria-label={tDaily("prevWeekAria")}
          className="flex items-center justify-center w-9 h-9 rounded-full text-text-dim hover:text-foreground hover:bg-surface-hover transition-colors shrink-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex flex-1 items-center justify-center gap-3">
          <span className="text-column-title text-foreground tabular-nums">{rangeLabel}</span>
          <button
            type="button"
            onClick={() => onDateChange(isoToday())}
            className="text-row-meta text-foreground hover:bg-surface-hover px-3 py-1 rounded-full transition-colors"
          >
            {t("thisWeek")}
          </button>
        </div>
        <button
          type="button"
          onClick={() => onDateChange(addDays(date, 7))}
          aria-label={tDaily("nextWeekAria")}
          className="flex items-center justify-center w-9 h-9 rounded-full text-text-dim hover:text-foreground hover:bg-surface-hover transition-colors shrink-0"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Loading spinner（首次載入且完全沒資料時） */}
      {isLoading && allWeekEvents.length === 0 ? (
        <div
          role="status"
          aria-busy="true"
          aria-label={t("panelLoading")}
          className="flex justify-center py-16"
        >
          <div className="h-6 w-6 rounded-full border-2 border-border border-t-foreground/40 animate-spin" />
          <span className="sr-only">{t("panelLoading")}</span>
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[760px]">
              {/* 日 header 列 */}
              <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-border">
                <div />
                {days.map((dayStr) => {
                  const dayDate = new Date(dayStr + "T00:00:00");
                  const isToday = dayStr === today;
                  return (
                    <div
                      key={dayStr}
                      className="border-l border-border py-2.5 text-center"
                    >
                      <div
                        className={`mb-1 text-[11px] tracking-wide ${
                          isToday ? "text-primary font-semibold" : "text-text-dim"
                        }`}
                      >
                        {format(dayDate, "EEE", { locale: dateFnsLocale })}
                      </div>
                      <span
                        className={`inline-block h-[30px] w-[30px] rounded-full text-[17px] font-semibold leading-[30px] tabular-nums ${
                          isToday ? "bg-primary text-primary-foreground" : "text-foreground"
                        }`}
                      >
                        {dayDate.getDate()}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* 全天事件列 */}
              <div className="grid min-h-[30px] grid-cols-[56px_repeat(7,1fr)] border-b border-border">
                <div className="pr-2 pt-2 text-right text-[10px] text-text-faint">
                  {t("eventAllDay")}
                </div>
                {days.map((dayStr) => {
                  const allDayEvents = (eventsByDate.get(dayStr) ?? []).filter((e) => e.allDay);
                  return (
                    <div key={dayStr} className="flex flex-col gap-[3px] border-l border-border p-[3px]">
                      {allDayEvents.map((e) => (
                        <EventPopover key={`${e.calendarId}-${e.id}`} event={e}>
                          <button
                            type="button"
                            title={e.title}
                            className="truncate rounded-md border-l-[3px] border-primary bg-primary/15 px-2 py-[3px] text-left text-[11.5px] font-medium text-foreground hover:bg-primary/25"
                          >
                            {e.title}
                          </button>
                        </EventPopover>
                      ))}
                    </div>
                  );
                })}
              </div>

              {/* 時間網格（垂直捲動） */}
              <div ref={scrollRef} className="h-[calc(100dvh-240px)] min-h-[320px] overflow-y-auto">
                <div
                  className="relative grid grid-cols-[56px_repeat(7,1fr)]"
                  style={{ height: 24 * HOUR_H }}
                >
                  {/* 時間軸欄 */}
                  <div className="relative">
                    {Array.from({ length: 23 }, (_, i) => i + 1).map((h) => (
                      <div
                        key={h}
                        className="absolute right-2 -translate-y-1/2 bg-background px-0.5 text-[10.5px] text-text-faint tabular-nums"
                        style={{ top: h * HOUR_H }}
                      >
                        {`${String(h).padStart(2, "0")}:00`}
                      </div>
                    ))}
                  </div>

                  {/* 7 日欄 */}
                  {days.map((dayStr) => {
                    const timed = (eventsByDate.get(dayStr) ?? []).filter((e) => !e.allDay);
                    const intervals = timed.map((e) => dayInterval(e, dayStr));
                    const placements = layoutDayEvents(intervals);
                    return (
                      <div key={dayStr} className="relative border-l border-border">
                        {Array.from({ length: 23 }, (_, i) => i + 1).map((h) => (
                          <div
                            key={h}
                            className="pointer-events-none absolute inset-x-0 border-t border-border opacity-55"
                            style={{ top: h * HOUR_H }}
                          />
                        ))}
                        {timed.map((e, idx) => {
                          const { startMin, endMin } = intervals[idx];
                          const { column, columnCount } = placements[idx];
                          const durMin = endMin - startMin;
                          const isShort = durMin <= 30;
                          const isPast = new Date(e.end) < now;
                          const widthPct = 100 / columnCount;
                          return (
                            <EventPopover key={`${e.calendarId}-${e.id}`} event={e}>
                              <button
                                type="button"
                                title={`${e.title}\n${formatHHMM(e.start)} – ${formatHHMM(e.end)}`}
                                className={`absolute overflow-hidden rounded-[7px] border-l-[3px] px-1.5 py-[3px] text-left transition-colors ${
                                  isPast
                                    ? "border-border-light bg-foreground/[0.05] hover:bg-primary/15"
                                    : "border-primary bg-primary/15 hover:bg-primary/25"
                                }`}
                                style={{
                                  top: (startMin / 60) * HOUR_H + 1,
                                  height: Math.max((durMin / 60) * HOUR_H - 3, 14),
                                  left: `calc(${column * widthPct}% + 2px)`,
                                  width: `calc(${widthPct}% - ${columnCount > 1 ? 4 : 6}px)`,
                                  zIndex: 10 + column,
                                }}
                              >
                                <div
                                  className={`line-clamp-2 text-xs leading-tight ${
                                    isPast
                                      ? "font-medium text-text-dim"
                                      : "font-semibold text-foreground"
                                  } ${isShort ? "line-clamp-1 text-[11.5px]" : ""}`}
                                >
                                  {e.title}
                                </div>
                                {!isShort && (
                                  <div className="truncate text-[10.5px] text-text-dim tabular-nums">
                                    {formatHHMM(e.start)} – {formatHHMM(e.end)}
                                  </div>
                                )}
                              </button>
                            </EventPopover>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: `calendar-host.tsx` week 容器加寬**

把 week 分支（141-150 行）的容器由 `max-w-[720px]` 改為 `max-w-[1200px]`：

```tsx
      {mode === "week" && (
        <div className="mx-auto max-w-[1200px] px-4 md:px-6">
          <CalendarWeekView
            date={date}
            onDateChange={setDate}
            eventsByDate={eventsByDate}
            isLoading={isLoading}
          />
        </div>
      )}
```

- [ ] **Step 3: Build + 既有測試**

Run: `npx next build && npm test`
Expected: build 成功、既有 vitest 全綠（含 Task 1 的 calendar-layout）

- [ ] **Step 4: 手動 smoke（dev server）**

`npm run dev` → 開 `/calendar?mode=week`：網格渲染、事件定位正確、重疊並排、全天列、點事件開 modal、初始捲動、視窗縮窄橫向捲動、dark mode。這一步只是開發者自查，最終驗收在 Task 7。

- [ ] **Step 5: Commit**

```bash
git add src/components/calendar/week-view.tsx src/components/calendar/calendar-host.tsx
git commit -m "feat(calendar): web 週檢視改 Google Calendar 式時間軸網格"
```

---

### Task 4: Web 預設檢視改 week

**Files:**
- Modify: `src/components/calendar/calendar-host.tsx:32-34`

**Interfaces:**
- Consumes: 無
- Produces: 無 URL mode、無 localStorage 偏好時預設 `"week"`；既有偏好（URL/localStorage）不受影響。

- [ ] **Step 1: 改 fallback**

```tsx
  const [mode, setMode] = useState<Mode>(() =>
    MODES.includes(initialMode as Mode) ? (initialMode as Mode) : "week"
  );
```

- [ ] **Step 2: 驗證**

Run: `npx next build`
Expected: 成功。手動：無痕視窗（無 localStorage）開 `/calendar` → 直接是週檢視；`?mode=day` 仍是日檢視；localStorage 存過 `day` 的分頁重整仍是日檢視。

- [ ] **Step 3: Commit**

```bash
git add src/components/calendar/calendar-host.tsx
git commit -m "feat(calendar): web 行事曆預設檢視改為週"
```

---

### Task 5: Mac 時間網格 `CalendarWeekGridView` + 平台分支

**Files:**
- Create: `apple/NudgeKit/Sources/NudgeUI/Calendar/CalendarWeekGridView.swift`
- Modify: `apple/NudgeKit/Sources/NudgeUI/Calendar/CalendarHostView.swift:215-231`（week 分支平台切換）
- 不動: `CalendarWeekView.swift`（iOS 續用）

**Interfaces:**
- Consumes: `CalendarWeekLayout.layoutDayEvents`（Task 2）；`CalendarEventDTO`（`start`/`end` 為含 offset 的 ISO 字串）；`IconButton`、`Color.nudgeXxx` tokens、`DateFormatters.isoDate`、`nudgeLocalized("calendar.eventAllDay", locale:)`（皆既有）。
- Produces: `CalendarWeekGridView(weekStart:weekEnd:events:isLoading:onPrevWeek:onNextWeek:onThisWeek:onEventTap:)` — 參數與 `CalendarWeekView` 完全同形，`CalendarHostView` 在 macOS 換用它。

實作要點：
- 時間一律從 ISO **字串**取（`"T"` 後 `HH:MM` → 分鐘數；日期用 `prefix(10)`），沿用「用事件自身時區顯示」的既有語意（同 `shortTime`），**不要**過 `Date()` 轉時區。
- 跨午夜：`end` 的 `prefix(10)` ≠ 該日 ISO → endMin 夾 1440。
- 過去事件判斷沿用 `CalendarWeekView.isPast` 同款 `ISO8601DateFormatter` 寫法。
- `hourHeight: CGFloat = 48`；欄寬用 `GeometryReader` 總寬減 56 除以 7。
- 事件塊：`RoundedRectangle(cornerRadius: 7)` 底 `Color.nudgePrimary.opacity(0.15)`（過去 `Color.nudgeForeground.opacity(0.05)`）+ 左 3pt `nudgePrimary` 色條（過去 `nudgeBorderLight`）；標題 `.font(.caption).bold()` 2 行、時間 `.font(.caption2)`；≤30 分鐘單行只標題。
- 初始捲動：`ScrollViewReader` + 每小時格線掛 `.id(hour)`，`onAppear` `proxy.scrollTo(targetHour, anchor: .top)`；targetHour = 今天首個非全天事件小時 − 1（無 → 8）。
- 點事件 → `onEventTap(event)`（詳情 popover 由 CalendarHostView 既有機制處理）。

- [ ] **Step 1: 新增 `CalendarWeekGridView.swift`**

```swift
import SwiftUI
import NudgeCore

/// Google Calendar 式時間軸週網格 — macOS 專用（iOS 週檢視仍用
/// CalendarWeekView agenda 列表）。事件依 start/end 換算 offset/height，
/// 重疊用 CalendarWeekLayout 貪婪分欄避讓。唯讀：點事件開詳情。
/// 時間一律取 ISO 字串的 "HH:MM"（事件自身時區），與 CalendarWeekView
/// shortTime 同語意，不過 Date() 轉裝置時區。
struct CalendarWeekGridView: View {
    @Environment(\.locale) private var locale
    let weekStart: Date
    let weekEnd: Date
    let events: [CalendarEventDTO]
    let isLoading: Bool
    let onPrevWeek: () -> Void
    let onNextWeek: () -> Void
    let onThisWeek: () -> Void
    let onEventTap: (CalendarEventDTO) -> Void

    private let hourHeight: CGFloat = 48
    private let axisWidth: CGFloat = 56

    private var calendar: Calendar {
        var c = Calendar(identifier: .gregorian)
        c.firstWeekday = 2
        return c
    }

    private var days: [Date] {
        (0..<7).compactMap { calendar.date(byAdding: .day, value: $0, to: weekStart) }
    }

    private var eventsByDate: [String: [CalendarEventDTO]] {
        Dictionary(grouping: events, by: { String($0.start.prefix(10)) })
    }

    private var todayISO: String { DateFormatters.isoDate(Date()) }

    var body: some View {
        VStack(spacing: 0) {
            header
            if isLoading && events.isEmpty {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                gridFrame
            }
        }
    }

    // MARK: - Header（同 CalendarWeekView）

    private var header: some View {
        HStack {
            IconButton(
                systemName: "chevron.left",
                accessibilityLabel: "calendar.prevWeek",
                action: onPrevWeek
            )
            Spacer()
            Text(verbatim: headerRangeLabel)
                .font(.title3.weight(.semibold))
                .foregroundStyle(Color.nudgeForeground)
            Spacer()
            Button(action: onThisWeek) {
                Text("calendar.thisWeek", bundle: .module)
                    .font(.footnote)
                    .foregroundStyle(Color.nudgeForeground)
                    .frame(minHeight: 44)
                    .padding(.horizontal, 8)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            IconButton(
                systemName: "chevron.right",
                accessibilityLabel: "calendar.nextWeek",
                action: onNextWeek
            )
        }
        .padding(.horizontal, 8)
    }

    private var headerRangeLabel: String {
        let fmt = DateFormatter()
        fmt.dateFormat = "M/d"
        return "\(fmt.string(from: weekStart)) – \(fmt.string(from: weekEnd))"
    }

    // MARK: - Grid

    private var gridFrame: some View {
        VStack(spacing: 0) {
            dayHeaderRow
            allDayRow
            timeGrid
        }
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(Color.nudgeBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .padding(.horizontal, 8)
        .padding(.bottom, 8)
    }

    private var dayHeaderRow: some View {
        HStack(spacing: 0) {
            Color.clear.frame(width: axisWidth, height: 1)
            ForEach(days, id: \.self) { day in
                let iso = DateFormatters.isoDate(day)
                let isToday = iso == todayISO
                VStack(spacing: 4) {
                    Text(verbatim: weekdayLabel(day))
                        .font(.caption2)
                        .foregroundStyle(isToday ? Color.nudgePrimary : Color.nudgeTextDim)
                        .fontWeight(isToday ? .semibold : .regular)
                    Text(verbatim: "\(calendar.component(.day, from: day))")
                        .font(.body.weight(.semibold))
                        .monospacedDigit()
                        .foregroundStyle(isToday ? Color.nudgePrimaryForeground : Color.nudgeForeground)
                        .frame(width: 30, height: 30)
                        .background(
                            Circle().fill(isToday ? Color.nudgePrimary : Color.clear)
                        )
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
                .overlay(alignment: .leading) {
                    Rectangle().fill(Color.nudgeBorder).frame(width: 1)
                }
            }
        }
        .overlay(alignment: .bottom) {
            Rectangle().fill(Color.nudgeBorder).frame(height: 1)
        }
    }

    private func weekdayLabel(_ day: Date) -> String {
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: locale.identifier)
        fmt.dateFormat = "EEE"
        return fmt.string(from: day)
    }

    private var allDayRow: some View {
        HStack(alignment: .top, spacing: 0) {
            Text(verbatim: nudgeLocalized("calendar.eventAllDay", locale: locale))
                .font(.caption2)
                .foregroundStyle(Color.nudgeTextDim)
                .frame(width: axisWidth, alignment: .trailing)
                .padding(.trailing, 8)
                .padding(.top, 8)
            ForEach(days, id: \.self) { day in
                let iso = DateFormatters.isoDate(day)
                let allDayEvents = (eventsByDate[iso] ?? []).filter(\.allDay)
                VStack(spacing: 3) {
                    ForEach(allDayEvents, id: \.id) { event in
                        Button { onEventTap(event) } label: {
                            Text(verbatim: event.title)
                                .font(.caption.weight(.medium))
                                .foregroundStyle(Color.nudgeForeground)
                                .lineLimit(1)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 3)
                                .background(alignment: .leading) {
                                    allDayChipBackground
                                }
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(3)
                .frame(maxWidth: .infinity, minHeight: 30, alignment: .top)
                .overlay(alignment: .leading) {
                    Rectangle().fill(Color.nudgeBorder).frame(width: 1)
                }
            }
        }
        .overlay(alignment: .bottom) {
            Rectangle().fill(Color.nudgeBorder).frame(height: 1)
        }
    }

    private var allDayChipBackground: some View {
        ZStack(alignment: .leading) {
            RoundedRectangle(cornerRadius: 6, style: .continuous)
                .fill(Color.nudgePrimary.opacity(0.15))
            Rectangle().fill(Color.nudgePrimary).frame(width: 3)
        }
        .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
    }

    private var timeGrid: some View {
        ScrollViewReader { proxy in
            ScrollView {
                HStack(alignment: .top, spacing: 0) {
                    axisColumn
                    GeometryReader { geo in
                        HStack(spacing: 0) {
                            ForEach(days, id: \.self) { day in
                                dayColumn(day: day, width: geo.size.width / 7)
                            }
                        }
                    }
                    .frame(height: hourHeight * 24)
                }
                .frame(height: hourHeight * 24)
            }
            .onAppear {
                proxy.scrollTo(initialScrollHour, anchor: .top)
            }
        }
    }

    /// 今天首個非全天事件小時 − 1（不足取 0）；今天無事件或不在本週 → 8。
    private var initialScrollHour: Int {
        let todayTimed = (eventsByDate[todayISO] ?? []).filter { !$0.allDay }
        guard let firstMin = todayTimed.map({ minutesOfDay($0.start) }).min() else { return 8 }
        return max(Int(firstMin) / 60 - 1, 0)
    }

    private var axisColumn: some View {
        ZStack(alignment: .topTrailing) {
            Color.clear
            ForEach(1..<24, id: \.self) { h in
                Text(verbatim: String(format: "%02d:00", h))
                    .font(.caption2)
                    .monospacedDigit()
                    .foregroundStyle(Color.nudgeTextDim)
                    .padding(.trailing, 8)
                    .offset(y: CGFloat(h) * hourHeight - 7)
                    .id(h)
            }
        }
        .frame(width: axisWidth, height: hourHeight * 24)
    }

    /// ISO 字串 → 當日分鐘數（事件自身時區的 "HH:MM"）。
    private func minutesOfDay(_ iso: String) -> Double {
        guard let tIndex = iso.firstIndex(of: "T") else { return 0 }
        let hhmm = iso[iso.index(after: tIndex)...].prefix(5)
        let parts = hhmm.split(separator: ":")
        guard parts.count == 2,
              let h = Double(parts[0]), let m = Double(parts[1]) else { return 0 }
        return h * 60 + m
    }

    /// 事件在該日欄的分鐘區間 — 跨午夜夾到 24:00。
    private func dayInterval(_ event: CalendarEventDTO, dayISO: String) -> CalendarWeekLayout.Interval {
        let startMin = minutesOfDay(event.start)
        let endsSameDay = String(event.end.prefix(10)) == dayISO
        let endMin = endsSameDay ? minutesOfDay(event.end) : 24 * 60
        return CalendarWeekLayout.Interval(startMin: startMin, endMin: max(endMin, startMin))
    }

    private func dayColumn(day: Date, width: CGFloat) -> some View {
        let iso = DateFormatters.isoDate(day)
        let timed = (eventsByDate[iso] ?? []).filter { !$0.allDay }
        let intervals = timed.map { dayInterval($0, dayISO: iso) }
        let placements = CalendarWeekLayout.layoutDayEvents(intervals)

        return ZStack(alignment: .topLeading) {
            // 小時格線
            ForEach(1..<24, id: \.self) { h in
                Rectangle()
                    .fill(Color.nudgeBorder.opacity(0.55))
                    .frame(height: 1)
                    .offset(y: CGFloat(h) * hourHeight)
            }
            // 事件塊
            ForEach(Array(timed.enumerated()), id: \.element.id) { idx, event in
                eventBlock(
                    event: event,
                    interval: intervals[idx],
                    placement: placements[idx],
                    columnWidth: width
                )
            }
        }
        .frame(width: width, height: hourHeight * 24, alignment: .topLeading)
        .overlay(alignment: .leading) {
            Rectangle().fill(Color.nudgeBorder).frame(width: 1)
        }
    }

    private func eventBlock(
        event: CalendarEventDTO,
        interval: CalendarWeekLayout.Interval,
        placement: CalendarWeekLayout.Placement,
        columnWidth: CGFloat
    ) -> some View {
        let durMin = interval.endMin - interval.startMin
        let isShort = durMin <= 30
        let past = isPast(event.end)
        let subWidth = columnWidth / CGFloat(placement.columnCount)
        let blockWidth = max(subWidth - (placement.columnCount > 1 ? 4 : 6), 10)
        let blockHeight = max(CGFloat(durMin) / 60 * hourHeight - 3, 14)
        let x = CGFloat(placement.column) * subWidth + 2
        let y = CGFloat(interval.startMin) / 60 * hourHeight + 1

        return Button { onEventTap(event) } label: {
            VStack(alignment: .leading, spacing: 1) {
                Text(verbatim: event.title)
                    .font(.caption.weight(past ? .medium : .semibold))
                    .foregroundStyle(past ? Color.nudgeTextDim : Color.nudgeForeground)
                    .lineLimit(isShort ? 1 : 2)
                if !isShort {
                    Text(verbatim: "\(shortTime(event.start)) – \(shortTime(event.end))")
                        .font(.caption2)
                        .monospacedDigit()
                        .foregroundStyle(Color.nudgeTextDim)
                        .lineLimit(1)
                }
            }
            .padding(.horizontal, 5)
            .padding(.vertical, isShort ? 1 : 3)
            .frame(width: blockWidth, height: blockHeight, alignment: .topLeading)
            .background(alignment: .leading) {
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 7, style: .continuous)
                        .fill(past ? Color.nudgeForeground.opacity(0.05) : Color.nudgePrimary.opacity(0.15))
                    Rectangle()
                        .fill(past ? Color.nudgeBorderLight : Color.nudgePrimary)
                        .frame(width: 3)
                }
                .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .offset(x: x, y: y)
        .zIndex(Double(10 + placement.column))
        .help(Text(verbatim: "\(event.title)  \(shortTime(event.start)) – \(shortTime(event.end))"))
    }

    private func shortTime(_ iso: String) -> String {
        guard let tIndex = iso.firstIndex(of: "T") else { return iso }
        let afterT = iso.index(after: tIndex)
        return String(iso[afterT...].prefix(5))
    }

    /// 同 CalendarWeekView.isPast。
    private func isPast(_ endIso: String) -> Bool {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = f.date(from: endIso) { return d < Date() }
        f.formatOptions = [.withInternetDateTime]
        return f.date(from: endIso).map { $0 < Date() } ?? false
    }
}
```

- [ ] **Step 2: `CalendarHostView` week 分支平台切換**

把 `case .week:`（215-231 行）改成：

```swift
        case .week:
            let start = weekStart(selectedDateObj)
            let end = calendar.date(byAdding: .day, value: 6, to: start) ?? start
            #if os(macOS)
            // macOS：時間軸網格，加寬到 1200（比 Cards 的 720 寬 —
            // 7 欄時間格需要橫向空間）並置中。
            CalendarWeekGridView(
                weekStart: start,
                weekEnd: end,
                events: events,
                isLoading: isLoading,
                onPrevWeek: { offsetWeek(-1) },
                onNextWeek: { offsetWeek(1) },
                onThisWeek: { selectedDate = DateFormatters.isoDate(Date()) },
                onEventTap: handleEventTap
            )
            .frame(maxWidth: 1200)
            .frame(maxWidth: .infinity)
            #else
            // iOS：維持 agenda 列表（iPhone 螢幕窄，七欄時間格太擠）。
            centeredColumn {
                CalendarWeekView(
                    weekStart: start,
                    weekEnd: end,
                    events: events,
                    isLoading: isLoading,
                    onPrevWeek: { offsetWeek(-1) },
                    onNextWeek: { offsetWeek(1) },
                    onThisWeek: { selectedDate = DateFormatters.isoDate(Date()) },
                    onEventTap: handleEventTap
                )
            }
            #endif
```

注意：改完後 macOS build 可能警告 `centeredColumn` 只剩 day 在用 — 保留不動（day 仍用）。

- [ ] **Step 3: Build 驗證（swift build 不夠，必須 full target build）**

```bash
cd apple/NudgeKit && swift build && swift test --filter CalendarWeekLayoutTests
cd .. && xcodegen generate
xcodebuild -project Nudge.xcodeproj -scheme Nudge-macOS -configuration Debug build
xcodebuild -project Nudge.xcodeproj -scheme Nudge-iOS -destination 'generic/platform=iOS Simulator' -configuration Debug build
```
Expected: 全部成功（iOS build 確認平台分支沒把 grid 帶進 iOS 編譯錯誤）。

- [ ] **Step 4: Commit**

```bash
git add apple/NudgeKit/Sources/NudgeUI/Calendar/CalendarWeekGridView.swift apple/NudgeKit/Sources/NudgeUI/Calendar/CalendarHostView.swift
git commit -m "feat(calendar): mac 週檢視改時間軸網格（iOS 維持 agenda 列表）"
```

---

### Task 6: Mac 預設檢視改 week（僅 macOS）

**Files:**
- Modify: `apple/NudgeKit/Sources/NudgeUI/Calendar/CalendarViewMode.swift`
- Modify: `apple/NudgeKit/Sources/NudgeUI/Calendar/CalendarHostView.swift:10`（@AppStorage 預設）與 `:60`（invalid raw fallback）
- Modify: `apple/NudgeKit/Sources/NudgeUI/PlatformRootView.swift:165`（另一處 @AppStorage 預設 — **兩處都要改，否則 toolbar picker 與 host 預設不一致**）

**Interfaces:**
- Consumes: 無
- Produces: `CalendarViewMode.platformDefault: CalendarViewMode`（macOS `.week` / iOS `.day`），供兩處 `@AppStorage` 預設值使用。

- [ ] **Step 1: `CalendarViewMode` 加 platformDefault**

```swift
public enum CalendarViewMode: String, CaseIterable, Identifiable, Sendable {
    case day, week, month
    public var id: String { rawValue }

    /// 預設檢視 — mac 桌面寬螢幕預設週（time grid）；iPhone 預設日。
    /// 只影響沒存過偏好的新使用者，@AppStorage 已有值者不受影響。
    public static var platformDefault: CalendarViewMode {
        #if os(macOS)
        .week
        #else
        .day
        #endif
    }

    public var labelKey: LocalizedStringKey {
        switch self {
        case .day: "calendar.viewMode.day"
        case .week: "calendar.viewMode.week"
        case .month: "calendar.viewMode.month"
        }
    }
}
```

- [ ] **Step 2: 兩處 @AppStorage 預設 + invalid fallback 改用它**

`CalendarHostView.swift:10`：

```swift
    @AppStorage(CalendarPreferenceKey.viewMode) private var modeRaw: String = CalendarViewMode.platformDefault.rawValue
```

`CalendarHostView.swift:60`（`mode` computed property 的 fallback）：

```swift
        return CalendarViewMode(rawValue: modeRaw) ?? .platformDefault
```

`PlatformRootView.swift:165`：

```swift
    @AppStorage(CalendarPreferenceKey.viewMode) private var calendarModeRaw: String = CalendarViewMode.platformDefault.rawValue
```

- [ ] **Step 3: Build 驗證**

```bash
cd apple/NudgeKit && swift build
cd .. && xcodebuild -project Nudge.xcodeproj -scheme Nudge-macOS -configuration Debug build
xcodebuild -project Nudge.xcodeproj -scheme Nudge-iOS -destination 'generic/platform=iOS Simulator' -configuration Debug build
```
Expected: 全部成功。

- [ ] **Step 4: Commit**

```bash
git add apple/NudgeKit/Sources/NudgeUI/Calendar/CalendarViewMode.swift apple/NudgeKit/Sources/NudgeUI/Calendar/CalendarHostView.swift apple/NudgeKit/Sources/NudgeUI/PlatformRootView.swift
git commit -m "feat(calendar): mac 行事曆預設檢視改為週（iOS 維持日）"
```

---

### Task 7: 端到端驗證（DoD — 不可只靠 build）

**Files:** 無新檔案；這是驗收 task。

- [ ] **Step 1: 全量自動驗證**

```bash
npm test && npx next build && npm run lint
cd apple/NudgeKit && swift test
```
Expected: 全綠。

- [ ] **Step 2: Web 實測（dev server + 瀏覽器）**

`npm run dev`，逐項走：
1. 無痕視窗開 `/calendar` → 預設直接是週檢視網格。
2. 初始捲動落在今天首個事件前一小時（或 08:00）。
3. 重疊事件左右並排、互不遮蓋；全天事件在頂部列。
4. 點時間軸事件、點全天 chip → 詳情 modal 開啟、Esc / 點外面關閉。
5. `‹ ›` 切週、「本週」回本週；URL `?mode=week&date=` 同步。
6. 過去事件淡化（找有歷史事件的週確認）。
7. 視窗縮到手機寬 → 網格橫向捲動、頁面本身不橫捲。
8. dark / light 主題都檢查一次。
9. 切到日檢視 → 重整 → 仍是日檢視（localStorage 偏好蓋過新預設）。

- [ ] **Step 3: Mac 實測**

跑 mac app（重 build 後用 `open -n <DerivedData 路徑>` 開新 instance），逐項走：
1. 清掉偏好模擬新使用者：`defaults delete tw.nudge.Nudge "calendar.view.mode"`（bundle id 以實際為準）→ 開 app 切到 Calendar tab → 預設週網格。
2. 同 Web 清單 2-6（初始捲動、重疊並排、全天列、點事件 popover、切週、過去事件淡化）。
3. Toolbar 日｜週｜月 picker 切換即時生效、與網格一致。
4. 視窗縮窄 → 網格壓縮不爆版。
5. Daily 頁右欄（embedded calendar）仍是日檢視、不受影響。

- [ ] **Step 4: iOS 迴歸確認（模擬器）**

1. Calendar tab 預設仍是日檢視。
2. 手動切週 → 仍是 agenda 列表（不是網格）。

- [ ] **Step 5: 回報使用者實測**

依專案規則：互動功能等使用者實測完才算完成。列出 Step 2/3 清單請使用者代跑或確認後，才進 merge / PR 流程。

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

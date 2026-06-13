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

describe("isoToday", () => {
  it("returns YYYY-MM-DD", () => {
    expect(isoToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
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

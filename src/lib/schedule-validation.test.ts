import { describe, expect, it } from "vitest";
import {
  validateEndAfterStart,
  validateWeeklyHasWeekday,
  parseWeekdaysCsv,
  weekdaysToCsv,
} from "./schedule-validation";

describe("validateEndAfterStart", () => {
  it("end null OK", () => {
    expect(validateEndAfterStart("2026-04-26", null)).toBe(true);
  });
  it("end after start OK", () => {
    expect(validateEndAfterStart("2026-04-26", "2026-04-27")).toBe(true);
  });
  it("end equal start NOT OK", () => {
    expect(validateEndAfterStart("2026-04-26", "2026-04-26")).toBe(false);
  });
  it("end before start NOT OK", () => {
    expect(validateEndAfterStart("2026-04-26", "2026-04-25")).toBe(false);
  });
});

describe("validateWeeklyHasWeekday", () => {
  it("weekly with one weekday OK", () => {
    expect(validateWeeklyHasWeekday("weekly", "3")).toBe(true);
  });
  it("weekly with empty CSV NOT OK", () => {
    expect(validateWeeklyHasWeekday("weekly", "")).toBe(false);
    expect(validateWeeklyHasWeekday("weekly", null)).toBe(false);
  });
  it("biweekly same rule", () => {
    expect(validateWeeklyHasWeekday("biweekly", "1,5")).toBe(true);
    expect(validateWeeklyHasWeekday("biweekly", null)).toBe(false);
  });
  it("non-weekly preset always OK", () => {
    expect(validateWeeklyHasWeekday("daily", null)).toBe(true);
    expect(validateWeeklyHasWeekday("monthly_day", null)).toBe(true);
  });
});

describe("parseWeekdaysCsv / weekdaysToCsv", () => {
  it("round-trips set", () => {
    expect(parseWeekdaysCsv("1,3,5")).toEqual(new Set([1, 3, 5]));
    expect(weekdaysToCsv(new Set([5, 1, 3]))).toBe("1,3,5");
  });
  it("empty handles", () => {
    expect(parseWeekdaysCsv(null)).toEqual(new Set());
    expect(parseWeekdaysCsv("")).toEqual(new Set());
    expect(weekdaysToCsv(new Set())).toBe("");
  });
  it("ignores invalid", () => {
    expect(parseWeekdaysCsv("0,3,8,abc")).toEqual(new Set([3]));
  });
});

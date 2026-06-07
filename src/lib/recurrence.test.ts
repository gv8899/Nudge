import { describe, expect, it } from "vitest";
import {
  occurs,
  occurrencesInRange,
  assignmentsToReap,
  type RecurrenceRule,
} from "./recurrence";

const baseDaily: RecurrenceRule = {
  preset: "daily",
  startDate: "2026-04-01",
  endDate: null,
  weekdays: null,
  monthDay: null,
  monthNth: null,
  monthNthWeekday: null,
};

describe("occurs", () => {
  it("daily 在 startDate 之後一直 true", () => {
    expect(occurs("2026-04-01", baseDaily)).toBe(true);
    expect(occurs("2026-04-15", baseDaily)).toBe(true);
    expect(occurs("2027-01-01", baseDaily)).toBe(true);
  });

  it("daily 在 startDate 之前是 false", () => {
    expect(occurs("2026-03-31", baseDaily)).toBe(false);
  });

  it("daily 在 endDate 之後是 false (端點 inclusive)", () => {
    const r: RecurrenceRule = { ...baseDaily, endDate: "2026-04-30" };
    expect(occurs("2026-04-30", r)).toBe(true);
    expect(occurs("2026-05-01", r)).toBe(false);
  });

  it("weekdays = Mon-Fri", () => {
    const r: RecurrenceRule = { ...baseDaily, preset: "weekdays" };
    // 2026-04-25 = 週六
    expect(occurs("2026-04-25", r)).toBe(false);
    // 2026-04-26 = 週日
    expect(occurs("2026-04-26", r)).toBe(false);
    // 2026-04-27 = 週一
    expect(occurs("2026-04-27", r)).toBe(true);
    // 2026-05-01 = 週五
    expect(occurs("2026-05-01", r)).toBe(true);
  });

  it("weekly 配 weekdays CSV", () => {
    const r: RecurrenceRule = {
      ...baseDaily,
      preset: "weekly",
      weekdays: "1,3,5",
    };
    expect(occurs("2026-04-27", r)).toBe(true); // Mon
    expect(occurs("2026-04-29", r)).toBe(true); // Wed
    expect(occurs("2026-05-01", r)).toBe(true); // Fri
    expect(occurs("2026-04-28", r)).toBe(false); // Tue
    expect(occurs("2026-04-30", r)).toBe(false); // Thu
  });

  it("biweekly 從 startDate 起算偶週才出現", () => {
    const r: RecurrenceRule = {
      ...baseDaily,
      preset: "biweekly",
      weekdays: "1",
      startDate: "2026-04-06", // Mon
    };
    expect(occurs("2026-04-06", r)).toBe(true); // 第 0 週
    expect(occurs("2026-04-13", r)).toBe(false); // 第 1 週
    expect(occurs("2026-04-20", r)).toBe(true); // 第 2 週
    expect(occurs("2026-04-27", r)).toBe(false); // 第 3 週
    expect(occurs("2026-05-04", r)).toBe(true); // 第 4 週
  });

  it("monthly_day 簡單 case", () => {
    const r: RecurrenceRule = {
      ...baseDaily,
      preset: "monthly_day",
      monthDay: 5,
    };
    expect(occurs("2026-04-05", r)).toBe(true);
    expect(occurs("2026-04-06", r)).toBe(false);
    expect(occurs("2026-05-05", r)).toBe(true);
    expect(occurs("2027-01-05", r)).toBe(true);
  });

  it("monthly_day 月底邊界 (2 月 31 號跳過)", () => {
    const r: RecurrenceRule = {
      ...baseDaily,
      preset: "monthly_day",
      monthDay: 31,
      startDate: "2026-01-01", // override base，覆蓋整年
    };
    expect(occurs("2026-01-31", r)).toBe(true);
    expect(occurs("2026-02-28", r)).toBe(false); // 2 月沒 31 號
    expect(occurs("2026-03-31", r)).toBe(true);
    expect(occurs("2026-04-30", r)).toBe(false); // 4 月只到 30
  });

  it("monthly_nth_weekday — 第 3 個週二", () => {
    const r: RecurrenceRule = {
      ...baseDaily,
      preset: "monthly_nth_weekday",
      monthNth: 3,
      monthNthWeekday: 2,
    };
    // 2026-04: 週二落在 7 / 14 / 21 / 28，第 3 個 = 4/21
    expect(occurs("2026-04-21", r)).toBe(true);
    expect(occurs("2026-04-14", r)).toBe(false);
    expect(occurs("2026-04-28", r)).toBe(false);
  });

  it("monthly_nth_weekday — 5 = 最後一個", () => {
    const r: RecurrenceRule = {
      ...baseDaily,
      preset: "monthly_nth_weekday",
      monthNth: 5,
      monthNthWeekday: 5, // last Friday
    };
    // 2026-04 週五: 3, 10, 17, 24 → 最後一個 = 24
    expect(occurs("2026-04-24", r)).toBe(true);
    expect(occurs("2026-04-17", r)).toBe(false);
    // 2026-05 週五: 1, 8, 15, 22, 29 → 最後一個 = 29
    expect(occurs("2026-05-29", r)).toBe(true);
    expect(occurs("2026-05-22", r)).toBe(false);
  });

  it("yearly — (月,日) 配 startDate", () => {
    const r: RecurrenceRule = {
      ...baseDaily,
      preset: "yearly",
      startDate: "2026-04-01",
    };
    expect(occurs("2026-04-01", r)).toBe(true);
    expect(occurs("2027-04-01", r)).toBe(true);
    expect(occurs("2028-04-01", r)).toBe(true);
    expect(occurs("2027-04-02", r)).toBe(false);
  });

  it("yearly — 2/29 平年退到 2/28", () => {
    const r: RecurrenceRule = {
      ...baseDaily,
      preset: "yearly",
      startDate: "2024-02-29",
    };
    expect(occurs("2024-02-29", r)).toBe(true); // leap
    expect(occurs("2025-02-28", r)).toBe(true); // non-leap → fallback
    expect(occurs("2025-02-29", r)).toBe(false); // doesn't exist
    expect(occurs("2028-02-29", r)).toBe(true); // leap again
    expect(occurs("2028-02-28", r)).toBe(false); // leap year, 28 不該 match
  });
});

describe("occurrencesInRange", () => {
  it("回傳 from..to 範圍內所有 occur 的日期", () => {
    const r: RecurrenceRule = {
      ...baseDaily,
      preset: "weekly",
      weekdays: "1", // Mon
    };
    expect(occurrencesInRange(r, "2026-04-01", "2026-04-30")).toEqual([
      "2026-04-06",
      "2026-04-13",
      "2026-04-20",
      "2026-04-27",
    ]);
  });

  it("daily 在範圍內全部回傳", () => {
    const result = occurrencesInRange(baseDaily, "2026-04-01", "2026-04-03");
    expect(result).toEqual(["2026-04-01", "2026-04-02", "2026-04-03"]);
  });
});

describe("assignmentsToReap", () => {
  const today = "2026-05-28";
  // 規則改成只 daily 5/22–5/23（縮窗後的新規則）
  const narrowed: RecurrenceRule = {
    ...baseDaily,
    startDate: "2026-05-22",
    endDate: "2026-05-23",
  };

  it("回收未來、落在新窗外、未完成未跳過的 occurrence", () => {
    // 5/28 在 today 之後且超出 5/23 → 該回收（重現 Premium EDM 孤兒）
    const result = assignmentsToReap(
      [{ date: "2026-05-30", isCompleted: false, isSkipped: false }],
      narrowed,
      today,
    );
    expect(result).toEqual(["2026-05-30"]);
  });

  it("保留落在新窗內的未來 occurrence", () => {
    const wide: RecurrenceRule = { ...narrowed, endDate: "2026-06-30" };
    const result = assignmentsToReap(
      [{ date: "2026-05-30", isCompleted: false, isSkipped: false }],
      wide,
      today,
    );
    expect(result).toEqual([]);
  });

  it("不動過去與今天的 occurrence（保留歷史 / 不中途抽走）", () => {
    const result = assignmentsToReap(
      [
        { date: "2026-05-23", isCompleted: false, isSkipped: false }, // 過去
        { date: today, isCompleted: false, isSkipped: false }, // 今天
      ],
      narrowed,
      today,
    );
    expect(result).toEqual([]);
  });

  it("不回收已完成或已跳過的未來 occurrence", () => {
    const result = assignmentsToReap(
      [
        { date: "2026-05-30", isCompleted: true, isSkipped: false },
        { date: "2026-05-31", isCompleted: false, isSkipped: true },
      ],
      narrowed,
      today,
    );
    expect(result).toEqual([]);
  });

  it("rule = null（刪除 recurrence）回收所有未來未完成未跳過", () => {
    const result = assignmentsToReap(
      [
        { date: "2026-05-30", isCompleted: false, isSkipped: false },
        { date: "2026-06-01", isCompleted: false, isSkipped: false },
        { date: "2026-05-23", isCompleted: false, isSkipped: false }, // 過去 → 保留
        { date: "2026-05-30", isCompleted: true, isSkipped: false }, // 已完成 → 保留
      ],
      null,
      today,
    );
    expect(result).toEqual(["2026-05-30", "2026-06-01"]);
  });
});

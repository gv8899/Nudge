/**
 * 重複任務規則的純函式判斷。給 server 在 lazy materialization 時用，
 * 同款邏輯也鏡像在 iOS NudgeCore/RecurrenceCalculator.swift 給 client
 * 算未來 occurrences (給 local notification 排程)。
 *
 * 兩邊都要對得上 — 改其中一邊時兩邊測試都要過。
 */

export interface RecurrenceRule {
  preset:
    | "daily"
    | "weekdays"
    | "weekly"
    | "biweekly"
    | "monthly_day"
    | "monthly_nth_weekday"
    | "yearly";
  weekdays: string | null; // CSV "1,3,5", ISO weekday: 1=Mon..7=Sun
  monthDay: number | null; // 1..31
  monthNth: number | null; // 1..5 (5 = last)
  monthNthWeekday: number | null; // 1..7
  startDate: string; // YYYY-MM-DD
  endDate: string | null; // YYYY-MM-DD or null
}

/** YYYY-MM-DD → UTC Date at midnight (避免 local timezone 漂移影響日期比對) */
function parseISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** ISO weekday: 1=Mon..7=Sun (跟 web / iOS 兩邊都用同一份慣例) */
function isoWeekday(d: Date): number {
  const w = d.getUTCDay(); // 0=Sun..6=Sat
  return w === 0 ? 7 : w;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function lastDayOfMonth(year: number, monthZeroBased: number): number {
  // monthZeroBased+1, day 0 = previous month's last day
  return new Date(Date.UTC(year, monthZeroBased + 1, 0)).getUTCDate();
}

/** 該日期是否落在 rule 的 occurrence 上。 */
export function occurs(dateStr: string, rule: RecurrenceRule): boolean {
  const date = parseISODate(dateStr);
  const start = parseISODate(rule.startDate);
  if (date < start) return false;
  if (rule.endDate) {
    const end = parseISODate(rule.endDate);
    if (date > end) return false;
  }

  switch (rule.preset) {
    case "daily":
      return true;

    case "weekdays": {
      const w = isoWeekday(date);
      return w >= 1 && w <= 5;
    }

    case "weekly": {
      if (!rule.weekdays) return false;
      const w = isoWeekday(date);
      return rule.weekdays.split(",").map(Number).includes(w);
    }

    case "biweekly": {
      if (!rule.weekdays) return false;
      const w = isoWeekday(date);
      if (!rule.weekdays.split(",").map(Number).includes(w)) return false;
      const weeks = Math.floor(daysBetween(start, date) / 7);
      return weeks % 2 === 0;
    }

    case "monthly_day": {
      if (rule.monthDay == null) return false;
      const dom = date.getUTCDate();
      return dom === rule.monthDay;
      // 月底邊界 (e.g. 31 號規則遇 2 月) 自然不會 match — Date 物件不會
      // 把 2/31 變成 3/3，所以 dom 就是該月真正存在的那天。
    }

    case "monthly_nth_weekday": {
      if (rule.monthNth == null || rule.monthNthWeekday == null) return false;
      const w = isoWeekday(date);
      if (w !== rule.monthNthWeekday) return false;
      const dom = date.getUTCDate();
      if (rule.monthNth === 5) {
        // 第 5 個 = 最後一個。判斷該日離月底 7 天內就是該月最後一個 W
        const last = lastDayOfMonth(
          date.getUTCFullYear(),
          date.getUTCMonth(),
        );
        return dom > last - 7;
      }
      const lower = (rule.monthNth - 1) * 7 + 1;
      const upper = rule.monthNth * 7;
      return dom >= lower && dom <= upper;
    }

    case "yearly": {
      const m = date.getUTCMonth();
      const d = date.getUTCDate();
      const sm = start.getUTCMonth();
      const sd = start.getUTCDate();
      if (m === sm && d === sd) return true;
      // 2/29 規則在平年 → 退到 2/28
      if (sm === 1 && sd === 29 && m === 1 && d === 28) {
        const last = lastDayOfMonth(date.getUTCFullYear(), 1);
        return last === 28;
      }
      return false;
    }
  }
}

/**
 * 計算 [fromISO, toISO] 範圍內 (含端點) rule 所有 occur 的日期。
 * 給 iOS notification scheduler 算「未來 30 天」用。
 */
export function occurrencesInRange(
  rule: RecurrenceRule,
  fromISO: string,
  toISO: string,
): string[] {
  const from = parseISODate(fromISO);
  const to = parseISODate(toISO);
  const result: string[] = [];
  for (
    let cur = new Date(from);
    cur <= to;
    cur.setUTCDate(cur.getUTCDate() + 1)
  ) {
    const iso = cur.toISOString().slice(0, 10);
    if (occurs(iso, rule)) result.push(iso);
  }
  return result;
}

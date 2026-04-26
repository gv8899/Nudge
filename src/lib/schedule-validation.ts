/**
 * 結束日必須晚於起始日（不可同日）。null 表示不設結束 → 永遠有效。
 * 字串 "YYYY-MM-DD" 比對直接用字串比即可（lexicographic == chronological）。
 */
export function validateEndAfterStart(
  start: string,
  end: string | null,
): boolean {
  if (end === null) return true;
  return end > start;
}

/**
 * 每週 / 每兩週 必須至少選一個 weekday。其他 preset 不檢查。
 */
export function validateWeeklyHasWeekday(
  preset: string,
  weekdaysCsv: string | null,
): boolean {
  if (preset !== "weekly" && preset !== "biweekly") return true;
  const set = parseWeekdaysCsv(weekdaysCsv);
  return set.size > 0;
}

/** ISO weekday 1=Mon..7=Sun。Skip 非 1-7 整數。 */
export function parseWeekdaysCsv(csv: string | null): Set<number> {
  if (!csv) return new Set();
  return new Set(
    csv
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= 7),
  );
}

export function weekdaysToCsv(set: Set<number>): string {
  return [...set].sort((a, b) => a - b).join(",");
}

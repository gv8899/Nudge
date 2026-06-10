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

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

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

import Foundation

/// Pure functions for computing the 6-week fixed month grid used by
/// `CalendarMonthView`. Kept separate so the date maths is unit-testable
/// without spinning up SwiftUI.
public enum CalendarMonthGrid {
    /// Returns a 6-row × 7-column grid of dates covering the month that
    /// contains `anchor`. Padded with days from the previous and next
    /// months so every row has 7 dates. First column respects
    /// `calendar.firstWeekday`.
    public static func dates(
        forMonthContaining anchor: Date,
        calendar: Calendar
    ) -> [[Date]] {
        guard let monthStart = calendar.date(
            from: calendar.dateComponents([.year, .month], from: anchor)
        ) else { return [] }

        // Find the weekday of the 1st, then walk back to grid start.
        let firstWeekday = calendar.component(.weekday, from: monthStart)
        let shift = (firstWeekday - calendar.firstWeekday + 7) % 7
        guard let gridStart = calendar.date(byAdding: .day, value: -shift, to: monthStart)
        else { return [] }

        // 6 weeks × 7 days = 42 cells.
        var rows: [[Date]] = []
        for week in 0..<6 {
            var row: [Date] = []
            for day in 0..<7 {
                let offset = week * 7 + day
                if let d = calendar.date(byAdding: .day, value: offset, to: gridStart) {
                    row.append(d)
                }
            }
            rows.append(row)
        }
        return rows
    }
}

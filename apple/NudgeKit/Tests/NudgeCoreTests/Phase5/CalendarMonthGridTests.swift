import Testing
import Foundation
@testable import NudgeUI

@Suite("CalendarMonthGrid", .serialized)
struct CalendarMonthGridTests {
    let calendar: Calendar = {
        var c = Calendar(identifier: .gregorian)
        c.firstWeekday = 2 // Monday
        c.timeZone = TimeZone(identifier: "UTC")!
        return c
    }()

    private func date(_ y: Int, _ m: Int, _ d: Int) -> Date {
        DateComponents(calendar: calendar, year: y, month: m, day: d).date!
    }

    @Test func aprilSixWeekGrid() {
        // April 2026: 1 Apr is Wed. Grid starts Mon 30 Mar, 6 weeks × 7.
        let grid = CalendarMonthGrid.dates(forMonthContaining: date(2026, 4, 15), calendar: calendar)
        #expect(grid.count == 6)
        for week in grid { #expect(week.count == 7) }
        #expect(calendar.component(.day, from: grid[0][0]) == 30)
        #expect(calendar.component(.day, from: grid[0][1]) == 31)
        #expect(calendar.component(.day, from: grid[0][2]) == 1)
    }

    @Test func februaryLeapYearGrid() {
        // Feb 2028 is leap: 29 days.
        let grid = CalendarMonthGrid.dates(forMonthContaining: date(2028, 2, 10), calendar: calendar)
        #expect(grid.count == 6)
        let allDays = grid.flatMap { $0 }
        let feb29Count = allDays.filter {
            calendar.component(.year, from: $0) == 2028 &&
            calendar.component(.month, from: $0) == 2 &&
            calendar.component(.day, from: $0) == 29
        }.count
        #expect(feb29Count == 1)
    }
}

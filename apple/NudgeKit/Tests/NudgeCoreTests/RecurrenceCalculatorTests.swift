import XCTest
@testable import NudgeCore

final class RecurrenceCalculatorTests: XCTestCase {
    private func rule(
        preset: RecurrencePreset = .daily,
        weekdays: String? = nil,
        monthDay: Int? = nil,
        monthNth: Int? = nil,
        monthNthWeekday: Int? = nil,
        startDate: String = "2026-04-01",
        endDate: String? = nil
    ) -> TaskRecurrenceDTO {
        TaskRecurrenceDTO(
            id: "x", taskId: "t", preset: preset,
            weekdays: weekdays, monthDay: monthDay,
            monthNth: monthNth, monthNthWeekday: monthNthWeekday,
            startDate: startDate, endDate: endDate,
            remindAtTimeOfDay: nil, createdAt: "", updatedAt: ""
        )
    }

    // MARK: - daily

    func test_daily_alwaysTrueAfterStart() {
        let r = rule()
        XCTAssertTrue(RecurrenceCalculator.occurs(date: "2026-04-01", rule: r))
        XCTAssertTrue(RecurrenceCalculator.occurs(date: "2026-04-15", rule: r))
        XCTAssertTrue(RecurrenceCalculator.occurs(date: "2027-01-01", rule: r))
    }

    func test_daily_beforeStart_false() {
        let r = rule()
        XCTAssertFalse(RecurrenceCalculator.occurs(date: "2026-03-31", rule: r))
    }

    func test_daily_afterEnd_falseInclusive() {
        let r = rule(endDate: "2026-04-30")
        XCTAssertTrue(RecurrenceCalculator.occurs(date: "2026-04-30", rule: r))
        XCTAssertFalse(RecurrenceCalculator.occurs(date: "2026-05-01", rule: r))
    }

    // MARK: - weekdays

    func test_weekdaysMonFri() {
        let r = rule(preset: .weekdays)
        XCTAssertFalse(RecurrenceCalculator.occurs(date: "2026-04-25", rule: r)) // Sat
        XCTAssertFalse(RecurrenceCalculator.occurs(date: "2026-04-26", rule: r)) // Sun
        XCTAssertTrue(RecurrenceCalculator.occurs(date: "2026-04-27", rule: r))  // Mon
        XCTAssertTrue(RecurrenceCalculator.occurs(date: "2026-05-01", rule: r))  // Fri
    }

    // MARK: - weekly

    func test_weekly_csv() {
        let r = rule(preset: .weekly, weekdays: "1,3,5")
        XCTAssertTrue(RecurrenceCalculator.occurs(date: "2026-04-27", rule: r))  // Mon
        XCTAssertTrue(RecurrenceCalculator.occurs(date: "2026-04-29", rule: r))  // Wed
        XCTAssertTrue(RecurrenceCalculator.occurs(date: "2026-05-01", rule: r))  // Fri
        XCTAssertFalse(RecurrenceCalculator.occurs(date: "2026-04-28", rule: r)) // Tue
        XCTAssertFalse(RecurrenceCalculator.occurs(date: "2026-04-30", rule: r)) // Thu
    }

    // MARK: - biweekly

    func test_biweekly_evenWeeksOnly() {
        let r = rule(preset: .biweekly, weekdays: "1", startDate: "2026-04-06") // Mon
        XCTAssertTrue(RecurrenceCalculator.occurs(date: "2026-04-06", rule: r))  // week 0
        XCTAssertFalse(RecurrenceCalculator.occurs(date: "2026-04-13", rule: r)) // week 1
        XCTAssertTrue(RecurrenceCalculator.occurs(date: "2026-04-20", rule: r))  // week 2
        XCTAssertFalse(RecurrenceCalculator.occurs(date: "2026-04-27", rule: r)) // week 3
        XCTAssertTrue(RecurrenceCalculator.occurs(date: "2026-05-04", rule: r))  // week 4
    }

    // MARK: - monthly_day

    func test_monthly_day_simple() {
        let r = rule(preset: .monthly_day, monthDay: 5)
        XCTAssertTrue(RecurrenceCalculator.occurs(date: "2026-04-05", rule: r))
        XCTAssertFalse(RecurrenceCalculator.occurs(date: "2026-04-06", rule: r))
        XCTAssertTrue(RecurrenceCalculator.occurs(date: "2026-05-05", rule: r))
        XCTAssertTrue(RecurrenceCalculator.occurs(date: "2027-01-05", rule: r))
    }

    func test_monthly_day_endOfMonthSkip() {
        let r = rule(preset: .monthly_day, monthDay: 31, startDate: "2026-01-01")
        XCTAssertTrue(RecurrenceCalculator.occurs(date: "2026-01-31", rule: r))
        XCTAssertFalse(RecurrenceCalculator.occurs(date: "2026-02-28", rule: r))
        XCTAssertTrue(RecurrenceCalculator.occurs(date: "2026-03-31", rule: r))
        XCTAssertFalse(RecurrenceCalculator.occurs(date: "2026-04-30", rule: r))
    }

    // MARK: - monthly_nth_weekday

    func test_monthly_nth_thirdTuesday() {
        let r = rule(preset: .monthly_nth_weekday, monthNth: 3, monthNthWeekday: 2)
        XCTAssertTrue(RecurrenceCalculator.occurs(date: "2026-04-21", rule: r))
        XCTAssertFalse(RecurrenceCalculator.occurs(date: "2026-04-14", rule: r))
        XCTAssertFalse(RecurrenceCalculator.occurs(date: "2026-04-28", rule: r))
    }

    func test_monthly_nth_lastFriday() {
        let r = rule(preset: .monthly_nth_weekday, monthNth: 5, monthNthWeekday: 5)
        XCTAssertTrue(RecurrenceCalculator.occurs(date: "2026-04-24", rule: r))
        XCTAssertFalse(RecurrenceCalculator.occurs(date: "2026-04-17", rule: r))
        XCTAssertTrue(RecurrenceCalculator.occurs(date: "2026-05-29", rule: r))
        XCTAssertFalse(RecurrenceCalculator.occurs(date: "2026-05-22", rule: r))
    }

    // MARK: - yearly

    func test_yearly_monthDay() {
        let r = rule(preset: .yearly, startDate: "2026-04-01")
        XCTAssertTrue(RecurrenceCalculator.occurs(date: "2026-04-01", rule: r))
        XCTAssertTrue(RecurrenceCalculator.occurs(date: "2027-04-01", rule: r))
        XCTAssertTrue(RecurrenceCalculator.occurs(date: "2028-04-01", rule: r))
        XCTAssertFalse(RecurrenceCalculator.occurs(date: "2027-04-02", rule: r))
    }

    func test_yearly_feb29Fallback() {
        let r = rule(preset: .yearly, startDate: "2024-02-29")
        XCTAssertTrue(RecurrenceCalculator.occurs(date: "2024-02-29", rule: r))
        XCTAssertTrue(RecurrenceCalculator.occurs(date: "2025-02-28", rule: r))
        XCTAssertFalse(RecurrenceCalculator.occurs(date: "2025-02-29", rule: r))
        XCTAssertTrue(RecurrenceCalculator.occurs(date: "2028-02-29", rule: r))
        XCTAssertFalse(RecurrenceCalculator.occurs(date: "2028-02-28", rule: r))
    }

    // MARK: - occurrences

    func test_occurrences_weekly() {
        let r = rule(preset: .weekly, weekdays: "1") // Mon
        let result = RecurrenceCalculator.occurrences(rule: r, from: "2026-04-01", to: "2026-04-30")
        XCTAssertEqual(result, ["2026-04-06", "2026-04-13", "2026-04-20", "2026-04-27"])
    }

    func test_occurrences_dailyEnumerates() {
        let r = rule()
        let result = RecurrenceCalculator.occurrences(rule: r, from: "2026-04-01", to: "2026-04-03")
        XCTAssertEqual(result, ["2026-04-01", "2026-04-02", "2026-04-03"])
    }
}

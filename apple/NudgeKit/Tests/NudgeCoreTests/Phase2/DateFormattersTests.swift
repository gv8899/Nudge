import Testing
import Foundation
@testable import NudgeCore

@Suite("DateFormatters") struct DateFormattersTests {
    @Test func formatsISODate() {
        var comps = DateComponents()
        comps.year = 2026; comps.month = 4; comps.day = 17
        comps.timeZone = TimeZone(identifier: "Asia/Taipei")
        let date = Calendar(identifier: .gregorian).date(from: comps)!
        #expect(DateFormatters.isoDate(date, in: TimeZone(identifier: "Asia/Taipei")!) == "2026-04-17")
    }

    @Test func parsesISODate() throws {
        let date = try #require(DateFormatters.parseISODate("2026-04-17", in: TimeZone(identifier: "Asia/Taipei")!))
        let comps = Calendar(identifier: .gregorian).dateComponents(in: TimeZone(identifier: "Asia/Taipei")!, from: date)
        #expect(comps.year == 2026)
        #expect(comps.month == 4)
        #expect(comps.day == 17)
    }

    @Test func startOfWeekMonday() {
        var comps = DateComponents()
        comps.year = 2026; comps.month = 4; comps.day = 17  // Friday
        comps.timeZone = TimeZone(identifier: "Asia/Taipei")
        let date = Calendar(identifier: .gregorian).date(from: comps)!
        let startOfWeek = DateFormatters.startOfWeek(date, in: TimeZone(identifier: "Asia/Taipei")!)
        let startISO = DateFormatters.isoDate(startOfWeek, in: TimeZone(identifier: "Asia/Taipei")!)
        #expect(startISO == "2026-04-13")  // Monday
    }

    @Test func isWeekendDetection() {
        let tz = TimeZone(identifier: "Asia/Taipei")!
        let sat = try! #require(DateFormatters.parseISODate("2026-04-18", in: tz))
        let sun = try! #require(DateFormatters.parseISODate("2026-04-19", in: tz))
        let mon = try! #require(DateFormatters.parseISODate("2026-04-20", in: tz))
        #expect(DateFormatters.isWeekend(sat, in: tz))
        #expect(DateFormatters.isWeekend(sun, in: tz))
        #expect(!DateFormatters.isWeekend(mon, in: tz))
    }
}

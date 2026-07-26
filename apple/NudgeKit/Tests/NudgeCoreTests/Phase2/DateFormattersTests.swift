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

    // MARK: - 快取正確性
    //
    // 這幾條是為了「formatter/calendar 改成跨呼叫共用快取」而補的護欄：
    // 快取一旦用錯 key（或根本沒 key），時區就會被前一次呼叫污染，而且
    // `DateFormatter` 非執行緒安全、併發下會回垃圾字串或直接爆掉。

    /// 同一個瞬間在台北是 4/18、在紐約是 4/17。交錯呼叫必須各自正確 ——
    /// 若共用單一 formatter 而不按時區分流，第二次呼叫會拿到前一次的時區。
    @Test func isoDateIsNotPollutedByInterleavedTimeZones() {
        let taipei = TimeZone(identifier: "Asia/Taipei")!
        let newYork = TimeZone(identifier: "America/New_York")!
        // 2026-04-17T20:00:00Z
        let instant = Date(timeIntervalSince1970: 1_776_456_000)

        for _ in 0..<10 {
            #expect(DateFormatters.isoDate(instant, in: taipei) == "2026-04-18")
            #expect(DateFormatters.isoDate(instant, in: newYork) == "2026-04-17")
        }
    }

    @Test func parseISODateIsNotPollutedByInterleavedTimeZones() throws {
        let taipei = TimeZone(identifier: "Asia/Taipei")!
        let newYork = TimeZone(identifier: "America/New_York")!

        for _ in 0..<10 {
            let inTaipei = try #require(DateFormatters.parseISODate("2026-04-18", in: taipei))
            let inNewYork = try #require(DateFormatters.parseISODate("2026-04-18", in: newYork))
            // 台北午夜比紐約午夜早 12 小時（EDT, UTC-4）。
            #expect(inNewYork.timeIntervalSince(inTaipei) == 12 * 3600)
        }
    }

    @Test func startOfWeekAndIsWeekendAreNotPollutedByInterleavedTimeZones() {
        let taipei = TimeZone(identifier: "Asia/Taipei")!
        let newYork = TimeZone(identifier: "America/New_York")!
        // 2026-04-19T02:00:00Z —— 台北是週日 10:00、紐約是週六 22:00。
        let instant = Date(timeIntervalSince1970: 1_776_564_000)

        for _ in 0..<10 {
            #expect(DateFormatters.isWeekend(instant, in: taipei))
            #expect(DateFormatters.isWeekend(instant, in: newYork))
            #expect(DateFormatters.isoDate(DateFormatters.startOfWeek(instant, in: taipei), in: taipei) == "2026-04-13")
            #expect(DateFormatters.isoDate(DateFormatters.startOfWeek(instant, in: newYork), in: newYork) == "2026-04-13")
        }
    }

    /// 這些 API 同時被 main actor 的 view body 與背景 task 呼叫；共用快取
    /// 若沒上鎖，`DateFormatter` 的非執行緒安全會在這裡現形。
    @Test func isoDateIsSafeUnderConcurrentAccess() {
        let taipei = TimeZone(identifier: "Asia/Taipei")!
        let newYork = TimeZone(identifier: "America/New_York")!
        let instant = Date(timeIntervalSince1970: 1_776_456_000)
        let results = ResultBox()

        DispatchQueue.concurrentPerform(iterations: 500) { i in
            let tz = i.isMultiple(of: 2) ? taipei : newYork
            let expected = i.isMultiple(of: 2) ? "2026-04-18" : "2026-04-17"
            results.record(DateFormatters.isoDate(instant, in: tz) == expected)
        }

        #expect(results.failures == 0)
        #expect(results.total == 500)
    }

    /// `concurrentPerform` 的 closure 是 non-escaping 但會跨執行緒跑，
    /// 用一個上鎖的計數器收集結果（Swift 6 嚴格併發下不能直接捕獲 var）。
    private final class ResultBox: @unchecked Sendable {
        private let lock = NSLock()
        private var _failures = 0
        private var _total = 0

        func record(_ ok: Bool) {
            lock.lock()
            defer { lock.unlock() }
            _total += 1
            if !ok { _failures += 1 }
        }

        var failures: Int { lock.lock(); defer { lock.unlock() }; return _failures }
        var total: Int { lock.lock(); defer { lock.unlock() }; return _total }
    }
}

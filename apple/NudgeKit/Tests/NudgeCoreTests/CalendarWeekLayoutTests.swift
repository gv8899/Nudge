import XCTest
@testable import NudgeUI

/// 這組案例與 web src/lib/calendar-layout.test.ts 鏡像 — 改一邊，兩邊都要改。
final class CalendarWeekLayoutTests: XCTestCase {
    private func iv(_ startMin: Double, _ endMin: Double) -> CalendarWeekLayout.Interval {
        CalendarWeekLayout.Interval(startMin: startMin, endMin: endMin)
    }
    private func pl(_ column: Int, _ columnCount: Int) -> CalendarWeekLayout.Placement {
        CalendarWeekLayout.Placement(column: column, columnCount: columnCount)
    }

    func test_noOverlap_backToBack() {
        // 9:00-10:00, 10:00-11:00 — 相接不算重疊
        let r = CalendarWeekLayout.layoutDayEvents([iv(540, 600), iv(600, 660)])
        XCTAssertEqual(r, [pl(0, 1), pl(0, 1)])
    }

    func test_twoOverlapping_splitColumns() {
        // 9:00-10:30 vs 10:00-11:00
        let r = CalendarWeekLayout.layoutDayEvents([iv(540, 630), iv(600, 660)])
        XCTAssertEqual(r, [pl(0, 2), pl(1, 2)])
    }

    func test_chainOfThree_reusesColumn() {
        // A 9-11, B 10-12, C 11-13 — C 回收 A 的欄
        let r = CalendarWeekLayout.layoutDayEvents([iv(540, 660), iv(600, 720), iv(660, 780)])
        XCTAssertEqual(r, [pl(0, 2), pl(1, 2), pl(0, 2)])
    }

    func test_containment() {
        // A 9-13 包含 B 10-11
        let r = CalendarWeekLayout.layoutDayEvents([iv(540, 780), iv(600, 660)])
        XCTAssertEqual(r, [pl(0, 2), pl(1, 2)])
    }

    func test_zeroLength_occupiesColumn() {
        // A 10:00-10:00（零長度）與 B 10:00-10:30 重疊；同 start 時長者優先 → B col 0
        let r = CalendarWeekLayout.layoutDayEvents([iv(600, 600), iv(600, 630)])
        XCTAssertEqual(r, [pl(1, 2), pl(0, 2)])
    }

    func test_clustersIndependent() {
        // 9-10 與 9:30-10 重疊；13-14 獨立
        let r = CalendarWeekLayout.layoutDayEvents([iv(540, 600), iv(570, 600), iv(780, 840)])
        XCTAssertEqual(r, [pl(0, 2), pl(1, 2), pl(0, 1)])
    }

    func test_emptyInput() {
        XCTAssertEqual(CalendarWeekLayout.layoutDayEvents([]), [])
    }
}

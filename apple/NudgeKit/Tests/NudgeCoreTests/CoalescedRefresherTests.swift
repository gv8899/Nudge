import Testing
@testable import NudgeCore

@MainActor
@Suite("CoalescedRefresher")
struct CoalescedRefresherTests {
    @Test("連續多次 request 只在 delay 後跑一次")
    func coalescesRapidRequests() async throws {
        var runs = 0
        let refresher = CoalescedRefresher(delay: .milliseconds(50)) { runs += 1 }
        for _ in 0..<5 { refresher.request() }
        #expect(runs == 0)
        try await Task.sleep(for: .milliseconds(250))
        #expect(runs == 1)
        #expect(refresher.runCount == 1)
    }

    @Test("執行中收到 request → 結束後恰好再跑一次")
    func requestDuringRunSchedulesExactlyOneMore() async throws {
        var runs = 0
        let refresher = CoalescedRefresher(delay: .milliseconds(50)) {
            runs += 1
            try? await Task.sleep(for: .milliseconds(300))
        }
        refresher.request()
        // 等 debounce 觸發、action 開始執行（50ms 後），action 會跑到 ~350ms。
        try await Task.sleep(for: .milliseconds(120))
        #expect(runs == 1)
        // 執行中連發多次 → 只該補一次。
        refresher.request()
        refresher.request()
        try await Task.sleep(for: .milliseconds(100))
        refresher.request()
        // 第一次 ~350ms 結束 → 補跑一次（再 300ms）→ ~650ms 結束。
        try await Task.sleep(for: .milliseconds(900))
        #expect(runs == 2)
        #expect(refresher.runCount == 2)
    }

    @Test("delay 到之前 cancel → 不執行")
    func cancelBeforeDelay() async throws {
        var runs = 0
        let refresher = CoalescedRefresher(delay: .milliseconds(50)) { runs += 1 }
        refresher.request()
        refresher.request()
        refresher.cancel()
        try await Task.sleep(for: .milliseconds(200))
        #expect(runs == 0)
        #expect(refresher.runCount == 0)
    }
}

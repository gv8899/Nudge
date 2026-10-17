import Testing
import Foundation
@testable import NudgeCore

@Suite("RemoteChangeDecision") struct RemoteChangeDecisionTests {
    let base = NudgeISO8601.date(from: "2026-10-17T10:00:00.000Z")!
    let newer = NudgeISO8601.date(from: "2026-10-17T10:00:05.000Z")!
    let sameSec = NudgeISO8601.date(from: "2026-10-17T10:00:00.900Z")!

    @Test func otherCardIsListOnly() {
        #expect(RemoteChangeDecision.decide(event: .task(id: "x", updatedAt: newer), cardId: "c1", base: base, hasPending: false) == .listOnly)
        #expect(RemoteChangeDecision.decide(event: .any, cardId: "c1", base: base, hasPending: false) == .listOnly)
    }
    @Test func newerWithoutPendingApplies() {
        #expect(RemoteChangeDecision.decide(event: .task(id: "c1", updatedAt: newer), cardId: "c1", base: base, hasPending: false) == .apply)
        #expect(RemoteChangeDecision.decide(event: .task(id: "c1", updatedAt: newer), cardId: "c1", base: nil, hasPending: false) == .apply)
    }
    @Test func echoAndOlderAreIgnored() {
        #expect(RemoteChangeDecision.decide(event: .task(id: "c1", updatedAt: sameSec), cardId: "c1", base: base, hasPending: false) == .ignore)
        #expect(RemoteChangeDecision.decide(event: .task(id: "c1", updatedAt: base), cardId: "c1", base: newer, hasPending: false) == .ignore)
    }
    @Test func pendingEditsIgnore() {
        #expect(RemoteChangeDecision.decide(event: .task(id: "c1", updatedAt: newer), cardId: "c1", base: base, hasPending: true) == .ignore)
    }
}

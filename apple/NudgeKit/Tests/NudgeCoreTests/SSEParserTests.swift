import Testing
import Foundation
@testable import NudgeCore

@Suite("SSEParser") struct SSEParserTests {
    @Test func parsesTaskEventTerminatedByBlankLine() {
        var p = SSEParser()
        #expect(p.feed(line: "event: change") == nil)
        #expect(p.feed(line: #"data: {"kind":"task","id":"c1","updatedAt":"2026-10-17T10:00:00.000Z"}"#) == nil)
        let ev = p.feed(line: "")
        #expect(ev == .task(id: "c1", updatedAt: NudgeISO8601.date(from: "2026-10-17T10:00:00.000Z")!))
    }
    @Test func ignoresHeartbeatAndUnknownEventNames() {
        var p = SSEParser()
        #expect(p.feed(line: ": ping") == nil)
        #expect(p.feed(line: "") == nil)
        #expect(p.feed(line: "event: other") == nil)
        #expect(p.feed(line: #"data: {"kind":"any"}"#) == nil)
        #expect(p.feed(line: "") == nil)   // event 名不是 change → 丟掉
    }
    @Test func anyEventAndMultilineData() {
        var p = SSEParser()
        _ = p.feed(line: "event: change")
        _ = p.feed(line: #"data: {"kind":"#)
        _ = p.feed(line: #"data: "any"}"#)
        #expect(p.feed(line: "") == .any)   // 多行 data 以 \n 接起來後仍是合法 JSON
    }
    @Test func badJSONYieldsNilAndResets() {
        var p = SSEParser()
        _ = p.feed(line: "event: change")
        _ = p.feed(line: "data: {nope")
        #expect(p.feed(line: "") == nil)
        _ = p.feed(line: "event: change")
        _ = p.feed(line: #"data: {"kind":"any"}"#)
        #expect(p.feed(line: "") == .any)
    }
}

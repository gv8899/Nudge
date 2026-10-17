import Testing
import Foundation
@testable import NudgeCore

@Suite("SyncStreamClient", .serialized) struct SyncStreamClientTests {
    @Test func backoffDoublesAndCaps() {
        #expect(SyncStreamClient.nextBackoff(after: nil, min: 1, max: 30) == 1)
        #expect(SyncStreamClient.nextBackoff(after: 1, min: 1, max: 30) == 2)
        #expect(SyncStreamClient.nextBackoff(after: 16, min: 1, max: 30) == 30)
        #expect(SyncStreamClient.nextBackoff(after: 30, min: 1, max: 30) == 30)
    }

    @MainActor @Test func postsChangeNotificationsFromStream() async throws {
        MockURLProtocol.handler = { request in
            #expect(request.url?.path == "/api/sync/events")
            #expect(request.value(forHTTPHeaderField: "Accept") == "text/event-stream")
            #expect(request.value(forHTTPHeaderField: "Authorization") == "Bearer t")
            let body = """
            : connected

            event: change
            data: {"kind":"task","id":"c1","updatedAt":"2026-10-17T10:00:00.000Z"}

            event: change
            data: {"kind":"any"}

            """
            let response = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil,
                                           headerFields: ["Content-Type": "text/event-stream"])!
            return (body.data(using: .utf8)!, response)
        }
        let api = APIClient(configuration: APIConfiguration(baseURL: URL(string: "https://test.local")!),
                            session: .mocked(), tokenProvider: { "t" })
        let sync = SyncStreamClient(client: api, minBackoff: 60, maxBackoff: 60) // 串流結束後會進 backingOff，60s 內不會重連

        var got: [SyncEvent] = []
        let token = NotificationCenter.default.addObserver(forName: NudgeSync.changeNotification, object: nil, queue: .main) { n in
            if let box = n.userInfo?[NudgeSync.eventKey] as? SyncEventBox { got.append(box.event) }
        }
        defer { NotificationCenter.default.removeObserver(token) }

        sync.start()
        try await Task.sleep(nanoseconds: 500_000_000)
        sync.stop()

        #expect(got == [.task(id: "c1", updatedAt: NudgeISO8601.date(from: "2026-10-17T10:00:00.000Z")!), .any])
        #expect(sync.state == .idle)
    }

    @MainActor @Test func unauthorizedStopsWithoutRetry() async throws {
        MockURLProtocol.handler = { request in
            (Data(), HTTPURLResponse(url: request.url!, statusCode: 401, httpVersion: nil, headerFields: nil)!)
        }
        let api = APIClient(configuration: APIConfiguration(baseURL: URL(string: "https://test.local")!), session: .mocked())
        let sync = SyncStreamClient(client: api)
        sync.start()
        try await Task.sleep(nanoseconds: 300_000_000)
        #expect(sync.state == .stopped(reason: "unauthorized"))
        sync.stop()
    }
}

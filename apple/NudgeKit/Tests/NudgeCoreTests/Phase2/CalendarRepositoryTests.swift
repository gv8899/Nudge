import Testing
import Foundation
@testable import NudgeCore

@Suite("CalendarRepository", .serialized) @MainActor
struct CalendarRepositoryTests {
    @Test func eventsDecodesListResponse() async throws {
        MockURLProtocol.handler = { request in
            let body = """
            {"connected":true,"events":[{"id":"e1","calendarId":"cal@example.com","calendarName":"Primary","title":"Meeting","start":"2026-04-17T09:00:00+08:00","end":"2026-04-17T10:00:00+08:00","allDay":false,"location":null,"description":null,"attendees":[],"htmlLink":"https://example.com/e1","hangoutLink":"","busyOnly":false}]}
            """
            let data = body.data(using: .utf8)!
            let response = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!
            return (data, response)
        }
        let client = APIClient(
            configuration: APIConfiguration(baseURL: URL(string: "https://test.local")!),
            session: .mocked()
        )
        let repo = CalendarRepository(client: client)
        let events = try await repo.events(date: "2026-04-17")
        #expect(events.count == 1)
        #expect(events.first?.title == "Meeting")
        #expect(repo.isConnected == true)
    }

    @Test func eventsSetsNotConnectedOnDisconnectedResponse() async throws {
        // Real server shape when Google Calendar is not linked: 200 OK with
        // {connected:false, reason:...}; repo should flip isConnected=false
        // and return empty events (no throw).
        MockURLProtocol.handler = { request in
            let data = "{\"connected\":false,\"reason\":\"reauth_required\"}".data(using: .utf8)!
            let response = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!
            return (data, response)
        }
        let client = APIClient(
            configuration: APIConfiguration(baseURL: URL(string: "https://test.local")!),
            session: .mocked()
        )
        let repo = CalendarRepository(client: client)
        let events = try await repo.events(date: "2026-04-17")
        #expect(events.isEmpty)
        #expect(repo.isConnected == false)
    }
}

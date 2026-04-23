import Testing
import Foundation
@testable import NudgeCore

@Suite("CalendarRepository.events range", .serialized) @MainActor
struct CalendarRepositoryRangeTests {
    @Test func rangeQueryIncludesEndDate() async throws {
        nonisolated(unsafe) var capturedURL: URL?
        MockURLProtocol.handler = { request in
            capturedURL = request.url
            let body = #"{"connected":true,"events":[]}"#
            let data = body.data(using: .utf8)!
            let response = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!
            return (data, response)
        }
        let client = APIClient(
            configuration: APIConfiguration(baseURL: URL(string: "https://test.local")!),
            session: .mocked()
        )
        let repo = CalendarRepository(client: client)
        _ = try await repo.events(start: "2026-04-24", end: "2026-04-30")
        let query = capturedURL?.query ?? ""
        #expect(query.contains("date=2026-04-24"))
        #expect(query.contains("endDate=2026-04-30"))
    }
}

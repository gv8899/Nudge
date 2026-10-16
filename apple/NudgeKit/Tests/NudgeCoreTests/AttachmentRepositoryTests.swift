import Testing
import Foundation
@testable import NudgeCore

@Suite("AttachmentRepository", .serialized) struct AttachmentRepositoryTests {
    private func makeClient() -> APIClient {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [MockURLProtocol.self]
        return APIClient(
            configuration: APIConfiguration(baseURL: URL(string: "https://example.test")!),
            session: URLSession(configuration: config),
            tokenProvider: { "tok" }
        )
    }

    @Test @MainActor func fetchesBytesWithBearerAndCachesSecondHit() async throws {
        var hits = 0
        MockURLProtocol.handler = { request in
            hits += 1
            #expect(request.url?.path == "/api/attachments/abc")
            #expect(request.value(forHTTPHeaderField: "Authorization") == "Bearer tok")
            let data = Data([0xff, 0xd8, 0xff])
            let response = HTTPURLResponse(
                url: request.url!, statusCode: 200, httpVersion: nil,
                headerFields: ["Content-Type": "image/jpeg"]
            )!
            return (data, response)
        }
        let repo = AttachmentRepository(client: makeClient())
        let (d1, m1) = try await repo.imageData(id: "abc")
        #expect(d1 == Data([0xff, 0xd8, 0xff]))
        #expect(m1 == "image/jpeg")
        let (d2, _) = try await repo.imageData(id: "abc")
        #expect(d2 == d1)
        #expect(hits == 1)
    }

    @Test @MainActor func notFoundThrows() async {
        MockURLProtocol.handler = { request in
            let response = HTTPURLResponse(url: request.url!, statusCode: 404, httpVersion: nil, headerFields: nil)!
            return (Data("{\"error\":\"Not found\"}".utf8), response)
        }
        let repo = AttachmentRepository(client: makeClient())
        await #expect(throws: (any Error).self) {
            _ = try await repo.imageData(id: "nope")
        }
    }
}

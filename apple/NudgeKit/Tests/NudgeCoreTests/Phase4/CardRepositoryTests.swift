import Testing
import Foundation
@testable import NudgeCore

@Suite("CardRepository", .serialized) @MainActor
struct CardRepositoryTests {
    @Test func listSendsQueryAndCursor() async throws {
        var capturedURL: URL?
        MockURLProtocol.handler = { request in
            capturedURL = request.url
            let data = #"{"cards":[],"nextCursor":null}"#.data(using: .utf8)!
            let response = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!
            return (data, response)
        }
        let client = APIClient(
            configuration: APIConfiguration(baseURL: URL(string: "https://test.local")!),
            session: .mocked()
        )
        let repo = CardRepository(client: client)
        _ = try await repo.list(query: "hello", cursor: "2026-04-17T00:00:00Z", limit: 20)

        #expect(capturedURL?.absoluteString.contains("q=hello") == true)
        #expect(capturedURL?.absoluteString.contains("cursor=2026-04-17T00%3A00%3A00Z") == true)
        #expect(capturedURL?.absoluteString.contains("limit=20") == true)
    }

    @Test func listOmitsQueryWhenEmpty() async throws {
        var capturedURL: URL?
        MockURLProtocol.handler = { request in
            capturedURL = request.url
            let data = #"{"cards":[],"nextCursor":null}"#.data(using: .utf8)!
            let response = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!
            return (data, response)
        }
        let client = APIClient(
            configuration: APIConfiguration(baseURL: URL(string: "https://test.local")!),
            session: .mocked()
        )
        let repo = CardRepository(client: client)
        _ = try await repo.list(query: "", cursor: nil, limit: 20)

        #expect(capturedURL?.absoluteString.contains("q=") == false)
        #expect(capturedURL?.absoluteString.contains("cursor=") == false)
    }

    @Test func createPostsTaskAndReturnsCard() async throws {
        var capturedMethod: String?
        var capturedBody: String?
        MockURLProtocol.handler = { request in
            capturedMethod = request.httpMethod
            if let stream = request.httpBodyStream {
                stream.open()
                defer { stream.close() }
                var data = Data()
                let bufSize = 1024
                let buf = UnsafeMutablePointer<UInt8>.allocate(capacity: bufSize)
                defer { buf.deallocate() }
                while stream.hasBytesAvailable {
                    let read = stream.read(buf, maxLength: bufSize)
                    if read <= 0 { break }
                    data.append(buf, count: read)
                }
                capturedBody = String(data: data, encoding: .utf8)
            }
            let responseBody = """
            {"id":"c1","title":"","description":"<p></p>","status":"inbox","createdAt":"2026-04-17T10:00:00.000Z","updatedAt":"2026-04-17T10:00:00.000Z"}
            """
            let data = responseBody.data(using: .utf8)!
            let response = HTTPURLResponse(url: request.url!, statusCode: 201, httpVersion: nil, headerFields: nil)!
            return (data, response)
        }
        let client = APIClient(
            configuration: APIConfiguration(baseURL: URL(string: "https://test.local")!),
            session: .mocked()
        )
        let repo = CardRepository(client: client)
        let card = try await repo.create()

        #expect(capturedMethod == "POST")
        #expect(capturedBody?.contains("\"title\":\"\"") == true)
        #expect(capturedBody?.contains("\"description\":\"<p></p>\"") == true)
        #expect(capturedBody?.contains("\"status\":\"inbox\"") == true)
        #expect(card.id == "c1")
        #expect(card.description == "<p></p>")
    }
}

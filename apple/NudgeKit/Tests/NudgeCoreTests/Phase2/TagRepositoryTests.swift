import Testing
import Foundation
@testable import NudgeCore

@Suite("TagRepository", .serialized) @MainActor
struct TagRepositoryTests {
    @Test func listFetchesAndCaches() async throws {
        MockURLProtocol.handler = { request in
            let data = "{\"tags\":[{\"id\":\"t1\",\"name\":\"Work\",\"color\":\"#5a7050\",\"sortOrder\":0}]}".data(using: .utf8)!
            let response = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!
            return (data, response)
        }
        let client = APIClient(
            configuration: APIConfiguration(baseURL: URL(string: "https://test.local")!),
            session: .mocked()
        )
        let repo = TagRepository(client: client)
        let tags = try await repo.list()
        #expect(tags.count == 1)
        #expect(tags.first?.name == "Work")
    }

    @Test func secondListUsesCache() async throws {
        actor CallCounter {
            var count = 0
            func increment() { count += 1 }
        }
        let counter = CallCounter()

        MockURLProtocol.handler = { request in
            Task { await counter.increment() }
            let data = #"{"tags":[]}"#.data(using: .utf8)!
            let response = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!
            return (data, response)
        }

        let client = APIClient(
            configuration: APIConfiguration(baseURL: URL(string: "https://test.local")!),
            session: .mocked()
        )
        let repo = TagRepository(client: client)
        _ = try await repo.list()
        _ = try await repo.list()

        try await Task.sleep(for: .milliseconds(50))
        #expect(await counter.count == 1)
    }

    @Test func invalidateForcesRefetch() async throws {
        actor CallCounter {
            var count = 0
            func increment() { count += 1 }
        }
        let counter = CallCounter()

        MockURLProtocol.handler = { request in
            Task { await counter.increment() }
            let data = #"{"tags":[]}"#.data(using: .utf8)!
            let response = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!
            return (data, response)
        }

        let client = APIClient(
            configuration: APIConfiguration(baseURL: URL(string: "https://test.local")!),
            session: .mocked()
        )
        let repo = TagRepository(client: client)
        _ = try await repo.list()
        repo.invalidate()
        _ = try await repo.list()

        try await Task.sleep(for: .milliseconds(50))
        #expect(await counter.count == 2)
    }
}

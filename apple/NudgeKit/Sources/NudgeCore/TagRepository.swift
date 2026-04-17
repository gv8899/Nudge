import Foundation
import Observation

@Observable
@MainActor
public final class TagRepository {
    private let client: APIClient
    private var cache: [TagDTO]?

    public init(client: APIClient) {
        self.client = client
    }

    public func list() async throws -> [TagDTO] {
        if let cache {
            return cache
        }
        let response: TagsResponse = try await client.get("/api/tags")
        cache = response.tags
        return response.tags
    }

    public func invalidate() {
        cache = nil
    }

    private struct TagsResponse: Codable {
        let tags: [TagDTO]
    }
}

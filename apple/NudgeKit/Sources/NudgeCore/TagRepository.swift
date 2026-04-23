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

    /// Force-refreshes from server, bypassing + replacing the in-memory cache.
    @discardableResult
    public func reload() async throws -> [TagDTO] {
        cache = nil
        return try await list()
    }

    public func invalidate() {
        cache = nil
    }

    /// Creates a new tag. Server picks sortOrder (max + 1).
    /// `color` defaults to "chart-1" to match web's default.
    @discardableResult
    public func create(name: String, color: String = "chart-1") async throws -> TagDTO {
        struct Body: Codable {
            let name: String
            let color: String
        }
        let tag: TagDTO = try await client.post("/api/tags", body: Body(name: name, color: color))
        cache = nil
        return tag
    }

    /// PATCHes any subset of name/color/sortOrder. Returns the updated tag.
    @discardableResult
    public func update(id: String, name: String? = nil, color: String? = nil, sortOrder: Int? = nil) async throws -> TagDTO {
        struct Body: Codable {
            let name: String?
            let color: String?
            let sortOrder: Int?
        }
        let body = Body(name: name, color: color, sortOrder: sortOrder)
        let tag: TagDTO = try await client.patch("/api/tags/\(id)", body: body)
        cache = nil
        return tag
    }

    public func delete(id: String) async throws {
        try await client.delete("/api/tags/\(id)")
        cache = nil
    }

    /// Replaces the entire tag list for a task (PUT semantics).
    /// Server returns `{tagIds:[...]}`; the caller decides whether
    /// to refetch the task, since this endpoint doesn't return tag names.
    public func setTaskTags(taskId: String, tagIds: [String]) async throws {
        struct Body: Codable { let tagIds: [String] }
        try await client.putVoid("/api/tasks/\(taskId)/tags", body: Body(tagIds: tagIds))
    }

    private struct TagsResponse: Codable {
        let tags: [TagDTO]
    }
}

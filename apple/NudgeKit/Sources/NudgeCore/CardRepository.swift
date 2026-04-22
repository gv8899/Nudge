import Foundation
import Observation

@Observable
@MainActor
public final class CardRepository {
    private let client: APIClient

    public init(client: APIClient) {
        self.client = client
    }

    /// Fetches one page of cards. Pass `cursor = nil` for the first page.
    /// Empty `query` omits the `q=` query parameter.
    public func list(query: String, cursor: String?, limit: Int = 20) async throws -> CardListDTO {
        // Build query string manually so values are fully percent-encoded
        // (URLComponents leaves colons and other RFC-allowed chars unencoded).
        var allowed = CharacterSet.urlQueryAllowed
        allowed.remove(charactersIn: ":@!$&'()*+,;=")
        func encode(_ value: String) -> String {
            value.addingPercentEncoding(withAllowedCharacters: allowed) ?? value
        }
        var pairs: [String] = ["limit=\(limit)"]
        if !query.isEmpty {
            pairs.append("q=\(encode(query))")
        }
        if let cursor, !cursor.isEmpty {
            pairs.append("cursor=\(encode(cursor))")
        }
        let path = "/api/cards?" + pairs.joined(separator: "&")
        return try await client.get(path)
    }

    /// Creates a new empty card (POST /api/tasks). Returns it as a
    /// CardDTO so the caller can push the detail view immediately.
    public func create() async throws -> CardDTO {
        struct Body: Codable {
            let title: String
            let description: String
            let status: String
        }
        struct TaskShim: Codable {
            let id: String
            let title: String
            let description: String?
            let updatedAt: Date
        }
        let body = Body(title: "", description: "<p></p>", status: "inbox")
        let shim: TaskShim = try await client.post("/api/tasks", body: body)
        return CardDTO(
            id: shim.id,
            title: shim.title,
            description: shim.description ?? "",
            updatedAt: shim.updatedAt,
            tags: []
        )
    }

    /// PATCHes the title of an existing card.
    public func updateTitle(cardId: String, title: String) async throws {
        struct Body: Codable { let title: String }
        try await client.patchVoid("/api/tasks/\(cardId)", body: Body(title: title))
    }

    /// PATCHes the rich-text description of an existing card.
    /// `html` is the same HTML string Web's TipTap editor emits; empty content
    /// is normalized to `""` (matches Web's card-detail.tsx behavior).
    public func updateDescription(cardId: String, html: String) async throws {
        struct Body: Codable { let description: String }
        try await client.patchVoid("/api/tasks/\(cardId)", body: Body(description: html))
    }

    /// Deletes every card whose title is empty or whitespace-only.
    /// Returns the number of cards deleted.
    public func deleteUntitled() async throws -> Int {
        struct Response: Codable { let deleted: Int }
        let response: Response = try await client.deleteReturning("/api/cards/untitled")
        return response.deleted
    }
}

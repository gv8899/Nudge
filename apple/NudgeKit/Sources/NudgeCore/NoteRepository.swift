import Foundation
import Observation

/// Backs the 日誌 (journal) tab. Per-day notes keyed on YYYY-MM-DD; the
/// server upserts by (userId, date) so there's no create/update split.
/// Mirrors the web's `/api/daily/[date]/notes` and `/api/notes/feed`
/// endpoints exactly — no iOS-specific shapes.
@Observable
@MainActor
public final class NoteRepository {
    private let client: APIClient

    public init(client: APIClient) {
        self.client = client
    }

    /// Loads one day's note. Returns `NoteDTO` with `content: ""` when the
    /// user hasn't written anything for that date yet (server returns a
    /// wrapper with `id: null` rather than 404).
    public func fetch(date: String) async throws -> NoteDTO {
        try await client.get("/api/daily/\(date)/notes")
    }

    /// Upserts a day's note with the supplied TipTap HTML. `putVoid` is
    /// fine because callers either re-fetch on next appear or rely on
    /// the optimistic local copy — no need to burn round-trip bytes on
    /// the echoed content field.
    public func save(date: String, content: String) async throws {
        struct Body: Encodable { let content: String }
        try await client.putVoid("/api/daily/\(date)/notes", body: Body(content: content))
    }

    /// One page of the timeline, newest first. `cursor` = the last
    /// entry's date from a previous page (or `nil` for the first
    /// page). Server filters out empty entries (`""` and `"<p></p>"`)
    /// so the feed only shows actually-written days.
    public func feed(cursor: String?, limit: Int = 20) async throws -> NoteFeedPageDTO {
        var path = "/api/notes/feed?limit=\(limit)"
        if let cursor, !cursor.isEmpty {
            let encoded = cursor.addingPercentEncoding(
                withAllowedCharacters: .urlQueryAllowed
            ) ?? cursor
            path += "&cursor=\(encoded)"
        }
        return try await client.get(path)
    }
}

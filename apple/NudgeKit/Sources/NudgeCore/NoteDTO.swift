import Foundation

/// Single-date note payload returned by `GET /api/daily/[date]/notes`.
/// Server always returns a wrapper object — `id` is `nil` when the user
/// has never written a note for that date yet (server returns
/// `{ id: null, content: "" }` rather than 404).
public struct NoteDTO: Codable, Sendable {
    public let id: String?
    public let content: String

    public init(id: String?, content: String) {
        self.id = id
        self.content = content
    }
}

/// One entry in the notes timeline (`GET /api/notes/feed`). Each row is
/// one date's note, newest first. `createdAt` is the server's updated-at
/// timestamp (the server overwrites `createdAt` on save — the column
/// is named `createdAt` in the schema but functionally tracks last
/// modification).
public struct NoteFeedEntryDTO: Codable, Sendable, Identifiable, Hashable {
    public let id: String
    public let date: String      // YYYY-MM-DD
    public let content: String   // TipTap HTML
    public let createdAt: String // ISO 8601

    public init(id: String, date: String, content: String, createdAt: String) {
        self.id = id
        self.date = date
        self.content = content
        self.createdAt = createdAt
    }

    public func hash(into hasher: inout Hasher) { hasher.combine(id) }
}

/// Paginated timeline envelope. `nextCursor` is a YYYY-MM-DD string —
/// pass it back to fetch older entries. `nil` means no more pages.
public struct NoteFeedPageDTO: Codable, Sendable {
    public let notes: [NoteFeedEntryDTO]
    public let nextCursor: String?

    public init(notes: [NoteFeedEntryDTO], nextCursor: String?) {
        self.notes = notes
        self.nextCursor = nextCursor
    }
}

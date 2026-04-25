import Foundation

public struct CardDTO: Codable, Equatable, Sendable, Identifiable, Hashable {
    public let id: String
    public let title: String
    /// Server may return null for cards that never had a body.
    public let description: String
    public let updatedAt: Date
    public let tags: [TagDTO]
    /// ISO-8601 absolute reminder timestamp (one-shot). nil when no
    /// reminder or when the task uses a recurrence-driven reminder.
    public let remindAt: String?

    public init(
        id: String,
        title: String,
        description: String,
        updatedAt: Date,
        tags: [TagDTO],
        remindAt: String? = nil
    ) {
        self.id = id
        self.title = title
        self.description = description
        self.updatedAt = updatedAt
        self.tags = tags
        self.remindAt = remindAt
    }

    private enum CodingKeys: String, CodingKey {
        case id, title, description, updatedAt, tags, remindAt
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        title = try c.decode(String.self, forKey: .title)
        description = try c.decodeIfPresent(String.self, forKey: .description) ?? ""
        updatedAt = try c.decode(Date.self, forKey: .updatedAt)
        tags = try c.decodeIfPresent([TagDTO].self, forKey: .tags) ?? []
        remindAt = try c.decodeIfPresent(String.self, forKey: .remindAt)
    }

    public func hash(into hasher: inout Hasher) { hasher.combine(id) }
}

public struct CardListDTO: Codable, Sendable {
    public let cards: [CardDTO]
    public let nextCursor: String?

    public init(cards: [CardDTO], nextCursor: String?) {
        self.cards = cards
        self.nextCursor = nextCursor
    }
}

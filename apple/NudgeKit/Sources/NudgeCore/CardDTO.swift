import Foundation

public struct CardDTO: Codable, Equatable, Sendable, Identifiable, Hashable {
    public let id: String
    public let title: String
    /// Server may return null for cards that never had a body.
    public let description: String
    public let updatedAt: Date
    public let tags: [TagDTO]

    public init(
        id: String,
        title: String,
        description: String,
        updatedAt: Date,
        tags: [TagDTO]
    ) {
        self.id = id
        self.title = title
        self.description = description
        self.updatedAt = updatedAt
        self.tags = tags
    }

    private enum CodingKeys: String, CodingKey {
        case id, title, description, updatedAt, tags
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        title = try c.decode(String.self, forKey: .title)
        description = try c.decodeIfPresent(String.self, forKey: .description) ?? ""
        updatedAt = try c.decode(Date.self, forKey: .updatedAt)
        tags = try c.decodeIfPresent([TagDTO].self, forKey: .tags) ?? []
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

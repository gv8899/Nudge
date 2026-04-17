import Foundation

public struct TaskDTO: Codable, Equatable, Sendable {
    public let id: String
    public let title: String
    /// Server may return `null`; treat as empty string for downstream consumers.
    public let description: String
    public let status: String
    public let createdAt: Date
    public let updatedAt: Date

    public init(id: String, title: String, description: String, status: String, createdAt: Date, updatedAt: Date) {
        self.id = id
        self.title = title
        self.description = description
        self.status = status
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }

    private enum CodingKeys: String, CodingKey {
        case id, title, description, status, createdAt, updatedAt
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        title = try c.decode(String.self, forKey: .title)
        description = try c.decodeIfPresent(String.self, forKey: .description) ?? ""
        status = try c.decode(String.self, forKey: .status)
        createdAt = try c.decode(Date.self, forKey: .createdAt)
        updatedAt = try c.decode(Date.self, forKey: .updatedAt)
    }
}

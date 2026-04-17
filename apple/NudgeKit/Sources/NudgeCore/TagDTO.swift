import Foundation

public struct TagDTO: Codable, Equatable, Sendable {
    public let id: String
    public let name: String
    public let color: String  // hex, "#xxxxxx"
    /// Some endpoints (e.g. GET /api/cards) join only id/name/color and omit
    /// sortOrder. Defaults to 0 when missing so those responses decode.
    public let sortOrder: Int

    public init(id: String, name: String, color: String, sortOrder: Int = 0) {
        self.id = id
        self.name = name
        self.color = color
        self.sortOrder = sortOrder
    }

    private enum CodingKeys: String, CodingKey {
        case id, name, color, sortOrder
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        name = try c.decode(String.self, forKey: .name)
        color = try c.decode(String.self, forKey: .color)
        sortOrder = try c.decodeIfPresent(Int.self, forKey: .sortOrder) ?? 0
    }
}

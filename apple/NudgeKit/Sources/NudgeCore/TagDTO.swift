import Foundation

public struct TagDTO: Codable, Equatable, Sendable {
    public let id: String
    public let name: String
    public let color: String  // hex, "#xxxxxx"
    public let sortOrder: Int

    public init(id: String, name: String, color: String, sortOrder: Int) {
        self.id = id
        self.name = name
        self.color = color
        self.sortOrder = sortOrder
    }
}

import Foundation

public struct TaskDTO: Codable, Equatable, Sendable {
    public let id: String
    public let title: String
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
}

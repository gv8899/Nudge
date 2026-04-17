import Foundation
import SwiftData

@Model
public final class TaskItem {
    @Attribute(.unique) public var serverId: String
    public var title: String
    public var desc: String          // avoid Swift reserved-ish `description`
    public var tagIds: [String]
    public var createdAt: Date
    public var updatedAt: Date
    public var fetchedAt: Date
    @Relationship(deleteRule: .cascade, inverse: \DailyAssignment.task)
    public var assignments: [DailyAssignment] = []

    public init(
        serverId: String,
        title: String,
        desc: String,
        tagIds: [String],
        createdAt: Date,
        updatedAt: Date,
        fetchedAt: Date
    ) {
        self.serverId = serverId
        self.title = title
        self.desc = desc
        self.tagIds = tagIds
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.fetchedAt = fetchedAt
    }
}

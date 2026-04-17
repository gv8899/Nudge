import Foundation
import SwiftData

@Model
public final class DailyAssignment {
    @Attribute(.unique) public var serverId: String
    public var date: String          // "YYYY-MM-DD"
    public var isCompleted: Bool
    public var sortOrder: Int
    public var fetchedAt: Date
    public var task: TaskItem?

    public init(
        serverId: String,
        date: String,
        isCompleted: Bool,
        sortOrder: Int,
        fetchedAt: Date,
        task: TaskItem? = nil
    ) {
        self.serverId = serverId
        self.date = date
        self.isCompleted = isCompleted
        self.sortOrder = sortOrder
        self.fetchedAt = fetchedAt
        self.task = task
    }
}

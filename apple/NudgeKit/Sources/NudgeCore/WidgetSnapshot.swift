import Foundation

/// Minimal data for the Today List widget. Stored as JSON in the App Group
/// container; read by both the App (writer) and the widget extension (reader).
public struct WidgetSnapshot: Codable, Sendable, Equatable {
    public let date: String           // YYYY-MM-DD, the day this snapshot represents
    public let generatedAt: Date
    public let tasks: [WidgetSnapshotTask]

    public init(date: String, generatedAt: Date, tasks: [WidgetSnapshotTask]) {
        self.date = date
        self.generatedAt = generatedAt
        self.tasks = tasks
    }
}

public struct WidgetSnapshotTask: Codable, Sendable, Equatable, Identifiable {
    public let assignmentId: String   // for ToggleTaskCompletionIntent
    public let taskId: String         // for nudge://task/<id> deep link
    public let title: String
    public let isCompleted: Bool
    public let isOverdue: Bool        // overdue items rendered with badge

    public var id: String { assignmentId }

    public init(assignmentId: String, taskId: String, title: String, isCompleted: Bool, isOverdue: Bool) {
        self.assignmentId = assignmentId
        self.taskId = taskId
        self.title = title
        self.isCompleted = isCompleted
        self.isOverdue = isOverdue
    }
}

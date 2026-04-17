import Foundation

public struct DailyAssignmentDTO: Codable, Equatable, Sendable {
    public let id: String
    public let taskId: String
    public let date: String
    public let isCompleted: Bool
    public let sortOrder: Int
    public let task: TaskDTO

    public init(id: String, taskId: String, date: String, isCompleted: Bool, sortOrder: Int, task: TaskDTO) {
        self.id = id
        self.taskId = taskId
        self.date = date
        self.isCompleted = isCompleted
        self.sortOrder = sortOrder
        self.task = task
    }
}

public struct DailyDataDTO: Codable, Sendable {
    public let date: String
    public let assignments: [DailyAssignmentDTO]
    public let overdueTasks: [DailyAssignmentDTO]
    public let noteContent: String?

    public init(date: String, assignments: [DailyAssignmentDTO], overdueTasks: [DailyAssignmentDTO], noteContent: String?) {
        self.date = date
        self.assignments = assignments
        self.overdueTasks = overdueTasks
        self.noteContent = noteContent
    }
}

import Foundation

public struct DailyAssignmentDTO: Codable, Equatable, Sendable {
    public let id: String
    public let taskId: String
    public let date: String
    public let isCompleted: Bool
    public let isSkipped: Bool
    public let sortOrder: Int
    public let isRecurring: Bool
    public let task: TaskDTO

    public init(
        id: String,
        taskId: String,
        date: String,
        isCompleted: Bool,
        isSkipped: Bool = false,
        sortOrder: Int,
        isRecurring: Bool = false,
        task: TaskDTO
    ) {
        self.id = id
        self.taskId = taskId
        self.date = date
        self.isCompleted = isCompleted
        self.isSkipped = isSkipped
        self.sortOrder = sortOrder
        self.isRecurring = isRecurring
        self.task = task
    }

    private enum CodingKeys: String, CodingKey {
        case id, taskId, date, isCompleted, isSkipped, sortOrder, isRecurring, task
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        taskId = try c.decode(String.self, forKey: .taskId)
        date = try c.decode(String.self, forKey: .date)
        isCompleted = try c.decode(Bool.self, forKey: .isCompleted)
        isSkipped = try c.decodeIfPresent(Bool.self, forKey: .isSkipped) ?? false
        sortOrder = try c.decode(Int.self, forKey: .sortOrder)
        isRecurring = try c.decodeIfPresent(Bool.self, forKey: .isRecurring) ?? false
        task = try c.decode(TaskDTO.self, forKey: .task)
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

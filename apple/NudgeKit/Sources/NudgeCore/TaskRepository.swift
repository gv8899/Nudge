import Foundation
import Observation
import SwiftData
import NudgeData

@Observable
@MainActor
public final class TaskRepository {
    private let client: APIClient
    private let container: ModelContainer

    public init(client: APIClient, container: ModelContainer) {
        self.client = client
        self.container = container
    }

    // MARK: - Read

    public func dailyData(date: String) async throws -> DailyDataDTO {
        let data: DailyDataDTO = try await client.get("/api/daily/\(date)")
        try await updateCache(for: date, data: data)
        return data
    }

    public func weekSummary(start: String, end: String) async throws -> WeekSummaryDTO {
        return try await client.get("/api/daily/week?start=\(start)&end=\(end)")
    }

    // MARK: - Cache

    private func updateCache(for date: String, data: DailyDataDTO) async throws {
        let context = ModelContext(container)
        let now = Date()

        // Clear the day's old assignments
        let descriptor = FetchDescriptor<DailyAssignment>(predicate: #Predicate { $0.date == date })
        let stale = try context.fetch(descriptor)
        for item in stale { context.delete(item) }

        // Insert new (with TaskItem link)
        for dto in data.assignments + data.overdueTasks {
            let dtoTaskId = dto.task.id
            let taskDesc = FetchDescriptor<TaskItem>(predicate: #Predicate { $0.serverId == dtoTaskId })
            let taskItem: TaskItem
            if let existing = try context.fetch(taskDesc).first {
                existing.title = dto.task.title
                existing.desc = dto.task.description
                existing.updatedAt = dto.task.updatedAt
                existing.fetchedAt = now
                taskItem = existing
            } else {
                taskItem = TaskItem(
                    serverId: dto.task.id,
                    title: dto.task.title,
                    desc: dto.task.description,
                    tagIds: [],
                    createdAt: dto.task.createdAt,
                    updatedAt: dto.task.updatedAt,
                    fetchedAt: now
                )
                context.insert(taskItem)
            }

            let assignment = DailyAssignment(
                serverId: dto.id,
                date: dto.date,
                isCompleted: dto.isCompleted,
                sortOrder: dto.sortOrder,
                fetchedAt: now,
                task: taskItem
            )
            context.insert(assignment)
        }

        try context.save()
    }
}

// MARK: - Write

extension TaskRepository {
    public func createTask(date: String, title: String) async throws -> DailyAssignmentDTO {
        struct Body: Codable { let title: String }
        let response: DailyAssignmentDTO = try await client.post(
            "/api/daily/\(date)/tasks",
            body: Body(title: title)
        )
        return response
    }

    public func toggleComplete(assignmentId: String, isCompleted: Bool, onDate: String) async throws {
        struct Body: Codable { let assignmentId: String; let isCompleted: Bool }
        try await client.patchVoid(
            "/api/daily/\(onDate)/tasks",
            body: Body(assignmentId: assignmentId, isCompleted: isCompleted)
        )
    }

    public func reorder(date: String, orderedIds: [String]) async throws {
        struct ReorderItem: Codable { let id: String; let sortOrder: Int }
        struct Body: Codable { let order: [ReorderItem] }
        let order = orderedIds.enumerated().map { ReorderItem(id: $0.element, sortOrder: $0.offset) }
        try await client.putVoid(
            "/api/daily/\(date)/tasks/reorder",
            body: Body(order: order)
        )
    }

    public func moveToDate(assignmentId: String, from: String, to: String) async throws {
        struct Body: Codable { let assignmentId: String; let moveToDate: String }
        try await client.patchVoid(
            "/api/daily/\(from)/tasks",
            body: Body(assignmentId: assignmentId, moveToDate: to)
        )
    }

    public func archive(taskId: String) async throws {
        struct Body: Codable { let status: String }
        try await client.patchVoid(
            "/api/tasks/\(taskId)/status",
            body: Body(status: "archived")
        )
    }

    public func updateTitle(taskId: String, title: String) async throws {
        struct Body: Codable { let title: String }
        try await client.patchVoid(
            "/api/tasks/\(taskId)",
            body: Body(title: title)
        )
    }

    public func updateDescription(taskId: String, description: String) async throws {
        struct Body: Codable { let description: String }
        try await client.patchVoid(
            "/api/tasks/\(taskId)",
            body: Body(description: description)
        )
    }
}

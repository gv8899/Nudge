import Foundation
import Observation
import SwiftData
import NudgeCore

/// Notify external widget surfaces about task changes. App passes in a real
/// implementation that writes the snapshot + reloads timelines.
/// NudgeData stays WidgetKit-free; the App owns the WidgetKit dependency.
public protocol WidgetRefreshing: Sendable {
    func refresh() async
}

@Observable
@MainActor
public final class TaskRepository {
    private let client: APIClient
    private let container: ModelContainer
    private let widgetRefresher: WidgetRefreshing?

    public init(
        client: APIClient,
        container: ModelContainer,
        widgetRefresher: WidgetRefreshing? = nil
    ) {
        self.client = client
        self.container = container
        self.widgetRefresher = widgetRefresher
    }

    /// Manually trigger the widget snapshot refresh. Mutation methods do this
    /// automatically; call this from app launch / post-login flows so the
    /// widget reflects current server state without waiting for a mutation.
    public func refreshWidgetSnapshot() async {
        await widgetRefresher?.refresh()
    }

    /// Polling-friendly refresh — 帶上 cached ETag 打 dailyData，server
    /// 回 304 直接 no-op；只有真有變動才更新本地 SwiftData cache 與 widget
    /// snapshot。給 30s 自動 polling 用，避免每次都拉 full payload。
    public func refreshIfChanged(date: String) async {
        do {
            let data: DailyDataDTO = try await client.get("/api/daily/\(date)")
            try await updateCache(for: date, data: data)
            await widgetRefresher?.refresh()
        } catch APIError.notModified {
            // 沒變動，無事發生
        } catch {
            if !APIError.isCancellation(error) {
                print("[TaskRepository] refreshIfChanged failed: \(error)")
            }
        }
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
        await widgetRefresher?.refresh()
        return response
    }

    public func toggleComplete(assignmentId: String, isCompleted: Bool, onDate: String) async throws {
        struct Body: Codable { let assignmentId: String; let isCompleted: Bool }
        try await client.patchVoid(
            "/api/daily/\(onDate)/tasks",
            body: Body(assignmentId: assignmentId, isCompleted: isCompleted)
        )
        await widgetRefresher?.refresh()
    }

    public func reorder(date: String, orderedIds: [String]) async throws {
        struct ReorderItem: Codable { let id: String; let sortOrder: Int }
        struct Body: Codable { let order: [ReorderItem] }
        let order = orderedIds.enumerated().map { ReorderItem(id: $0.element, sortOrder: $0.offset) }
        try await client.putVoid(
            "/api/daily/\(date)/tasks/reorder",
            body: Body(order: order)
        )
        await widgetRefresher?.refresh()
    }

    public func moveToDate(assignmentId: String, from: String, to: String) async throws {
        struct Body: Codable { let assignmentId: String; let moveToDate: String }
        try await client.patchVoid(
            "/api/daily/\(from)/tasks",
            body: Body(assignmentId: assignmentId, moveToDate: to)
        )
        await widgetRefresher?.refresh()
    }

    public func archive(taskId: String) async throws {
        struct Body: Codable { let status: String }
        try await client.patchVoid(
            "/api/tasks/\(taskId)/status",
            body: Body(status: "archived")
        )
        await widgetRefresher?.refresh()
    }

    public func updateTitle(taskId: String, title: String) async throws {
        struct Body: Codable { let title: String }
        try await client.patchVoid(
            "/api/tasks/\(taskId)",
            body: Body(title: title)
        )
        await widgetRefresher?.refresh()
    }

    public func updateDescription(taskId: String, description: String) async throws {
        struct Body: Codable { let description: String }
        try await client.patchVoid(
            "/api/tasks/\(taskId)",
            body: Body(description: description)
        )
    }

    public func toggleSkip(assignmentId: String, isSkipped: Bool) async throws {
        struct Body: Codable { let isSkipped: Bool }
        try await client.patchVoid(
            "/api/daily-assignments/\(assignmentId)",
            body: Body(isSkipped: isSkipped)
        )
        await widgetRefresher?.refresh()
    }
}

import Testing
import Foundation
import SwiftData
@testable import NudgeCore
@testable import NudgeData

@Suite("TaskRepository.read", .serialized) @MainActor
struct TaskRepositoryReadTests {
    func makeRepo(responseBody: String, status: Int = 200) -> (TaskRepository, ModelContainer) {
        MockURLProtocol.handler = { request in
            let data = responseBody.data(using: .utf8)!
            let response = HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil, headerFields: nil)!
            return (data, response)
        }
        let client = APIClient(
            configuration: APIConfiguration(baseURL: URL(string: "https://test.local")!),
            session: .mocked()
        )
        let container = NudgeModelContainer.makeInMemory()
        let repo = TaskRepository(client: client, container: container)
        return (repo, container)
    }

    @Test func dailyDataFetchesAndWritesCache() async throws {
        let body = """
        {
          "date": "2026-04-17",
          "assignments": [{
            "id": "a1", "taskId": "t1", "date": "2026-04-17",
            "isCompleted": false, "sortOrder": 0,
            "task": {
              "id": "t1", "title": "Buy milk", "description": "",
              "status": "in_progress",
              "createdAt": "2026-04-17T10:00:00.000Z",
              "updatedAt": "2026-04-17T10:00:00.000Z"
            }
          }],
          "overdueTasks": [],
          "noteContent": null
        }
        """
        let (repo, container) = makeRepo(responseBody: body)
        let data = try await repo.dailyData(date: "2026-04-17")
        #expect(data.assignments.count == 1)
        #expect(data.assignments.first?.task.title == "Buy milk")

        // Cache was written
        let context = ModelContext(container)
        let descriptor = FetchDescriptor<DailyAssignment>()
        let cached = try context.fetch(descriptor)
        #expect(cached.count == 1)
        #expect(cached.first?.serverId == "a1")
    }

    @Test func weekSummaryDecodes() async throws {
        let (repo, _) = makeRepo(responseBody: #"{"datesWithTasks":["2026-04-15","2026-04-17"]}"#)
        let summary = try await repo.weekSummary(start: "2026-04-13", end: "2026-04-19")
        #expect(summary.datesWithTasks.count == 2)
    }
}

@Suite("TaskRepository.write", .serialized) @MainActor
struct TaskRepositoryWriteTests {
    func makeRepo(responseBody: String, status: Int = 200) -> TaskRepository {
        MockURLProtocol.handler = { request in
            let data = responseBody.data(using: .utf8)!
            let response = HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil, headerFields: nil)!
            return (data, response)
        }
        let client = APIClient(
            configuration: APIConfiguration(baseURL: URL(string: "https://test.local")!),
            session: .mocked()
        )
        let container = NudgeModelContainer.makeInMemory()
        return TaskRepository(client: client, container: container)
    }

    @Test func createTaskPostsAndReturnsAssignment() async throws {
        let body = """
        {
          "id": "a1", "taskId": "t1", "date": "2026-04-17",
          "isCompleted": false, "sortOrder": -1,
          "task": {
            "id": "t1", "title": "Buy milk", "description": "",
            "status": "in_progress",
            "createdAt": "2026-04-17T10:00:00.000Z",
            "updatedAt": "2026-04-17T10:00:00.000Z"
          }
        }
        """
        let repo = makeRepo(responseBody: body, status: 201)
        let assignment = try await repo.createTask(date: "2026-04-17", title: "Buy milk")
        #expect(assignment.id == "a1")
    }

    @Test func toggleCompletePatches() async throws {
        let repo = makeRepo(responseBody: "{}")
        try await repo.toggleComplete(assignmentId: "a1", isCompleted: true, onDate: "2026-04-17")
    }

    @Test func reorderPutsOrder() async throws {
        let repo = makeRepo(responseBody: "{}")
        try await repo.reorder(date: "2026-04-17", orderedIds: ["a1", "a2"])
    }

    @Test func archivePatchesStatus() async throws {
        let repo = makeRepo(responseBody: "{}")
        try await repo.archive(taskId: "t1")
    }

    @Test func updateTitlePatches() async throws {
        let repo = makeRepo(responseBody: "{}")
        try await repo.updateTitle(taskId: "t1", title: "New title")
    }
}

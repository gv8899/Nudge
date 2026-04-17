import Testing
import Foundation
import SwiftData
@testable import NudgeData

@Suite("NudgeModelContainer", .serialized) @MainActor
struct ModelContainerTests {
    @Test func canInsertTaskItemAndRetrieve() throws {
        let container = NudgeModelContainer.makeInMemory()
        let context = ModelContext(container)
        let now = Date()

        let item = TaskItem(
            serverId: "t1", title: "Buy milk", desc: "",
            tagIds: [], createdAt: now, updatedAt: now, fetchedAt: now
        )
        context.insert(item)
        try context.save()

        let descriptor = FetchDescriptor<TaskItem>()
        let items = try context.fetch(descriptor)
        #expect(items.count == 1)
        #expect(items.first?.serverId == "t1")
    }

    @Test func assignmentLinksToTask() throws {
        let container = NudgeModelContainer.makeInMemory()
        let context = ModelContext(container)
        let now = Date()

        let task = TaskItem(serverId: "t1", title: "T", desc: "",
                             tagIds: [], createdAt: now, updatedAt: now, fetchedAt: now)
        context.insert(task)
        let assignment = DailyAssignment(serverId: "a1", date: "2026-04-17",
                                          isCompleted: false, sortOrder: 0, fetchedAt: now, task: task)
        context.insert(assignment)
        try context.save()

        let descriptor = FetchDescriptor<DailyAssignment>()
        let found = try context.fetch(descriptor)
        #expect(found.first?.task?.serverId == "t1")
    }
}

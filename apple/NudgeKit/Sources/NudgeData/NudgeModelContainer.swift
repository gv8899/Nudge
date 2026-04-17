import Foundation
import SwiftData

public enum NudgeModelContainer {
    /// Phase 2: TaskItem + DailyAssignment schema.
    ///
    /// 用法：在 App entry 做 `.modelContainer(NudgeModelContainer.make())`
    @MainActor
    public static func make() -> ModelContainer {
        let schema = Schema([TaskItem.self, DailyAssignment.self])
        let configuration = ModelConfiguration(
            schema: schema,
            isStoredInMemoryOnly: false
        )
        do {
            return try ModelContainer(for: schema, configurations: configuration)
        } catch {
            fatalError("Failed to create ModelContainer: \(error)")
        }
    }

    @MainActor
    public static func makeInMemory() -> ModelContainer {
        let schema = Schema([TaskItem.self, DailyAssignment.self])
        let configuration = ModelConfiguration(
            schema: schema,
            isStoredInMemoryOnly: true
        )
        do {
            return try ModelContainer(for: schema, configurations: configuration)
        } catch {
            fatalError("Failed to create in-memory ModelContainer: \(error)")
        }
    }
}

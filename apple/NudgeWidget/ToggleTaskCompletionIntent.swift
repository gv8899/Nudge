// apple/NudgeWidget/ToggleTaskCompletionIntent.swift
import AppIntents
import WidgetKit
import NudgeCore

struct ToggleTaskCompletionIntent: AppIntent {
    static let title: LocalizedStringResource = "Toggle task completion"
    static let description = IntentDescription("Mark a task complete or incomplete from the widget.")

    @Parameter(title: "Assignment ID")
    var assignmentId: String

    @Parameter(title: "Date (YYYY-MM-DD)")
    var date: String

    @Parameter(title: "Mark as completed")
    var isCompleted: Bool

    init() {}

    init(assignmentId: String, date: String, isCompleted: Bool) {
        self.assignmentId = assignmentId
        self.date = date
        self.isCompleted = isCompleted
    }

    func perform() async throws -> some IntentResult {
        // Optimistic local update — flip the flag in the snapshot file
        // before hitting the network. Widget reloads from the new snapshot
        // immediately so the user sees the checkbox flip instantly.
        let store = WidgetSnapshotStore()
        if let snap = store.read() {
            let updated = WidgetSnapshot(
                date: snap.date,
                generatedAt: Date(),
                tasks: snap.tasks.map { task in
                    task.assignmentId == assignmentId
                        ? WidgetSnapshotTask(
                            assignmentId: task.assignmentId,
                            taskId: task.taskId,
                            title: task.title,
                            isCompleted: isCompleted,
                            isOverdue: task.isOverdue
                          )
                        : task
                }
            )
            try? store.write(updated)
            WidgetCenter.shared.reloadAllTimelines()
        }

        // Then hit the API. Token comes from the shared App Group file
        // written by the App after login (see SharedTokenStore.swift —
        // sim cannot reliably share keychain via access groups).
        // Endpoint matches TaskRepository.toggleComplete:
        //   PATCH /api/daily/{date}/tasks  body: { assignmentId, isCompleted }
        struct ToggleBody: Encodable {
            let assignmentId: String
            let isCompleted: Bool
        }
        let tokenStore = SharedTokenStore()
        let tokenProvider: APIClient.TokenProvider = {
            tokenStore.read()
        }
        let client = APIClient(configuration: .default, tokenProvider: tokenProvider)
        do {
            try await client.patchVoid(
                "/api/daily/\(date)/tasks",
                body: ToggleBody(assignmentId: assignmentId, isCompleted: isCompleted)
            )
            // Server agreed. Snapshot is already updated; no further work.
        } catch {
            // Roll back on failure — write the original snapshot back.
            // On next App open the snapshot will get re-generated from API.
            if let snap = store.read() {
                let rolledBack = WidgetSnapshot(
                    date: snap.date,
                    generatedAt: Date(),
                    tasks: snap.tasks.map { task in
                        task.assignmentId == assignmentId
                            ? WidgetSnapshotTask(
                                assignmentId: task.assignmentId,
                                taskId: task.taskId,
                                title: task.title,
                                isCompleted: !isCompleted,
                                isOverdue: task.isOverdue
                              )
                            : task
                    }
                )
                try? store.write(rolledBack)
                WidgetCenter.shared.reloadAllTimelines()
            }
        }
        return .result()
    }
}

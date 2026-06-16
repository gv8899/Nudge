import Foundation

/// Reads/writes the WidgetSnapshot JSON in the App Group container.
public final class WidgetSnapshotStore: Sendable {
    public init() {}

    /// Read the current snapshot from the shared container.
    /// Returns nil if file doesn't exist yet (first launch) or App Group missing.
    public func read() -> WidgetSnapshot? {
        guard let url = AppGroupConfiguration.snapshotFileURL,
              let data = try? Data(contentsOf: url) else {
            return nil
        }
        // 「有/無小數秒都吃」—— 見 NudgeISO8601（裸 .iso8601 在舊 OS 解不了毫秒）。
        let decoder = NudgeISO8601.makeDecoder()
        return try? decoder.decode(WidgetSnapshot.self, from: data)
    }

    /// Write a snapshot to the shared container. Atomic write.
    public func write(_ snapshot: WidgetSnapshot) throws {
        guard let url = AppGroupConfiguration.snapshotFileURL else {
            throw WidgetSnapshotError.appGroupContainerUnavailable
        }
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        let data = try encoder.encode(snapshot)
        try data.write(to: url, options: .atomic)
    }

    /// Remove snapshot (e.g. on logout).
    public func clear() {
        guard let url = AppGroupConfiguration.snapshotFileURL else { return }
        try? FileManager.default.removeItem(at: url)
    }
}

public enum WidgetSnapshotError: Error, Sendable {
    case appGroupContainerUnavailable
}

/// Build a snapshot from DailyDataDTO. Top 5 items, overdue first then today.
/// Sorts each group by `sortOrder` to match Daily's client-side ordering
/// (TaskListView sorts the same way — the API does not guarantee pre-sorted
/// arrays). Pure function — does not touch FS/Keychain.
public func makeWidgetSnapshot(from data: DailyDataDTO, generatedAt: Date) -> WidgetSnapshot {
    let overdue = data.overdueTasks
        .sorted { $0.sortOrder < $1.sortOrder }
        .map {
            WidgetSnapshotTask(
                assignmentId: $0.id,
                taskId: $0.taskId,
                title: $0.task.title,
                isCompleted: $0.isCompleted,
                isOverdue: true
            )
        }
    let today = data.assignments
        .sorted { $0.sortOrder < $1.sortOrder }
        .map {
            WidgetSnapshotTask(
                assignmentId: $0.id,
                taskId: $0.taskId,
                title: $0.task.title,
                isCompleted: $0.isCompleted,
                isOverdue: false
            )
        }
    let combined = Array((overdue + today).prefix(5))
    return WidgetSnapshot(date: data.date, generatedAt: generatedAt, tasks: combined)
}

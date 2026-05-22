import Foundation
import Observation

/// One task that currently has a reminder set — either an absolute
/// one-shot (`remindAt`) or a recurrence with `remindAtTimeOfDay`, or
/// both. Returned by `GET /api/reminders`.
public struct TaskReminderDTO: Codable, Sendable {
    public let taskId: String
    public let title: String
    public let remindAt: String?            // ISO-8601 absolute, or null
    public let recurrence: TaskRecurrenceDTO?

    public init(
        taskId: String,
        title: String,
        remindAt: String?,
        recurrence: TaskRecurrenceDTO?
    ) {
        self.taskId = taskId
        self.title = title
        self.remindAt = remindAt
        self.recurrence = recurrence
    }
}

/// Fetches the user's full set of task reminders so each device can
/// rebuild its own local notification schedule on launch / foreground.
/// Local notifications are per-device — without this sync, a reminder
/// set on the Mac would never fire on the iPhone (and vice versa).
@Observable
@MainActor
public final class ReminderRepository {
    private let client: APIClient
    public init(client: APIClient) { self.client = client }

    public func all() async throws -> [TaskReminderDTO] {
        return try await client.get("/api/reminders")
    }
}

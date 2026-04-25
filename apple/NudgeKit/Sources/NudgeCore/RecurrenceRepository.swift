import Foundation
import Observation

@Observable
@MainActor
public final class RecurrenceRepository {
    private let client: APIClient
    public init(client: APIClient) { self.client = client }

    /// Returns nil when the task has no recurrence configured.
    public func get(taskId: String) async throws -> TaskRecurrenceDTO? {
        // Server returns the JSON literal `null` when no rule exists.
        // Try-decode into optional; missing/null body yields nil.
        do {
            let dto: TaskRecurrenceDTO = try await client.get("/api/tasks/\(taskId)/recurrence")
            return dto
        } catch {
            // Decoding "null" into TaskRecurrenceDTO will throw; treat as nil.
            return nil
        }
    }

    public struct UpsertBody: Encodable, Sendable {
        public let preset: String
        public let weekdays: String?
        public let monthDay: Int?
        public let monthNth: Int?
        public let monthNthWeekday: Int?
        public let startDate: String
        public let endDate: String?
        public let remindAtTimeOfDay: String?

        public init(
            preset: String,
            weekdays: String?,
            monthDay: Int?,
            monthNth: Int?,
            monthNthWeekday: Int?,
            startDate: String,
            endDate: String?,
            remindAtTimeOfDay: String?
        ) {
            self.preset = preset
            self.weekdays = weekdays
            self.monthDay = monthDay
            self.monthNth = monthNth
            self.monthNthWeekday = monthNthWeekday
            self.startDate = startDate
            self.endDate = endDate
            self.remindAtTimeOfDay = remindAtTimeOfDay
        }
    }

    public func upsert(taskId: String, body: UpsertBody) async throws -> TaskRecurrenceDTO {
        return try await client.put("/api/tasks/\(taskId)/recurrence", body: body)
    }

    public func delete(taskId: String) async throws {
        try await client.delete("/api/tasks/\(taskId)/recurrence")
    }
}

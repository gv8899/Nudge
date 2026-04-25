import Foundation

public enum RecurrencePreset: String, Codable, Sendable, CaseIterable, Identifiable {
    case daily
    case weekdays
    case weekly
    case biweekly
    case monthly_day
    case monthly_nth_weekday
    case yearly
    public var id: String { rawValue }
}

public struct TaskRecurrenceDTO: Codable, Sendable, Equatable {
    public let id: String
    public let taskId: String
    public let preset: RecurrencePreset
    public let weekdays: String?       // CSV "1,3,5" (ISO 1=Mon..7=Sun)
    public let monthDay: Int?
    public let monthNth: Int?          // 1..4 or 5 (last)
    public let monthNthWeekday: Int?   // ISO 1..7
    public let startDate: String       // YYYY-MM-DD
    public let endDate: String?
    public let remindAtTimeOfDay: String? // HH:MM
    public let createdAt: String
    public let updatedAt: String

    public init(
        id: String,
        taskId: String,
        preset: RecurrencePreset,
        weekdays: String?,
        monthDay: Int?,
        monthNth: Int?,
        monthNthWeekday: Int?,
        startDate: String,
        endDate: String?,
        remindAtTimeOfDay: String?,
        createdAt: String,
        updatedAt: String
    ) {
        self.id = id
        self.taskId = taskId
        self.preset = preset
        self.weekdays = weekdays
        self.monthDay = monthDay
        self.monthNth = monthNth
        self.monthNthWeekday = monthNthWeekday
        self.startDate = startDate
        self.endDate = endDate
        self.remindAtTimeOfDay = remindAtTimeOfDay
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

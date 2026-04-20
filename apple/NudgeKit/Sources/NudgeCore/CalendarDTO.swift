import Foundation

public struct CalendarEventDTO: Codable, Equatable, Sendable {
    public let id: String
    public let calendarId: String
    public let calendarName: String
    public let title: String
    /// ISO-8601 with timezone offset (e.g. `2026-04-21T11:30:00+08:00`).
    /// Kept as String so display formatting uses the event's own timezone,
    /// not the phone's.
    public let start: String
    public let end: String
    public let allDay: Bool
    public let location: String?
    public let description: String?
    public let attendees: [String]
    public let htmlLink: String
    public let hangoutLink: String
    public let busyOnly: Bool

    public init(id: String, calendarId: String, calendarName: String, title: String,
                start: String, end: String, allDay: Bool,
                location: String?, description: String?, attendees: [String],
                htmlLink: String, hangoutLink: String, busyOnly: Bool) {
        self.id = id
        self.calendarId = calendarId
        self.calendarName = calendarName
        self.title = title
        self.start = start
        self.end = end
        self.allDay = allDay
        self.location = location
        self.description = description
        self.attendees = attendees
        self.htmlLink = htmlLink
        self.hangoutLink = hangoutLink
        self.busyOnly = busyOnly
    }
}

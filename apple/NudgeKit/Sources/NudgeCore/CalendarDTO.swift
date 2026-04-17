import Foundation

public struct CalendarEventDTO: Codable, Equatable, Sendable {
    public let id: String
    public let summary: String
    public let start: Date
    public let end: Date
    public let location: String?
    public let attendees: [String]
    public let hangoutLink: String?
    public let htmlLink: String?

    public init(id: String, summary: String, start: Date, end: Date,
                location: String?, attendees: [String], hangoutLink: String?, htmlLink: String?) {
        self.id = id
        self.summary = summary
        self.start = start
        self.end = end
        self.location = location
        self.attendees = attendees
        self.hangoutLink = hangoutLink
        self.htmlLink = htmlLink
    }
}

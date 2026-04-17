import Foundation

public struct WeekSummaryDTO: Codable, Sendable {
    public let datesWithTasks: [String]

    public init(datesWithTasks: [String]) {
        self.datesWithTasks = datesWithTasks
    }
}

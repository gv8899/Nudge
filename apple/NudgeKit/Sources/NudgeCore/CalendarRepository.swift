import Foundation
import Observation

@Observable
@MainActor
public final class CalendarRepository {
    private let client: APIClient
    public private(set) var isConnected: Bool = true

    public init(client: APIClient) {
        self.client = client
    }

    /// Fetches events for a date. Server returns `{connected:false, reason:...}`
    /// (status 200) when the user hasn't connected Google Calendar yet;
    /// that flips `isConnected = false` and returns an empty list instead
    /// of throwing.
    public func events(date: String) async throws -> [CalendarEventDTO] {
        let response: EventsResponse = try await client.get("/api/calendar/events?date=\(date)")
        if response.connected == false {
            isConnected = false
            return []
        }
        isConnected = true
        return response.events ?? []
    }

    private struct EventsResponse: Codable {
        let events: [CalendarEventDTO]?
        let connected: Bool?
        let reason: String?
    }
}

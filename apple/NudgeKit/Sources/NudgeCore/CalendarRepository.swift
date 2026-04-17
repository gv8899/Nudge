import Foundation
import Observation

@Observable
@MainActor
public final class CalendarRepository {
    private let client: APIClient
    public private(set) var isConnected: Bool = true    // default true; 400 flips to false

    public init(client: APIClient) {
        self.client = client
    }

    public func events(date: String) async throws -> [CalendarEventDTO] {
        do {
            let response: EventsResponse = try await client.get("/api/calendar/events?date=\(date)")
            isConnected = true
            return response.events
        } catch APIError.server(let code, _) where code == 400 {
            isConnected = false
            throw APIError.server(statusCode: 400, message: "not_connected")
        }
    }

    private struct EventsResponse: Codable {
        let events: [CalendarEventDTO]
    }
}

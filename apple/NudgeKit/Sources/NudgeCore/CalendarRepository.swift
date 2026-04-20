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

    /// Requests a one-time connect URL from the server. The caller opens this
    /// URL in `ASWebAuthenticationSession` with callback scheme `nudge`.
    public func mobileStart() async throws -> URL {
        let response: MobileStartResponse = try await client.get("/api/calendar/mobile-start")
        guard let url = URL(string: response.url) else {
            throw APIError.invalidResponse
        }
        return url
    }

    /// Re-checks connection status by calling events for today.
    /// Called after OAuth success to flip `isConnected` true immediately.
    public func refreshConnectionStatus() async {
        let today = DateFormatters.isoDate(Date())
        _ = try? await events(date: today)
    }

    private struct EventsResponse: Codable {
        let events: [CalendarEventDTO]?
        let connected: Bool?
        let reason: String?
    }

    private struct MobileStartResponse: Codable {
        let url: String
    }
}

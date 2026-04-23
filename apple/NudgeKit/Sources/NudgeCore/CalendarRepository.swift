import Foundation
import Observation

@Observable
@MainActor
public final class CalendarRepository {
    private let client: APIClient
    public private(set) var isConnected: Bool = true
    /// Email of the connected Google account (= primary calendar id).
    /// Empty string when not connected or not yet fetched.
    public private(set) var connectedEmail: String = ""

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

    /// Fetches events across a date range [start ... end] (inclusive, YYYY-MM-DD).
    /// Server maps `date` + `endDate` params; behaviour matches single-day call
    /// when `start == end`.
    public func events(start: String, end: String) async throws -> [CalendarEventDTO] {
        let response: EventsResponse = try await client.get(
            "/api/calendar/events?date=\(start)&endDate=\(end)"
        )
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
    /// Also refreshes `connectedEmail` via the calendars endpoint.
    public func refreshConnectionStatus() async {
        let today = DateFormatters.isoDate(Date())
        _ = try? await events(date: today)
        if isConnected {
            _ = try? await listCalendars()
        }
    }

    /// Lists the user's Google calendars. Primary calendar's id is the
    /// user's email, which we surface via `connectedEmail`.
    @discardableResult
    public func listCalendars() async throws -> [CalendarListItemDTO] {
        let response: CalendarsResponse = try await client.get("/api/calendar/calendars")
        let primary = response.calendars.first(where: { $0.primary })
        connectedEmail = primary?.id ?? ""
        return response.calendars
    }

    /// Revokes the stored Google Calendar tokens server-side and flips
    /// local state to disconnected. Safe to call even if already disconnected.
    public func disconnect() async throws {
        try await client.postVoid("/api/calendar/disconnect", body: EmptyBody())
        isConnected = false
        connectedEmail = ""
    }

    private struct EventsResponse: Codable {
        let events: [CalendarEventDTO]?
        let connected: Bool?
        let reason: String?
    }

    private struct MobileStartResponse: Codable {
        let url: String
    }

    private struct CalendarsResponse: Codable {
        let calendars: [CalendarListItemDTO]
    }

    private struct EmptyBody: Codable {}
}

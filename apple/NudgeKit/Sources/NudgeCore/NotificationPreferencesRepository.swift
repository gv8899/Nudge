import Foundation
import Observation

@Observable
@MainActor
public final class NotificationPreferencesRepository {
    private let client: APIClient
    public init(client: APIClient) { self.client = client }

    public func get() async throws -> NotificationPreferencesDTO {
        try await client.get("/api/notification-preferences")
    }

    public struct PatchBody: Encodable, Sendable {
        public var morningEnabled: Bool?
        public var morningTime: String?
        public var morningContent: String?
        public var eveningEnabled: Bool?
        public var eveningTime: String?
        public var eveningContent: String?
        public var perTaskRemindersEnabled: Bool?

        public init(
            morningEnabled: Bool? = nil,
            morningTime: String? = nil,
            morningContent: String? = nil,
            eveningEnabled: Bool? = nil,
            eveningTime: String? = nil,
            eveningContent: String? = nil,
            perTaskRemindersEnabled: Bool? = nil
        ) {
            self.morningEnabled = morningEnabled
            self.morningTime = morningTime
            self.morningContent = morningContent
            self.eveningEnabled = eveningEnabled
            self.eveningTime = eveningTime
            self.eveningContent = eveningContent
            self.perTaskRemindersEnabled = perTaskRemindersEnabled
        }
    }

    public func patch(body: PatchBody) async throws -> NotificationPreferencesDTO {
        try await client.patch("/api/notification-preferences", body: body)
    }
}

import Foundation

public enum NotificationContent: String, Codable, Sendable, CaseIterable, Identifiable {
    case summary
    case incomplete
    case summary_streak
    public var id: String { rawValue }
}

public struct NotificationPreferencesDTO: Codable, Sendable, Equatable {
    public let userId: String
    public let morningEnabled: Bool
    public let morningTime: String       // HH:MM
    public let morningContent: NotificationContent
    public let eveningEnabled: Bool
    public let eveningTime: String
    public let eveningContent: NotificationContent
    public let perTaskRemindersEnabled: Bool
    public let updatedAt: String

    public init(
        userId: String,
        morningEnabled: Bool,
        morningTime: String,
        morningContent: NotificationContent,
        eveningEnabled: Bool,
        eveningTime: String,
        eveningContent: NotificationContent,
        perTaskRemindersEnabled: Bool,
        updatedAt: String
    ) {
        self.userId = userId
        self.morningEnabled = morningEnabled
        self.morningTime = morningTime
        self.morningContent = morningContent
        self.eveningEnabled = eveningEnabled
        self.eveningTime = eveningTime
        self.eveningContent = eveningContent
        self.perTaskRemindersEnabled = perTaskRemindersEnabled
        self.updatedAt = updatedAt
    }
}

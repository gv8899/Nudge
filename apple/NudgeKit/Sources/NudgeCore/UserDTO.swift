import Foundation

public struct UserDTO: Codable, Equatable, Sendable {
    public let id: String
    public let email: String
    public let name: String?
    public let avatarUrl: String?
    public let locale: String?

    public init(
        id: String,
        email: String,
        name: String?,
        avatarUrl: String?,
        locale: String?
    ) {
        self.id = id
        self.email = email
        self.name = name
        self.avatarUrl = avatarUrl
        self.locale = locale
    }
}

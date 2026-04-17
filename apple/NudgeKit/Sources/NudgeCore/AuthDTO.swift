import Foundation

public struct MobileAuthRequest: Codable, Sendable {
    public let idToken: String

    public init(idToken: String) {
        self.idToken = idToken
    }
}

public struct MobileAuthResponse: Codable, Sendable {
    public let token: String
    public let user: UserDTO

    public init(token: String, user: UserDTO) {
        self.token = token
        self.user = user
    }
}

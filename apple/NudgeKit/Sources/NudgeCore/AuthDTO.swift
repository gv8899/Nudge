import Foundation

public struct MobileAuthRequest: Codable, Sendable {
    public let idToken: String

    public init(idToken: String) {
        self.idToken = idToken
    }
}

public struct AppleAuthRequest: Codable, Sendable {
    public let identityToken: String
    /// Apple 只在「首次授權」回名字 / email；之後為 nil。
    public let fullName: String?
    public let email: String?

    public init(identityToken: String, fullName: String?, email: String?) {
        self.identityToken = identityToken
        self.fullName = fullName
        self.email = email
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

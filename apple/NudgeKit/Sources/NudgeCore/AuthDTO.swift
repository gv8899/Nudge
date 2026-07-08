import Foundation

public struct MobileAuthRequest: Codable, Sendable {
    public let idToken: String
    /// app 內選定的介面語言（BCP-47）。新帳號 seed 範例內容時用來選語言，
    /// 比 Accept-Language 準（Accept-Language 跟系統語言、非 app 介面語言）。
    public let locale: String?

    public init(idToken: String, locale: String? = nil) {
        self.idToken = idToken
        self.locale = locale
    }
}

public struct AppleAuthRequest: Codable, Sendable {
    public let identityToken: String
    /// Apple 只在「首次授權」回名字 / email；之後為 nil。
    public let fullName: String?
    public let email: String?
    /// app 內選定的介面語言（BCP-47），用途同 MobileAuthRequest.locale。
    public let locale: String?

    public init(identityToken: String, fullName: String?, email: String?, locale: String? = nil) {
        self.identityToken = identityToken
        self.fullName = fullName
        self.email = email
        self.locale = locale
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

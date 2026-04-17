import Foundation

public struct APIConfiguration: Sendable {
    public let baseURL: URL

    public init(baseURL: URL) {
        self.baseURL = baseURL
    }

    public static let production = APIConfiguration(
        baseURL: URL(string: "https://nudge.tw")!
    )

    public static let development = APIConfiguration(
        baseURL: URL(string: "http://localhost:3000")!
    )

    /// Debug build 用 development，release build 用 production。
    public static var `default`: APIConfiguration {
        #if DEBUG
        return .development
        #else
        return .production
        #endif
    }
}

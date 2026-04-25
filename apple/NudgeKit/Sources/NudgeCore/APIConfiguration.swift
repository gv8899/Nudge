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

    /// Release builds 永遠打 production。Debug build (sim/local) 打
    /// development，方便 iterate 還沒 deploy 的後端 endpoints；release
    /// archive 自動回到 production，TestFlight / App Store build 不受影響。
    public static var `default`: APIConfiguration {
        #if DEBUG
        return .development
        #else
        return .production
        #endif
    }
}

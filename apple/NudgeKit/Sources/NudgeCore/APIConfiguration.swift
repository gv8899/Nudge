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

    /// Debug + release 都打 production；dev 機器開 npm run dev 也不會影響 app。
    public static var `default`: APIConfiguration { .production }
}

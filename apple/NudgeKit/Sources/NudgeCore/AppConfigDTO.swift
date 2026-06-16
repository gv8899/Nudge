import Foundation

/// `GET /api/app-config` 的回應。給原生 app 啟動時查「最低支援 build 號」做
/// 版本硬閘：自身 CFBundleVersion 低於對應平台的值就強制更新。
public struct AppConfigDTO: Codable, Sendable {
    public let minMacBuild: Int
    public let minIosBuild: Int

    public init(minMacBuild: Int, minIosBuild: Int) {
        self.minMacBuild = minMacBuild
        self.minIosBuild = minIosBuild
    }
}

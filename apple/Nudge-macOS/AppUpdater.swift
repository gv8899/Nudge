import SwiftUI
import NudgeCore
import Sparkle

/// Mac 版自動更新協調器。
///
/// - **軟更新**：Sparkle（`SPUStandardUpdaterController`）—— 啟動 + 每日背景
///   檢查 appcast，有新版跳對話框、背景下載 DMG、EdDSA 驗章、替換重啟。
///   背景自動檢查只在 Release 啟用（Debug 不打擾開發機；手動「檢查更新…」
///   兩邊都可）。
/// - **硬閘**：啟動查 `GET /api/app-config`，自身 build 低於 `minMacBuild`
///   就 `forcedUpdateRequired = true` → UI 蓋 ForcedUpdateOverlay。fail-open。
@MainActor
@Observable
final class AppUpdater {
    @ObservationIgnored private let client: APIClient
    @ObservationIgnored private let updaterController: SPUStandardUpdaterController

    /// true 時 UI 蓋上強制更新擋板。
    private(set) var forcedUpdateRequired = false

    init(client: APIClient) {
        self.client = client
        // Debug 不自動跑背景檢查（避免開發機被打擾）；Release 啟動就檢查。
        #if DEBUG
        let autoStart = false
        #else
        let autoStart = true
        #endif
        self.updaterController = SPUStandardUpdaterController(
            startingUpdater: autoStart,
            updaterDelegate: nil,
            userDriverDelegate: nil
        )
    }

    /// 自身 build 號（CFBundleVersion = CURRENT_PROJECT_VERSION）。
    private var currentBuild: Int {
        Int(Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "") ?? 0
    }

    /// 啟動時查後端最低版本，決定要不要硬閘。fail-open：查不到不擋。
    func refreshForcedUpdate() async {
        do {
            let config: AppConfigDTO = try await client.get("/api/app-config")
            forcedUpdateRequired = currentBuild < config.minMacBuild
        } catch {
            forcedUpdateRequired = false
        }
    }

    /// 觸發 Sparkle 檢查更新（選單 / 擋板的「立即更新」鈕用）。
    func checkForUpdates() {
        updaterController.updater.checkForUpdates()
    }
}

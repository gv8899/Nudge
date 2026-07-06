import UIKit
import NudgeCore
import NudgeData
import NudgeUI

/// 即時同步的 silent push 接收端。
///
/// 後端在資料變動時對本裝置發 APNs `content-available:1`（使用者看不到、
/// 無聲）；iOS 在背景喚醒 app → 這裡觸發「重抓今天資料 + 刷 Widget +
/// 重排本地提醒」。重排提醒那步順便根治了「web/Mac 改重複規則後，iOS
/// 已排入的舊 occurrence 通知照舊觸發」的幽靈通知問題 —— 以前只有下次
/// 開 app 才對帳，現在推播一到就對帳。
///
/// SwiftUI App 沒有 UIApplicationDelegate，remote-notification 的三個
/// callback 只能經 `@UIApplicationDelegateAdaptor` 進來，所以掛這個殼。
/// 依賴用 static 注入（NudgeiOSApp.init 設定）—— adaptor 由 UIKit 實例化，
/// 沒辦法走 initializer injection。
final class PushSyncAppDelegate: NSObject, UIApplicationDelegate {
    /// POST /api/devices 用（bearer 從 keychain 來，登入後才會成功）。
    static var client: APIClient?
    /// silent push 醒來後的刷新入口：重抓今天 + 刷 Widget（ETag 沒變就 304，
    /// 很便宜）。
    static var refreshData: (() async -> Void)?
    /// 重排本地提醒（= NudgeiOSApp.rescheduleNotifications）。
    static var rescheduleReminders: (() async -> Void)?

    private struct DeviceRegistration: Encodable {
        let token: String
        let platform: String
        let environment: String
    }

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        let token = deviceToken.map { String(format: "%02x", $0) }.joined()
        // 讓 APIClient 之後能把這個 token 帶進 X-Nudge-Device-Id header
        // → 後端排除自己、不推給發起 mutation 的裝置。
        PushDeviceToken.current = token
        #if DEBUG
        let environment = "sandbox"
        #else
        let environment = "production"
        #endif
        Task {
            do {
                try await Self.client?.postVoid(
                    "/api/devices",
                    body: DeviceRegistration(
                        token: token,
                        platform: "ios",
                        environment: environment
                    )
                )
            } catch {
                // 未登入（401）或離線都可能失敗；下次登入成功 / 重新啟動會再
                // registerForRemoteNotifications → 再送一次。best-effort。
                print("[PushSync] device registration failed: \(error)")
            }
        }
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        // 模擬器 / 沒有 push capability 的環境會走到這裡；不影響其他功能
        //（30s 輪詢兜底）。
        print("[PushSync] register failed: \(error.localizedDescription)")
    }

    func application(
        _ application: UIApplication,
        didReceiveRemoteNotification userInfo: [AnyHashable: Any]
    ) async -> UIBackgroundFetchResult {
        // silent push = 「資料變了」的訊號，不帶 payload —— 一律整包重抓，
        // 漏掉中間幾發也不影響最終正確性（後端有 5 秒節流）。
        await Self.refreshData?()
        await Self.rescheduleReminders?()
        return .newData
    }
}

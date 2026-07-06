import Foundation

/// 本機的 APNs device token，process-wide 共享。
///
/// PushSyncAppDelegate 在 `didRegisterForRemoteNotifications` 拿到 token 後寫入；
/// APIClient 建 request 時讀出來，帶進 `X-Nudge-Device-Id` header —— 後端用它
/// 排除「發起這次 mutation 的裝置」，不對自己發 silent push（避免打字時每次
/// 存檔都把自己喚醒刷新、跟編輯器樂觀並行打架）。
///
/// macOS 不註冊 remote notification → 永遠 nil → 不帶 header（Mac 本來就
/// 收不到 push，無妨）。
public enum PushDeviceToken {
    private static let lock = NSLock()
    nonisolated(unsafe) private static var _value: String?

    public static var current: String? {
        get { lock.lock(); defer { lock.unlock() }; return _value }
        set { lock.lock(); _value = newValue; lock.unlock() }
    }
}

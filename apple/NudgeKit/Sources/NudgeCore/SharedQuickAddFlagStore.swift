import Foundation

/// IPC flag from widget extension → app for "user wants to quick-add task / card".
///
/// Why not `.widgetURL` deep link：iOS 偶爾會在 cold launch 重 deliver 上次
/// widget tap 的 URL（user 從 app icon 開 app 也會跳 modal）。改成「widget
/// AppIntent button → 寫 flag → app 啟動 / 前景時讀 flag」，沒 URL queue
/// 就沒被 replay 的可能。
///
/// Implementation：App Group UserDefaults — 比 file 輕、寫入即時、用 Bool
/// 不需要 codec。Widget extension 跟 App 都能讀寫同一個 UserDefaults
/// suite。
public final class SharedQuickAddFlagStore: Sendable {
    private static let taskKey = "quickadd.task.pending"
    private static let cardKey = "quickadd.card.pending"

    public init() {}

    public func markTaskPending() {
        defaults?.set(true, forKey: Self.taskKey)
    }

    public func markCardPending() {
        defaults?.set(true, forKey: Self.cardKey)
    }

    /// Read + clear in one call — caller 處理過後 flag 自動消，下次不會重觸。
    public func consumeTaskPending() -> Bool {
        guard let defaults else { return false }
        let value = defaults.bool(forKey: Self.taskKey)
        if value { defaults.removeObject(forKey: Self.taskKey) }
        return value
    }

    public func consumeCardPending() -> Bool {
        guard let defaults else { return false }
        let value = defaults.bool(forKey: Self.cardKey)
        if value { defaults.removeObject(forKey: Self.cardKey) }
        return value
    }

    private var defaults: UserDefaults? {
        UserDefaults(suiteName: AppGroupConfiguration.identifier)
    }
}

import Foundation
import NudgeCore

/// First-run 導覽的顯示閘門（鏡像 web `src/hooks/use-onboarding.ts`）。
///
/// 顯示條件需**同時**滿足（見 spec §5）：
///   ① `onboardedAt` 存在且「近期」（RECENCY 窗內）—— 避免老用戶換新裝置 /
///      清 UserDefaults 時又跳 welcome。
///   ② 本地未記錄「已看過」（per-surface，存 `UserDefaults`，不跨裝置同步）。
///   ③（僅 inline 提示）錨定的 seed 項目仍存在 —— 由呼叫端判斷。
///
/// 「已看過」flag 刻意做成 per-surface：web 看過、Apple 仍可再看一次，成本低、
/// 比跨裝置同步簡單。
public enum OnboardingGate {
    /// 導覽項目 id —— UserDefaults key 為 `nudge.onboarding.seen.<id>`，
    /// 與 web `ONBOARDING_IDS` 對齊。
    public enum Item: String {
        case welcome = "welcome"
        case hintComplete = "hint-complete"
        case hintRecurring = "hint-recurring"
    }

    /// 近期 onboard 窗：7 天（對齊 web `RECENCY_MS`）。
    private static let recencyWindow: TimeInterval = 7 * 24 * 60 * 60

    private static func key(_ item: Item) -> String {
        "nudge.onboarding.seen.\(item.rawValue)"
    }

    /// `onboardedAt`（ISO8601）存在且在近期窗內。
    public static func isRecentlyOnboarded(_ onboardedAt: String?) -> Bool {
        guard let onboardedAt, let date = NudgeISO8601.date(from: onboardedAt) else {
            return false
        }
        return -date.timeIntervalSinceNow < recencyWindow
    }

    public static func isSeen(_ item: Item) -> Bool {
        UserDefaults.standard.bool(forKey: key(item))
    }

    public static func markSeen(_ item: Item) {
        UserDefaults.standard.set(true, forKey: key(item))
    }
}

import Foundation

/// 付費 entitlement（與後端 /api/me 的 entitlement 對齊，Phase 1）。
/// currentPeriodEnd = nil → 永久。isActive / status 由後端算好帶下來。
/// isPremium / accessUntil 為 Slice A 舊欄位，後端仍鏡像回傳（向後相容）。
public struct EntitlementDTO: Codable, Equatable, Sendable {
    public let isActive: Bool
    /// @deprecated Slice A 舊欄位，等同 isActive。
    public let isPremium: Bool
    public let status: String        // trialing | active | past_due | canceled | expired
    public let source: String?
    public let plan: String?         // "monthly" | "annual" | nil
    public let currentPeriodEnd: String?  // ISO8601；nil = 永久
    public let trialEnd: String?
    /// @deprecated Slice A 舊欄位，鏡像 currentPeriodEnd。
    public let accessUntil: String?

    public init(
        isActive: Bool,
        isPremium: Bool,
        status: String,
        source: String?,
        plan: String? = nil,
        currentPeriodEnd: String? = nil,
        trialEnd: String? = nil,
        accessUntil: String?
    ) {
        self.isActive = isActive
        self.isPremium = isPremium
        self.status = status
        self.source = source
        self.plan = plan
        self.currentPeriodEnd = currentPeriodEnd
        self.trialEnd = trialEnd
        self.accessUntil = accessUntil
    }

    /// 距到期天數（無到期 = nil）。向上取整、最小 0。
    public var daysLeft: Int? {
        let end = currentPeriodEnd ?? accessUntil
        guard let end, let date = NudgeISO8601.date(from: end) else { return nil }
        let secs = date.timeIntervalSinceNow
        return max(0, Int(ceil(secs / 86_400)))
    }
}

public struct UserDTO: Codable, Equatable, Sendable {
    public let id: String
    public let email: String
    public let name: String?
    public let avatarUrl: String?
    public let locale: String?
    /// 僅 /api/me 帶；login 回應沒有 → optional。
    public let entitlement: EntitlementDTO?

    public init(
        id: String,
        email: String,
        name: String?,
        avatarUrl: String?,
        locale: String?,
        entitlement: EntitlementDTO? = nil
    ) {
        self.id = id
        self.email = email
        self.name = name
        self.avatarUrl = avatarUrl
        self.locale = locale
        self.entitlement = entitlement
    }
}

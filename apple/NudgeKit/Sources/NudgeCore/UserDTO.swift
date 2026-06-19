import Foundation

/// 付費 entitlement（與後端 /api/me 的 entitlement 對齊）。
/// accessUntil = nil → 永久。isPremium / status 由後端算好帶下來。
public struct EntitlementDTO: Codable, Equatable, Sendable {
    public let isPremium: Bool
    public let status: String        // "trialing" | "active" | "expired"
    public let source: String?
    public let accessUntil: String?  // ISO8601；nil = 永久

    public init(isPremium: Bool, status: String, source: String?, accessUntil: String?) {
        self.isPremium = isPremium
        self.status = status
        self.source = source
        self.accessUntil = accessUntil
    }

    /// 距到期天數（無到期 = nil）。向上取整、最小 0。
    public var daysLeft: Int? {
        guard let accessUntil,
              let date = NudgeISO8601.date(from: accessUntil) else { return nil }
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

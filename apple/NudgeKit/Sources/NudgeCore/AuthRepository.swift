import Foundation
import Observation

/// 持有 auth 狀態、協調 login / logout / me。
/// 不處理 Google SDK 本身——呼叫方自己拿 idToken 傳進來。
@Observable
@MainActor
public final class AuthRepository {
    public enum Status: Sendable, Equatable {
        case unknown
        case authenticated(UserDTO)
        case unauthenticated
    }

    public private(set) var status: Status = .unknown

    /// 付費 entitlement（來自 /api/me）。restoreSession / refreshEntitlement 更新。
    public private(set) var entitlement: EntitlementDTO?

    /// per-platform 付費牆旗標（/api/me 的 paywall；server env 控制，翻 flag
    /// 不用發版）。與 entitlement 一起快取供離線判斷。
    public private(set) var paywallFlags: PaywallFlagsDTO?

    /// 最後一次成功打到 /api/me 的時間（離線寬限計算用）。
    public private(set) var lastValidatedAt: Date?

    // ── 離線快取（UserDefaults）──────────────────────────────────────────
    private struct BillingCache: Codable {
        let entitlement: EntitlementDTO?
        let paywallFlags: PaywallFlagsDTO?
        let lastValidatedAt: Date
    }
    private static let billingCacheKey = "nudge.billing.cache"

    private func persistBillingCache() {
        let cache = BillingCache(
            entitlement: entitlement,
            paywallFlags: paywallFlags,
            lastValidatedAt: Date()
        )
        lastValidatedAt = cache.lastValidatedAt
        if let data = try? JSONEncoder().encode(cache) {
            UserDefaults.standard.set(data, forKey: Self.billingCacheKey)
        }
    }

    private func loadBillingCache() {
        guard let data = UserDefaults.standard.data(forKey: Self.billingCacheKey),
              let cache = try? JSONDecoder().decode(BillingCache.self, from: data)
        else { return }
        entitlement = cache.entitlement
        paywallFlags = cache.paywallFlags
        lastValidatedAt = cache.lastValidatedAt
    }

    /// /api/me 成功回來時統一更新 billing 狀態 + 落快取。
    private func applyBillingState(from user: UserDTO) {
        entitlement = user.entitlement
        paywallFlags = user.paywall
        persistBillingCache()
    }

    /// Mac 硬付費牆判斷（spec：+14 天離線寬限）：
    ///   - flags.mac 未開 → 不落牆（soft mode）
    ///   - 已知無權（最後一次成功驗證說 inactive）→ 落牆
    ///   - 已知有權且驗證未超過 14 天 → 放行
    ///   - 已知有權但超過 14 天沒驗證成功 → 寬限用盡，落牆
    ///   - 完全沒資料（首登離線）→ 放行（fail-open，不鎖死新用戶）
    public var shouldShowMacPaywall: Bool {
        guard paywallFlags?.mac == true else { return false }
        guard let ent = entitlement else { return false }
        if !ent.isActive { return true }
        if let last = lastValidatedAt,
           Date().timeIntervalSince(last) > 14 * 24 * 3600 {
            return true
        }
        return false
    }

    public var currentUser: UserDTO? {
        if case .authenticated(let user) = status { return user }
        return nil
    }

    public var isAuthenticated: Bool {
        if case .authenticated = status { return true }
        return false
    }

    private let client: APIClient
    private let keychain: KeychainStorage
    private let tokenKey = "token"

    public init(client: APIClient, keychain: KeychainStorage) {
        self.client = client
        self.keychain = keychain
        loadBillingCache()
    }

    @discardableResult
    public func login(idToken: String, locale: String? = nil) async throws -> UserDTO {
        let response: MobileAuthResponse = try await client.post(
            "/api/auth/mobile",
            body: MobileAuthRequest(idToken: idToken, locale: locale)
        )
        try keychain.set(response.token, for: tokenKey)
        status = .authenticated(response.user)
        return response.user
    }

    /// Sign in with Apple：app 端拿到的 identityToken（+ 首次的名字/email）
    /// 換我們自己的 app JWT。鏡像 login(idToken:)。
    @discardableResult
    public func loginWithApple(
        identityToken: String,
        fullName: String?,
        email: String?,
        locale: String? = nil
    ) async throws -> UserDTO {
        let response: MobileAuthResponse = try await client.post(
            "/api/auth/apple",
            body: AppleAuthRequest(
                identityToken: identityToken,
                fullName: fullName,
                email: email,
                locale: locale
            )
        )
        try keychain.set(response.token, for: tokenKey)
        status = .authenticated(response.user)
        return response.user
    }

    public func logout() async {
        try? keychain.remove(for: tokenKey)
        status = .unauthenticated
    }

    /// 刪除帳號（App Store 5.1.1(v) 要求）。後端 cascade 刪所有資料，成功後
    /// 清本地 token 並轉 unauthenticated。
    public func deleteAccount() async throws {
        try await client.delete("/api/me")
        try? keychain.remove(for: tokenKey)
        status = .unauthenticated
    }

    /// App 啟動時呼叫：從 keychain 撈 token，打 /api/me 驗證。
    /// 驗證成功 → authenticated；失敗（401）→ 清 token → unauthenticated。
    /// 網路錯誤時保留目前 status（避免網路差就被登出）。
    @discardableResult
    public func restoreSession() async -> Bool {
        guard let token = try? keychain.get(for: tokenKey), !token.isEmpty else {
            status = .unauthenticated
            return false
        }

        do {
            let user: UserDTO = try await client.get("/api/me")
            applyBillingState(from: user)
            status = .authenticated(user)
            return true
        } catch APIError.unauthorized {
            try? keychain.remove(for: tokenKey)
            status = .unauthenticated
            return false
        } catch {
            // 網路錯：保留 token (避免不小心被登出)，但 status 必須脫
            // 離 .unknown 否則 AuthGateView 會卡在初始 spinner 永遠
            // 不顯示登入或內容。
            // - 已認證過 → 維持 .authenticated（網路恢復不會中斷）
            // - 從未認證過（cold start）→ 落到 .unauthenticated 讓
            //   使用者看到登入頁，可選擇重試或重新登入
            if case .authenticated = status {
                return false
            }
            status = .unauthenticated
            return false
        }
    }

    public func handleUnauthorized() async {
        try? keychain.remove(for: tokenKey)
        status = .unauthenticated
    }

    /// 重新抓 entitlement（/api/me）—— SettingsView 出現時呼叫，確保顯示最新
    /// 訂閱狀態（login 回應沒帶 entitlement，靠這個補）。網路錯誤靜默忽略。
    public func refreshEntitlement() async {
        do {
            let user: UserDTO = try await client.get("/api/me")
            applyBillingState(from: user)
        } catch {
            if !APIError.isCancellation(error) {
                print("[AuthRepository] refreshEntitlement failed: \(error)")
            }
        }
    }

    /// 重新抓完整 user（/api/me）並更新 status + entitlement。login 回應不帶
    /// `entitlement` / `onboardedAt`，first-run 導覽需要 `onboardedAt` → 進主
    /// 畫面時呼叫一次補齊。網路 / 其他錯誤靜默忽略（維持現有 status）。
    public func refreshCurrentUser() async {
        do {
            let user: UserDTO = try await client.get("/api/me")
            applyBillingState(from: user)
            status = .authenticated(user)
        } catch {
            if !APIError.isCancellation(error) {
                print("[AuthRepository] refreshCurrentUser failed: \(error)")
            }
        }
    }

    /// Mac→web 結帳的 OTT 手遞：向後端要一次性結帳 URL（60 秒、單次用途），
    /// 呼叫端用預設瀏覽器開啟。web 端免登入即落 /paywall（checkout cookie）。
    public func requestCheckoutURL() async throws -> URL {
        struct Empty: Codable {}
        struct Response: Codable { let url: String }
        let response: Response = try await client.post("/api/billing/checkout-session", body: Empty())
        guard let url = URL(string: response.url) else { throw APIError.invalidResponse }
        return url
    }

    /// Paddle customer portal（管理/取消/換卡）URL —— source=paddle 才有效。
    public func requestPortalURL() async throws -> URL {
        struct Empty: Codable {}
        struct Response: Codable { let url: String }
        let response: Response = try await client.post("/api/billing/portal", body: Empty())
        guard let url = URL(string: response.url) else { throw APIError.invalidResponse }
        return url
    }

    /// 兌換 promo code → 更新 entitlement、回獲得天數。失敗 throw（server 回
    /// 400/各 reason，native 顯示通用錯誤訊息）。
    @discardableResult
    public func redeemPromo(code: String) async throws -> Int {
        struct Body: Codable { let code: String }
        struct Response: Codable { let grantedDays: Int?; let entitlement: EntitlementDTO? }
        let response: Response = try await client.post(
            "/api/promo/redeem",
            body: Body(code: code)
        )
        entitlement = response.entitlement
        return response.grantedDays ?? 0
    }
}

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
    }

    @discardableResult
    public func login(idToken: String) async throws -> UserDTO {
        let response: MobileAuthResponse = try await client.post(
            "/api/auth/mobile",
            body: MobileAuthRequest(idToken: idToken)
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
        email: String?
    ) async throws -> UserDTO {
        let response: MobileAuthResponse = try await client.post(
            "/api/auth/apple",
            body: AppleAuthRequest(
                identityToken: identityToken,
                fullName: fullName,
                email: email
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
            entitlement = user.entitlement
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
            entitlement = user.entitlement
        } catch {
            if !APIError.isCancellation(error) {
                print("[AuthRepository] refreshEntitlement failed: \(error)")
            }
        }
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

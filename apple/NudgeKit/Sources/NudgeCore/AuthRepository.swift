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

    public func logout() async {
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
            status = .authenticated(user)
            return true
        } catch APIError.unauthorized {
            try? keychain.remove(for: tokenKey)
            status = .unauthenticated
            return false
        } catch {
            // 網路錯等：不動 token，status 保持現況
            return false
        }
    }

    public func handleUnauthorized() async {
        try? keychain.remove(for: tokenKey)
        status = .unauthenticated
    }
}

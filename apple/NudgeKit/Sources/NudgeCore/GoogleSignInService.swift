import Foundation

/// Google Sign-In 的平台無關介面。
/// iOS / macOS target 各自實作，把 idToken 回傳給 AuthRepository。
@MainActor
public protocol GoogleSignInService: Sendable {
    /// 啟動 Google 登入流程，完成後 resolve 成 idToken。
    /// 使用者取消時丟 GoogleSignInError.canceled。
    func signIn() async throws -> String

    /// 登出 Google account（本地 session，不 revoke）。
    func signOut()
}

public enum GoogleSignInError: Error, Sendable {
    case canceled
    case missingIdToken
    case platform(underlying: any Error)
}

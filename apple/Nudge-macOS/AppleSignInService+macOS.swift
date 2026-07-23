import AppKit
import AuthenticationServices
import Foundation
import NudgeCore

/// Mac 的 Sign in with Apple — 走伺服器中繼 web OAuth，**不用**原生
/// AuthenticationServices SIWA（restricted entitlement 在 Developer ID
/// 分發會 AMFI SIGKILL）。流程：開 {base}/api/auth/apple/start →
/// Apple 授權 → 後端驗證併號簽 app JWT → redirect nudge://auth/apple
/// #token=…，這裡取 token 回傳。
///
/// 併發規則照 GoogleSignInServiceMacOS：class 非 @MainActor、
/// ASWebAuthenticationSession callback 只 cont.resume、碰 NSApp/NSWindow
/// 一律 DispatchQueue.main.async（違反 → dispatch_assert_queue SIGTRAP）。
final class AppleSignInServiceMacOS: NSObject, @unchecked Sendable {
    enum AppleWebSignInError: Error, LocalizedError {
        case canceled
        case server(String)
        case platform(Error)

        var errorDescription: String? {
            switch self {
            case .canceled: return nil
            case .server(let code): return "Apple sign-in failed (\(code))"
            case .platform(let error): return error.localizedDescription
            }
        }
    }

    private let baseURL: URL

    init(baseURL: URL) {
        self.baseURL = baseURL
        super.init()
    }

    /// 回傳後端簽好的 app JWT。使用者取消 → throw .canceled（呼叫端靜默）。
    func signIn(locale: String?) async throws -> String {
        var comps = URLComponents(
            url: baseURL.appendingPathComponent("api/auth/apple/start"),
            resolvingAgainstBaseURL: false
        )!
        var query = [URLQueryItem(name: "source", value: "mac")]
        if let locale, !locale.isEmpty {
            query.append(URLQueryItem(name: "locale", value: locale))
        }
        comps.queryItems = query
        let authURL = comps.url!

        let callbackURL: URL = try await withCheckedThrowingContinuation { (cont: CheckedContinuation<URL, Error>) in
            DispatchQueue.main.async {
                guard let window = NSApp.keyWindow ?? NSApp.windows.first else {
                    cont.resume(throwing: AppleWebSignInError.platform(NSError(
                        domain: "AppleOAuth", code: -10,
                        userInfo: [NSLocalizedDescriptionKey: "no window available"]
                    )))
                    return
                }

                let session = ASWebAuthenticationSession(
                    url: authURL,
                    callbackURLScheme: "nudge"
                ) { url, error in
                    // 背景 XPC queue — 只能 cont.resume，不碰 main-only API。
                    if let url {
                        cont.resume(returning: url)
                    } else if let nsError = error as NSError?,
                              nsError.domain == ASWebAuthenticationSessionErrorDomain,
                              nsError.code == ASWebAuthenticationSessionError.canceledLogin.rawValue {
                        cont.resume(throwing: AppleWebSignInError.canceled)
                    } else {
                        cont.resume(throwing: AppleWebSignInError.platform(
                            error ?? NSError(domain: "AppleOAuth", code: -1,
                                             userInfo: [NSLocalizedDescriptionKey: "no callback URL"])
                        ))
                    }
                }

                let provider = AppleMacOSContextProvider(window: window)
                session.presentationContextProvider = provider
                objc_setAssociatedObject(session, &Self.providerKey, provider, .OBJC_ASSOCIATION_RETAIN_NONATOMIC)
                session.prefersEphemeralWebBrowserSession = false
                if !session.start() {
                    cont.resume(throwing: AppleWebSignInError.platform(NSError(
                        domain: "AppleOAuth", code: -2,
                        userInfo: [NSLocalizedDescriptionKey: "ASWebAuthenticationSession failed to start"]
                    )))
                }
            }
        }

        // nudge://auth/apple#token=… / #error=…
        guard let cb = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false),
              let fragment = cb.fragment else {
            throw AppleWebSignInError.server("no_fragment")
        }
        var params: [String: String] = [:]
        for pair in fragment.split(separator: "&") {
            let kv = pair.split(separator: "=", maxSplits: 1)
            if kv.count == 2 {
                params[String(kv[0])] = String(kv[1]).removingPercentEncoding ?? String(kv[1])
            }
        }
        if let errorCode = params["error"] {
            if errorCode == "cancelled" { throw AppleWebSignInError.canceled }
            throw AppleWebSignInError.server(errorCode)
        }
        guard let token = params["token"], !token.isEmpty else {
            throw AppleWebSignInError.server("no_token")
        }
        return token
    }

    private static var providerKey: UInt8 = 0
}

/// 同 GoogleSignInService+macOS 的 provider：init 時抓 NSWindow，之後任何
/// thread 直接 return，不做 actor hop。
private final class AppleMacOSContextProvider: NSObject, ASWebAuthenticationPresentationContextProviding, @unchecked Sendable {
    private let capturedWindow: NSWindow

    init(window: NSWindow) {
        self.capturedWindow = window
        super.init()
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        return capturedWindow
    }
}

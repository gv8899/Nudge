import AppKit
import AuthenticationServices
import CryptoKit
import Foundation
import NudgeCore

/// Mac 用手動 OAuth (ASWebAuthenticationSession + PKCE) 取代 GoogleSignIn
/// SDK，繞過 SDK 內部 GTMAppAuth keychain 依賴 — 該依賴在 Developer ID
/// 分發 + macOS 26 嚴格 AMFI 環境下無解。
///
/// 重要：class 不能 `@MainActor`！原因：ASWebAuthenticationSession 的
/// completion handler 從 XPC reply background queue 呼叫，當我們在那裡
/// `cont.resume(returning:)`，Swift Concurrency 試圖把 awaiting task hop
/// 回 MainActor、`swift_task_checkIsolatedSwift` 用 `dispatch_assert_queue`
/// 嚴格驗證 → 不在 main thread → SIGTRAP。所以整個流程刻意 nonisolated，
/// 只在需要碰 NSApp / NSWindow 時用 `DispatchQueue.main.async` 顯式跳到
/// 主線程。
///
/// `@unchecked Sendable` — class 只持有不可變的 `clientID`，沒共享 mutable
/// state，邏輯上是 thread-safe，但 NSObject parent 阻止編譯器自動驗證。
final class GoogleSignInServiceMacOS: NSObject, GoogleSignInService, @unchecked Sendable {
    private let clientID: String

    init(clientID: String) {
        self.clientID = clientID
        super.init()
    }

    func signIn() async throws -> String {
        let redirectScheme = "com.googleusercontent.apps." + clientID
            .replacingOccurrences(of: ".apps.googleusercontent.com", with: "")
        let redirectURI = "\(redirectScheme):/oauth2redirect/google"
        let codeVerifier = Self.randomCodeVerifier()
        let codeChallenge = Self.sha256Base64URL(codeVerifier)
        let state = UUID().uuidString

        var components = URLComponents(string: "https://accounts.google.com/o/oauth2/v2/auth")!
        components.queryItems = [
            URLQueryItem(name: "client_id", value: clientID),
            URLQueryItem(name: "redirect_uri", value: redirectURI),
            URLQueryItem(name: "response_type", value: "code"),
            URLQueryItem(name: "scope", value: "openid email profile"),
            URLQueryItem(name: "state", value: state),
            URLQueryItem(name: "code_challenge", value: codeChallenge),
            URLQueryItem(name: "code_challenge_method", value: "S256"),
        ]
        let authURL = components.url!

        // Bridge async/await ↔ ASWebAuthenticationSession 的 completion
        // callback。所有 NSWindow / session.start() 觸碰主線程的事都
        // 透過 DispatchQueue.main.async 排到主線程；session 的 callback
        // 在背景 queue 觸發、那裡只 cont.resume，**不碰任何 main-only
        // API**，避免 dispatch_assert_queue SIGTRAP。
        let callbackURL: URL = try await withCheckedThrowingContinuation { (cont: CheckedContinuation<URL, Error>) in
            DispatchQueue.main.async {
                guard let window = NSApp.keyWindow ?? NSApp.windows.first else {
                    cont.resume(throwing: GoogleSignInError.platform(underlying: NSError(
                        domain: "GoogleOAuth", code: -10,
                        userInfo: [NSLocalizedDescriptionKey: "no window available"]
                    )))
                    return
                }

                let session = ASWebAuthenticationSession(
                    url: authURL,
                    callbackURLScheme: redirectScheme
                ) { url, error in
                    // 這個 closure 從 XPC reply 背景 queue 觸發，**只能**
                    // 做 cont.resume()，不能碰任何 NSApp / NSWindow。
                    if let url {
                        cont.resume(returning: url)
                    } else if let nsError = error as NSError?,
                              nsError.domain == ASWebAuthenticationSessionErrorDomain,
                              nsError.code == ASWebAuthenticationSessionError.canceledLogin.rawValue {
                        cont.resume(throwing: GoogleSignInError.canceled)
                    } else {
                        cont.resume(throwing: GoogleSignInError.platform(
                            underlying: error ?? NSError(domain: "GoogleOAuth", code: -1, userInfo: [NSLocalizedDescriptionKey: "no callback URL"])
                        ))
                    }
                }

                let provider = MacOSContextProvider(window: window)
                session.presentationContextProvider = provider
                // session 只 weak ref provider，需要 associated object 持有
                // 避免太早 release。
                objc_setAssociatedObject(session, &Self.providerKey, provider, .OBJC_ASSOCIATION_RETAIN_NONATOMIC)

                session.prefersEphemeralWebBrowserSession = false
                if !session.start() {
                    cont.resume(throwing: GoogleSignInError.platform(
                        underlying: NSError(domain: "GoogleOAuth", code: -2, userInfo: [NSLocalizedDescriptionKey: "ASWebAuthenticationSession failed to start"])
                    ))
                }
            }
        }

        // Parse callback + exchange code for tokens — 這段在背景 thread
        // 跑沒問題，URLSession 本來就 thread-safe。
        guard let cbComponents = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false) else {
            throw GoogleSignInError.platform(underlying: NSError(
                domain: "GoogleOAuth", code: -3,
                userInfo: [NSLocalizedDescriptionKey: "callback URL not parseable"]
            ))
        }
        let queryItems = cbComponents.queryItems ?? []
        if let returnedState = queryItems.first(where: { $0.name == "state" })?.value,
           returnedState != state {
            throw GoogleSignInError.platform(underlying: NSError(
                domain: "GoogleOAuth", code: -4,
                userInfo: [NSLocalizedDescriptionKey: "state mismatch (CSRF guard)"]
            ))
        }
        if let oauthError = queryItems.first(where: { $0.name == "error" })?.value {
            throw GoogleSignInError.platform(underlying: NSError(
                domain: "GoogleOAuth", code: -5,
                userInfo: [NSLocalizedDescriptionKey: "OAuth error: \(oauthError)"]
            ))
        }
        guard let authCode = queryItems.first(where: { $0.name == "code" })?.value else {
            throw GoogleSignInError.platform(underlying: NSError(
                domain: "GoogleOAuth", code: -6,
                userInfo: [NSLocalizedDescriptionKey: "no auth code in callback"]
            ))
        }

        var tokenReq = URLRequest(url: URL(string: "https://oauth2.googleapis.com/token")!)
        tokenReq.httpMethod = "POST"
        tokenReq.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        let formBody = [
            "code": authCode,
            "client_id": clientID,
            "redirect_uri": redirectURI,
            "grant_type": "authorization_code",
            "code_verifier": codeVerifier,
        ].map { key, value in
            "\(key)=\(value.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "")"
        }.joined(separator: "&")
        tokenReq.httpBody = formBody.data(using: .utf8)

        let (data, response) = try await URLSession.shared.data(for: tokenReq)
        if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode != 200 {
            let body = String(data: data, encoding: .utf8) ?? ""
            print("[GoogleSignIn macOS] token endpoint \(httpResponse.statusCode): \(body)")
            throw GoogleSignInError.platform(underlying: NSError(
                domain: "GoogleOAuth", code: httpResponse.statusCode,
                userInfo: [NSLocalizedDescriptionKey: "token endpoint HTTP \(httpResponse.statusCode)"]
            ))
        }
        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let idToken = json["id_token"] as? String else {
            throw GoogleSignInError.missingIdToken
        }
        return idToken
    }

    func signOut() {
        // 手動 OAuth 沒 persist 任何 state；signOut 是 no-op。
    }

    private static var providerKey: UInt8 = 0

    private static func randomCodeVerifier() -> String {
        var bytes = [UInt8](repeating: 0, count: 32)
        _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        return Data(bytes).base64URLEncoded()
    }

    private static func sha256Base64URL(_ input: String) -> String {
        let digest = SHA256.hash(data: Data(input.utf8))
        return Data(digest).base64URLEncoded()
    }
}

extension GoogleSignInServiceMacOS {
    static func fromInfoPlist() -> GoogleSignInServiceMacOS {
        guard let clientID = Bundle.main.object(forInfoDictionaryKey: "GoogleMacClientID") as? String,
              !clientID.isEmpty else {
            fatalError("GoogleMacClientID missing in Info.plist")
        }
        return GoogleSignInServiceMacOS(clientID: clientID)
    }
}

private extension Data {
    func base64URLEncoded() -> String {
        base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}

/// Provider 在 init 時拿 NSWindow reference，後續從任何 thread 直接 return。
/// 不做 main-thread access、不做 actor hop，避免任何 isolation crash。
private final class MacOSContextProvider: NSObject, ASWebAuthenticationPresentationContextProviding, @unchecked Sendable {
    private let capturedWindow: NSWindow

    init(window: NSWindow) {
        self.capturedWindow = window
        super.init()
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        return capturedWindow
    }
}

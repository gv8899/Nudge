import Foundation
import AuthenticationServices
#if canImport(UIKit)
import UIKit
#endif
#if canImport(AppKit)
import AppKit
#endif

/// Drives the Google Calendar OAuth handoff via `ASWebAuthenticationSession`.
/// The server's mobile-start endpoint gives us a pre-signed URL; the session
/// finishes when the server redirects to `nudge://calendar/connected`.
@MainActor
public final class CalendarOAuthCoordinator: NSObject {
    public enum ConnectError: Error {
        case userCancelled
        case sessionFailed(Error)
        case invalidCallback
    }

    private static let callbackScheme = "nudge"

    public override init() {
        super.init()
    }

    public func present(connectURL: URL) async throws {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            let session = ASWebAuthenticationSession(
                url: connectURL,
                callbackURLScheme: Self.callbackScheme
            ) { callback, error in
                if let error = error as? ASWebAuthenticationSessionError,
                   error.code == .canceledLogin {
                    continuation.resume(throwing: ConnectError.userCancelled)
                    return
                }
                if let error {
                    continuation.resume(throwing: ConnectError.sessionFailed(error))
                    return
                }
                guard let callback, callback.scheme == Self.callbackScheme else {
                    continuation.resume(throwing: ConnectError.invalidCallback)
                    return
                }
                continuation.resume()
            }
            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = false
            if !session.start() {
                continuation.resume(throwing: ConnectError.sessionFailed(
                    NSError(domain: "CalendarOAuth", code: -1)
                ))
            }
        }
    }
}

extension CalendarOAuthCoordinator: ASWebAuthenticationPresentationContextProviding {
    public func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        #if canImport(UIKit)
        let scenes = UIApplication.shared.connectedScenes
        let window = scenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
            .first { $0.isKeyWindow }
        return window ?? ASPresentationAnchor()
        #elseif canImport(AppKit)
        return NSApplication.shared.keyWindow ?? ASPresentationAnchor()
        #else
        return ASPresentationAnchor()
        #endif
    }
}

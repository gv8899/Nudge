import Foundation
import AppKit
import GoogleSignIn
import NudgeCore

@MainActor
final class GoogleSignInServiceMacOS: GoogleSignInService {
    private let clientID: String

    init(clientID: String) {
        self.clientID = clientID
        GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: clientID)
    }

    func signIn() async throws -> String {
        guard let window = NSApp.keyWindow ?? NSApp.windows.first else {
            throw GoogleSignInError.platform(underlying: NSError(
                domain: "GoogleSignInService", code: -1,
                userInfo: [NSLocalizedDescriptionKey: "No window available"]
            ))
        }

        do {
            let result = try await GIDSignIn.sharedInstance.signIn(withPresenting: window)
            guard let idToken = result.user.idToken?.tokenString else {
                throw GoogleSignInError.missingIdToken
            }
            return idToken
        } catch {
            let nsError = error as NSError
            print("[GoogleSignIn macOS] failed: domain=\(nsError.domain) code=\(nsError.code) userInfo=\(nsError.userInfo)")
            if nsError.domain == "com.google.GIDSignIn"
                && nsError.code == GIDSignInError.Code.canceled.rawValue {
                throw GoogleSignInError.canceled
            }
            throw GoogleSignInError.platform(underlying: error)
        }
    }

    func signOut() {
        GIDSignIn.sharedInstance.signOut()
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

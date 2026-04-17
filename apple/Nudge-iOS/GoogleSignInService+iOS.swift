import Foundation
import UIKit
import GoogleSignIn
import NudgeCore

@MainActor
final class GoogleSignInServiceIOS: GoogleSignInService {
    private let clientID: String

    init(clientID: String) {
        self.clientID = clientID
        GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: clientID)
    }

    func signIn() async throws -> String {
        guard let rootVC = Self.rootViewController() else {
            throw GoogleSignInError.platform(underlying: NSError(
                domain: "GoogleSignInService", code: -1,
                userInfo: [NSLocalizedDescriptionKey: "No root view controller"]
            ))
        }

        do {
            let result = try await GIDSignIn.sharedInstance.signIn(
                withPresenting: rootVC
            )
            guard let idToken = result.user.idToken?.tokenString else {
                throw GoogleSignInError.missingIdToken
            }
            return idToken
        } catch let error as NSError where error.code == GIDSignInError.Code.canceled.rawValue {
            throw GoogleSignInError.canceled
        } catch {
            throw GoogleSignInError.platform(underlying: error)
        }
    }

    func signOut() {
        GIDSignIn.sharedInstance.signOut()
    }

    private static func rootViewController() -> UIViewController? {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
            .first { $0.isKeyWindow }?
            .rootViewController
    }
}

extension GoogleSignInServiceIOS {
    static func fromInfoPlist() -> GoogleSignInServiceIOS {
        guard let clientID = Bundle.main.object(forInfoDictionaryKey: "GoogleIOSClientID") as? String,
              !clientID.isEmpty else {
            fatalError("GoogleIOSClientID missing in Info.plist")
        }
        return GoogleSignInServiceIOS(clientID: clientID)
    }
}

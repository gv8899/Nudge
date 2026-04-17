import SwiftUI
import SwiftData
import GoogleSignIn
import NudgeCore
import NudgeData
import NudgeUI

@main
struct NudgeiOSApp: App {
    @State private var auth: AuthRepository
    private let googleSignIn: GoogleSignInServiceIOS

    init() {
        let keychain = KeychainStorage(service: "tw.nudge.app")
        let tokenProvider: APIClient.TokenProvider = {
            try? keychain.get(for: "token")
        }

        // Phase 1: restoreSession 自己處理 401；其他 API call 還沒有。
        // Phase 2 加其他 API 呼叫時再補 unauthorizedHandler → repo.handleUnauthorized 的線。
        let client = APIClient(
            configuration: .default,
            tokenProvider: tokenProvider
        )
        let repo = AuthRepository(client: client, keychain: keychain)
        self._auth = State(initialValue: repo)

        self.googleSignIn = GoogleSignInServiceIOS.fromInfoPlist()
    }

    var body: some Scene {
        WindowGroup {
            AuthGateView(
                auth: auth,
                onLoginRequested: performLogin
            ) {
                PlatformRootView(auth: auth)
            }
            .task {
                await auth.restoreSession()
            }
            .onOpenURL { url in
                _ = GIDSignIn.sharedInstance.handle(url)
            }
        }
        .modelContainer(NudgeModelContainer.make())
    }

    private func performLogin() async -> Result<Void, Error> {
        do {
            let idToken = try await googleSignIn.signIn()
            _ = try await auth.login(idToken: idToken)
            return .success(())
        } catch {
            return .failure(error)
        }
    }
}

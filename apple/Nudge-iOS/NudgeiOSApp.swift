import SwiftUI
import SwiftData
import GoogleSignIn
import NudgeCore
import NudgeData
import NudgeUI

@main
struct NudgeiOSApp: App {
    @State private var auth: AuthRepository
    @State private var taskRepo: TaskRepository
    @State private var tagRepo: TagRepository
    @State private var calendarRepo: CalendarRepository
    @State private var cardRepo: CardRepository
    private let container: ModelContainer
    private let googleSignIn: GoogleSignInServiceIOS

    init() {
        NudgeAppearance.configure()

        let keychain = KeychainStorage(service: "tw.nudge.app")
        let tokenProvider: APIClient.TokenProvider = {
            try? keychain.get(for: "token")
        }
        let client = APIClient(
            configuration: .default,
            tokenProvider: tokenProvider
        )
        let authRepo = AuthRepository(client: client, keychain: keychain)
        let container = NudgeModelContainer.make()
        let taskRepo = TaskRepository(client: client, container: container)
        let tagRepo = TagRepository(client: client)
        let calRepo = CalendarRepository(client: client)
        let cardRepo = CardRepository(client: client)

        // Wire 401 handler after repos are live
        client.setUnauthorizedHandler { [weak authRepo] in
            await authRepo?.handleUnauthorized()
        }

        self._auth = State(initialValue: authRepo)
        self._taskRepo = State(initialValue: taskRepo)
        self._tagRepo = State(initialValue: tagRepo)
        self._calendarRepo = State(initialValue: calRepo)
        self._cardRepo = State(initialValue: cardRepo)
        self.container = container
        self.googleSignIn = GoogleSignInServiceIOS.fromInfoPlist()
    }

    var body: some Scene {
        WindowGroup {
            AuthGateView(
                auth: auth,
                onLoginRequested: performLogin
            ) {
                PlatformRootView(auth: auth)
                    .environment(taskRepo)
                    .environment(tagRepo)
                    .environment(calendarRepo)
                    .environment(cardRepo)
            }
            .task {
                await auth.restoreSession()
            }
            .onOpenURL { url in
                _ = GIDSignIn.sharedInstance.handle(url)
            }
        }
        .modelContainer(container)
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

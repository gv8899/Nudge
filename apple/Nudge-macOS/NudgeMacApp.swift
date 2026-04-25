import SwiftUI
import SwiftData
import GoogleSignIn
import NudgeCore
import NudgeData
import NudgeUI

@main
struct NudgeMacApp: App {
    @State private var auth: AuthRepository
    @State private var taskRepo: TaskRepository
    @State private var tagRepo: TagRepository
    @State private var calendarRepo: CalendarRepository
    @State private var cardRepo: CardRepository
    @State private var noteRepo: NoteRepository
    @State private var recurrenceRepo: RecurrenceRepository
    @State private var notificationPrefsRepo: NotificationPreferencesRepository
    private let container: ModelContainer
    private let googleSignIn: GoogleSignInServiceMacOS

    init() {
        NudgeAppearance.configure()

        let keychain = KeychainStorage(service: "tw.nudge.mac")
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
        let noteRepo = NoteRepository(client: client)
        let recurrenceRepo = RecurrenceRepository(client: client)
        let notificationPrefsRepo = NotificationPreferencesRepository(client: client)

        // Wire 401 handler after repos are live
        client.setUnauthorizedHandler { [weak authRepo] in
            await authRepo?.handleUnauthorized()
        }

        self._auth = State(initialValue: authRepo)
        self._taskRepo = State(initialValue: taskRepo)
        self._tagRepo = State(initialValue: tagRepo)
        self._calendarRepo = State(initialValue: calRepo)
        self._cardRepo = State(initialValue: cardRepo)
        self._noteRepo = State(initialValue: noteRepo)
        self._recurrenceRepo = State(initialValue: recurrenceRepo)
        self._notificationPrefsRepo = State(initialValue: notificationPrefsRepo)
        self.container = container
        self.googleSignIn = GoogleSignInServiceMacOS.fromInfoPlist()
    }

    var body: some Scene {
        WindowGroup {
            NudgePreferencesApplier {
                AuthGateView(
                    auth: auth,
                    onLoginRequested: performLogin
                ) {
                    PlatformRootView(auth: auth)
                        .environment(taskRepo)
                        .environment(tagRepo)
                        .environment(calendarRepo)
                        .environment(cardRepo)
                        .environment(noteRepo)
                        .environment(recurrenceRepo)
                        .environment(notificationPrefsRepo)
                }
                .task {
                    await auth.restoreSession()
                }
                .onOpenURL { url in
                    _ = GIDSignIn.sharedInstance.handle(url)
                }
                .frame(minWidth: 900, minHeight: 600)
            }
        }
        .modelContainer(container)
        .commands {
            NudgeCommands()
        }

        Settings {
            Text(verbatim: "Settings (Phase 5)")
                .padding(40)
        }
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

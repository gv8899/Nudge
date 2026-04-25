import SwiftUI
import SwiftData
import UserNotifications
import GoogleSignIn
import NudgeCore
import NudgeData
import NudgeUI

@main
struct NudgeiOSApp: App {
    @Environment(\.scenePhase) private var scenePhase
    @State private var auth: AuthRepository
    @State private var taskRepo: TaskRepository
    @State private var tagRepo: TagRepository
    @State private var calendarRepo: CalendarRepository
    @State private var cardRepo: CardRepository
    @State private var noteRepo: NoteRepository
    @State private var recurrenceRepo: RecurrenceRepository
    @State private var notificationPrefsRepo: NotificationPreferencesRepository
    @State private var notificationRouter: NotificationRouter
    private let container: ModelContainer
    private let googleSignIn: GoogleSignInServiceIOS

    init() {
        NudgeAppearance.configure()
        // Foreground banner support — without this, sim notifications are
        // silent while the app is open and "通知沒觸發" looks like a no-op.
        UNUserNotificationCenter.current().delegate = NudgeNotificationDelegate.shared
        // Router lets the delegate hand a tapped notification's task id
        // off to DailyHostView for navigation, without coupling the
        // delegate to the view layer.
        let router = NotificationRouter()
        NudgeNotificationDelegate.router = router

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
        let noteRepo = NoteRepository(client: client)
        let recurrenceRepo = RecurrenceRepository(client: client)
        let notificationPrefsRepo = NotificationPreferencesRepository(client: client)
        let notificationRouter = router

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
        self._notificationRouter = State(initialValue: notificationRouter)
        self.container = container
        self.googleSignIn = GoogleSignInServiceIOS.fromInfoPlist()
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
                        .environment(notificationRouter)
                }
                .task {
                    await auth.restoreSession()
                    // First-launch reschedule: scenePhase .onChange may
                    // not fire for the initial active state, so do it
                    // here too. Idempotent.
                    await rescheduleNotifications()
                }
                .onOpenURL { url in
                    _ = GIDSignIn.sharedInstance.handle(url)
                }
                .onChange(of: scenePhase) { _, phase in
                    if phase == .active {
                        Task { await rescheduleNotifications() }
                    }
                }
            }
        }
        .modelContainer(container)
    }

    /// Per-task reminders are armed by the schedule sheet itself, so all
    /// the app needs to do on launch is make sure notification authorization
    /// has been requested at least once. Morning/evening summary batches
    /// are intentionally not armed here — that surface is deferred until
    /// the body content (task counts / streak) lands. Also clears any
    /// leftover batch notifications from previous test runs so they don't
    /// keep firing.
    private func rescheduleNotifications() async {
        _ = await NotificationScheduler.shared.requestAuthIfNeeded()
        UNUserNotificationCenter.current().removePendingNotificationRequests(
            withIdentifiers: ["daily-batch-morning", "daily-batch-evening"]
        )
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

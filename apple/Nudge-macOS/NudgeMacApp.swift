import SwiftUI
import SwiftData
import UserNotifications
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
    @State private var notificationRouter: NotificationRouter
    private let reminderRepo: ReminderRepository
    /// 字級倍率，由選單 ⌘+ / ⌘- / ⌘0 調整。透過
    /// `\.nudgeFontScale` env 注入給 NudgeUI 內所有 `.nudgeFont(...)`
    /// modifier 使用。Range 0.85-1.4 (clamp 在 listener)。
    @AppStorage("nudgeFontScale") private var fontScale: Double = 1.0
    private let container: ModelContainer
    private let googleSignIn: GoogleSignInServiceMacOS

    init() {
        NudgeAppearance.configure()
        // Foreground banner support — without this, notifications stay
        // silent while the app is open and "通知沒觸發" looks like a no-op.
        UNUserNotificationCenter.current().delegate = NudgeNotificationDelegate.shared
        // Router lets the delegate hand a tapped notification's task id
        // off to DailyHostView for navigation, without coupling the
        // delegate to the view layer.
        let router = NotificationRouter()
        NudgeNotificationDelegate.router = router

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
        self._notificationRouter = State(initialValue: router)
        self.reminderRepo = ReminderRepository(client: client)
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
                        .environment(notificationRouter)
                }
                .task {
                    await auth.restoreSession()
                    // Rebuild per-task reminders from server state on launch.
                    // Local notifications are per-device — without this sync
                    // a reminder set on iPhone would never fire on this Mac
                    // (and vice versa). requestAuthIfNeeded runs inside.
                    do {
                        let reminders = try await reminderRepo.all()
                        await NotificationScheduler.shared
                            .rescheduleAllTaskReminders(reminders)
                    } catch {
                        print("[NudgeMacApp] reminder sync failed: \(error)")
                    }
                }
                .onOpenURL { url in
                    _ = GIDSignIn.sharedInstance.handle(url)
                }
                .frame(minWidth: 900, minHeight: 600)
                // ⌘+ / ⌘- / ⌘0 字級縮放 — 0.85x 到 1.4x，每次 ±0.1。
                // 0.85 是底線（再小 mac 已經接近不可讀），1.4 是上限
                // (再大 row layout 會擠到變不可用)。值持久化在
                // @AppStorage("nudgeFontScale")，下次開啟保留設定。
                .environment(\.nudgeFontScale, CGFloat(fontScale))
                .onReceive(NotificationCenter.default.publisher(for: NudgeCommands.zoomInNotification)) { _ in
                    fontScale = min(fontScale + 0.1, 1.4)
                }
                .onReceive(NotificationCenter.default.publisher(for: NudgeCommands.zoomOutNotification)) { _ in
                    fontScale = max(fontScale - 0.1, 0.85)
                }
                .onReceive(NotificationCenter.default.publisher(for: NudgeCommands.zoomResetNotification)) { _ in
                    fontScale = 1.0
                }
            }
        }
        .modelContainer(container)
        // Window chrome — open at a comfortable laptop-friendly size
        // (1100×720 fits a 13" without overflowing), constrained to
        // the content's min size so users can't resize below 900×600
        // and break the sidebar layout. Unified title bar is the
        // current macOS default look.
        .defaultSize(width: 1100, height: 720)
        .windowResizability(.contentMinSize)
        .windowToolbarStyle(.unified(showsTitle: false))
        .commands {
            NudgeCommandsMenu()
        }

        // Settings scene — ⌘, opens this. Previously this was a
        // "Settings (Phase 5)" stub while the real SettingsView lived
        // as a sidebar item; that meant two settings entry points,
        // one of which was a placeholder. Consolidating to the
        // platform-standard Settings scene and removing the sidebar
        // item.
        Settings {
            NudgePreferencesApplier {
                SettingsView(auth: auth)
                    .environment(taskRepo)
                    .environment(tagRepo)
                    .environment(calendarRepo)
                    .environment(cardRepo)
                    .environment(noteRepo)
                    .environment(recurrenceRepo)
                    .environment(notificationPrefsRepo)
                    .frame(minWidth: 560, minHeight: 520)
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

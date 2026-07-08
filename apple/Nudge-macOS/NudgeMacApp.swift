import SwiftUI
import SwiftData
import AppKit
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
    @State private var appUpdater: AppUpdater
    private let reminderRepo: ReminderRepository
    /// Throttle for the foreground reminder re-sync. A Mac app often
    /// stays open for days, so we re-sync on `didBecomeActive` to catch
    /// reminders set on another device — but skip if we synced very
    /// recently (rapid ⌘-Tab shouldn't hammer the API).
    @State private var lastReminderSync: Date = .distantPast
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
        self._appUpdater = State(initialValue: AppUpdater(client: client))
        self.reminderRepo = ReminderRepository(client: client)
        self.container = container
        self.googleSignIn = GoogleSignInServiceMacOS.fromInfoPlist()
    }

    var body: some Scene {
        WindowGroup {
            NudgePreferencesApplier {
                AuthGateView(
                    auth: auth,
                    onLoginRequested: performLogin,
                    onAppleLoginRequested: performAppleLogin
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
                    await syncReminders(force: true)
                    // 版本硬閘：自身 build 低於後端 minMacBuild → 蓋強制更新擋板。
                    await appUpdater.refreshForcedUpdate()
                }
                // 強制更新時直接把「app 內容」模糊掉（看得到、但是糊的），
                // 擋板 modal 再疊在上面（不被模糊）。
                .blur(radius: appUpdater.forcedUpdateRequired ? 8 : 0)
                // 強制更新擋板蓋在最上層（含登入畫面），更新前無法使用。
                .overlay {
                    if appUpdater.forcedUpdateRequired {
                        ForcedUpdateOverlay(onUpdate: { appUpdater.checkForUpdates() })
                    }
                }
                // 強制更新時把 app toolbar 整排藏起來（那排鈕不能再點），
                // overlay 延伸到頂全擋；交通燈保留讓使用者仍可關 app。
                .toolbar(appUpdater.forcedUpdateRequired ? .hidden : .automatic, for: .windowToolbar)
                // Re-sync when the Mac app returns to the foreground —
                // catches reminders set on another device while this app
                // was open (it doesn't get relaunched like a phone app).
                .onReceive(NotificationCenter.default.publisher(
                    for: NSApplication.didBecomeActiveNotification)
                ) { _ in
                    Task { await syncReminders(force: false) }
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
                .onReceive(NotificationCenter.default.publisher(for: NudgeCommands.checkForUpdatesNotification)) { _ in
                    appUpdater.checkForUpdates()
                }
            }
        }
        .modelContainer(container)
        // Window chrome — open at a comfortable default size. 1380×900
        // gives the three columns (sidebar / daily / cards) room to
        // breathe; still fits a 14"/16" comfortably and a 13" with the
        // window near-maximized. Constrained to the content's min size
        // so users can't resize below 900×600 and break the sidebar
        // layout. Unified title bar is the current macOS default look.
        .defaultSize(width: 1380, height: 900)
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

    /// Rebuilds per-task reminders from server state. Local notifications
    /// are per-device — without this sync a reminder set on the iPhone
    /// would never fire on this Mac (and vice versa). `requestAuthIfNeeded`
    /// runs inside `rescheduleAllTaskReminders`.
    ///
    /// `force` bypasses the throttle (used on launch); foreground re-syncs
    /// pass `false` so rapid ⌘-Tab doesn't hammer the API.
    @MainActor
    private func syncReminders(force: Bool) async {
        if !force, Date().timeIntervalSince(lastReminderSync) < 30 { return }
        lastReminderSync = Date()
        do {
            let reminders = try await reminderRepo.all()
            await NotificationScheduler.shared.rescheduleAllTaskReminders(reminders)
        } catch {
            print("[NudgeMacApp] reminder sync failed: \(error)")
        }
    }

    private func performLogin() async -> Result<Void, Error> {
        do {
            let idToken = try await googleSignIn.signIn()
            _ = try await auth.login(idToken: idToken, locale: NudgeLanguage.currentUITag())
            return .success(())
        } catch {
            return .failure(error)
        }
    }

    private func performAppleLogin(
        identityToken: String,
        fullName: String?,
        email: String?
    ) async -> Result<Void, Error> {
        do {
            _ = try await auth.loginWithApple(
                identityToken: identityToken,
                fullName: fullName,
                email: email,
                locale: NudgeLanguage.currentUITag()
            )
            return .success(())
        } catch {
            return .failure(error)
        }
    }
}

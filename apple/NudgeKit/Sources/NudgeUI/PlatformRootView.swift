import SwiftUI
import NudgeCore

/// 根 view：iOS 用 TabView + 5 個 tab；macOS 用 2 欄 NavigationSplitView
/// (sidebar | content)。Settings 在 macOS 改走 Settings { } scene
/// (⌘,)，不再佔 sidebar 一格；之前的 3 欄 detail 是空的「選擇項目」
/// placeholder，徒然佔螢幕——拿掉後 content 欄全寬呈現功能 view。
public struct PlatformRootView: View {
    @Bindable var auth: AuthRepository

    public init(auth: AuthRepository) {
        self.auth = auth
    }

    public var body: some View {
        #if os(iOS)
        IOSTabRoot(auth: auth)
            .tint(Color.nudgePrimary)
        #else
        MacSidebarRoot(auth: auth)
        #endif
    }
}

#if os(iOS)
/// Tab identity for the iOS tab bar. Used as `Tab(value:)` selection so
/// deep-link handlers (NotificationRouter) can switch tabs declaratively
/// instead of fighting `TabView` internal selection state.
public enum RootTab: Hashable {
    case tasks, calendar, cards, notes, search
}

struct IOSTabRoot: View {
    @Bindable var auth: AuthRepository
    @Environment(NotificationRouter.self) private var notificationRouter
    @State private var selectedTab: RootTab = .tasks

    // iOS 26 `Tab` API with a dedicated `.search` role — iOS renders
    // the search tab as the separated glass pill on the right of the
    // main tab bar (matches Apple Store / Photos / Reminders). The four
    // primary tabs keep their legacy order.
    var body: some View {
        TabView(selection: $selectedTab) {
            Tab(value: RootTab.tasks, role: nil) {
                DailyHostView(auth: auth)
            } label: {
                Label {
                    Text("nav.tasks", bundle: .module)
                } icon: {
                    Image(systemName: "checkmark.circle")
                }
            }

            Tab(value: RootTab.calendar, role: nil) {
                CalendarHostView()
            } label: {
                Label {
                    Text("nav.calendar", bundle: .module)
                } icon: {
                    Image(systemName: "calendar")
                }
            }

            Tab(value: RootTab.cards, role: nil) {
                CardsHostView()
            } label: {
                Label {
                    Text("nav.cards", bundle: .module)
                } icon: {
                    Image(systemName: "square.stack")
                }
            }

            Tab(value: RootTab.notes, role: nil) {
                NotesHostView()
            } label: {
                Label {
                    Text("nav.notes", bundle: .module)
                } icon: {
                    Image(systemName: "book")
                }
            }

            // Dedicated search tab — scope: cards-only for now (user
            // decision `A:(c)`). When widened to tasks/notes, the
            // search view routes internally over those repos.
            Tab(value: RootTab.search, role: .search) {
                CardSearchView()
            } label: {
                Label {
                    Text("common.search", bundle: .module)
                } icon: {
                    Image(systemName: "magnifyingglass")
                }
            }
        }
        .tint(Color.nudgePrimary)
        // Deep-link → tab switch only. The destination view (DailyHostView /
        // CardsHostView) keeps observing the same router flag and is the
        // one that calls `notificationRouter.clear()` after consuming the
        // intent — matches the existing `pendingNewTask` contract.
        .onChange(of: notificationRouter.pendingNewCard) { _, isPending in
            if isPending { selectedTab = .cards }
        }
        .onChange(of: notificationRouter.pendingNewTask) { _, isPending in
            if isPending { selectedTab = .tasks }
        }
        .onChange(of: notificationRouter.pendingTaskId) { _, taskId in
            if taskId != nil { selectedTab = .tasks }
        }
    }
}
#else
public enum SidebarItem: String, Hashable, CaseIterable {
    case today, calendar, cards, notes, settings
}

struct MacSidebarRoot: View {
    @Bindable var auth: AuthRepository
    // Ideally this lives in @SceneStorage so the sidebar selection
    // persists across window restores; @State is fine for now since
    // restoring to "Today" is a sensible default anyway.
    @State private var selection: SidebarItem = .today

    var body: some View {
        // 2 欄 NavigationSplitView。content view 自己負責 NavigationStack
        // 與 push detail (Cards/Daily 在 detail 內 push 卡片頁)。
        // 之前是 3 欄但 detail 永遠顯示「選擇項目」placeholder，被
        // 拿掉。
        NavigationSplitView {
            List(selection: $selection) {
                Section {
                    NavigationLink(value: SidebarItem.today) {
                        Label {
                            Text("nav.tasks", bundle: .module)
                        } icon: {
                            // 對齊 iOS Tab bar 的 checkmark.circle —
                            // sidebar / tab bar 同 icon 讓 user 在兩
                            // 平台間切換時 muscle memory 一致。
                            Image(systemName: "checkmark.circle")
                        }
                    }
                    NavigationLink(value: SidebarItem.calendar) {
                        Label {
                            Text("nav.calendar", bundle: .module)
                        } icon: {
                            Image(systemName: "calendar")
                        }
                    }
                    NavigationLink(value: SidebarItem.cards) {
                        Label {
                            Text("nav.cards", bundle: .module)
                        } icon: {
                            Image(systemName: "square.stack")
                        }
                    }
                    NavigationLink(value: SidebarItem.notes) {
                        Label {
                            Text("nav.notes", bundle: .module)
                        } icon: {
                            Image(systemName: "book")
                        }
                    }
                }
                // Settings 同時保留在 ⌘, Settings scene 與 sidebar — 使
                // 用者習慣 sidebar 的入口（而 ⌘, 是 mac 通用習慣，兩
                // 邊都 hit 同一個 SettingsView）。
                Section {
                    NavigationLink(value: SidebarItem.settings) {
                        Label {
                            Text("nav.settings", bundle: .module)
                        } icon: {
                            Image(systemName: "gearshape")
                        }
                    }
                }
            }
            .navigationTitle(Text(verbatim: "Nudge"))
            .navigationSplitViewColumnWidth(min: 180, ideal: 220, max: 280)
        } detail: {
            // ZStack + opacity 讓 5 個 detail view 永遠 mounted，
            // @State / HSplitView drag 位置 / NavigationStack path 等
            // 切換 sidebar 時不會被 destroy。代價：所有 view 在 app
            // 啟動時就 mount、各自 .task 各跑一次（fetch 五份資料）。
            // 對使用者而言，「切回行動頁版位還在」遠比啟動快幾百
            // 毫秒重要。
            // 參考：Apple Dev Forums "Preserving navigation state in
            // NavigationSplitView detail" + Hacking with Swift forums。
            // 每個 host 傳 embedded: !isActive — Mac sidebar ZStack 同時
            // mount 全部 5 個 host（保留 navigation state），但 inactive
            // host 的 .toolbar items 會 bubble 上來污染外層 NavigationSplitView
            // 共用 toolbar。embedded=true 讓 inactive host 跳過自己的
            // chrome (toolbar / navigationTitle)，只留 active 那個貢獻
            // toolbar items。SettingsView 沒 toolbar items 不需要這個。
            ZStack {
                detailHost(.today, isActive: selection == .today) {
                    DailyHostView(auth: auth, embedded: selection != .today)
                }
                detailHost(.calendar, isActive: selection == .calendar) {
                    CalendarHostView(embedded: selection != .calendar)
                }
                detailHost(.cards, isActive: selection == .cards) {
                    CardsHostView(embedded: selection != .cards)
                }
                detailHost(.notes, isActive: selection == .notes) {
                    NotesHostView(embedded: selection != .notes)
                }
                detailHost(.settings, isActive: selection == .settings) {
                    SettingsView(auth: auth)
                }
            }
        }
        // Mac sidebar selection should track the user's system accent
        // (Appearance preferences). The previous version forced
        // .nudgePrimary (orange), overriding the user's accent.
        .onReceive(NotificationCenter.default.publisher(for: NudgeCommands.switchTabNotification)) { note in
            if let raw = note.object as? String, let item = SidebarItem(rawValue: raw) {
                selection = item
            }
        }
    }

    /// 把 detail host 包成 opacity 切換 + 禁掉非 active view 的 hit test
    /// 與 voice over，避免使用者隔山打牛點到背後 view 或 a11y 讀到非
    /// 顯示內容。`zIndex(isActive ? 1 : 0)` 確保 active view 永遠在最
    /// 上、shadow / popover 不被遮。
    @ViewBuilder
    private func detailHost<Content: View>(
        _ item: SidebarItem,
        isActive: Bool,
        @ViewBuilder content: () -> Content
    ) -> some View {
        content()
            .opacity(isActive ? 1 : 0)
            .allowsHitTesting(isActive)
            .accessibilityHidden(!isActive)
            .zIndex(isActive ? 1 : 0)
    }
}
#endif

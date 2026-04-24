import SwiftUI
import NudgeCore

/// Phase 1 骨架：iOS 顯示 TabView + 4 個 placeholder、macOS 顯示 NavigationSplitView。
/// Phase 2+ 會把 placeholder 換成真正的 feature view。
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
            .tint(Color.nudgePrimary)
        #endif
    }
}

#if os(iOS)
struct IOSTabRoot: View {
    @Bindable var auth: AuthRepository

    // iOS 26 `Tab` API with a dedicated `.search` role — iOS renders
    // the search tab as the separated glass pill on the right of the
    // main tab bar (matches Apple Store / Photos / Reminders). The four
    // primary tabs keep their legacy order.
    var body: some View {
        TabView {
            Tab(role: nil) {
                DailyHostView(auth: auth)
            } label: {
                Label {
                    Text("nav.tasks", bundle: .module)
                } icon: {
                    Image(systemName: "checkmark.circle")
                }
            }

            Tab(role: nil) {
                CalendarHostView()
            } label: {
                Label {
                    Text("nav.calendar", bundle: .module)
                } icon: {
                    Image(systemName: "calendar")
                }
            }

            Tab(role: nil) {
                CardsHostView()
            } label: {
                Label {
                    Text("nav.cards", bundle: .module)
                } icon: {
                    Image(systemName: "square.stack")
                }
            }

            Tab(role: nil) {
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
            Tab(role: .search) {
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
    }
}
#else
struct MacSidebarRoot: View {
    @Bindable var auth: AuthRepository
    @State private var selection: SidebarItem? = .today

    var body: some View {
        NavigationSplitView {
            List(selection: $selection) {
                Section {
                    NavigationLink(value: SidebarItem.today) {
                        Label(title: { Text("nav.tasks", bundle: .module) }, icon: { Image(systemName: "sun.max") })
                    }
                    NavigationLink(value: SidebarItem.calendar) {
                        Label(title: { Text("nav.calendar", bundle: .module) }, icon: { Image(systemName: "calendar") })
                    }
                }
                Section {
                    NavigationLink(value: SidebarItem.cards) {
                        Label(title: { Text("nav.cards", bundle: .module) }, icon: { Image(systemName: "square.stack") })
                    }
                    NavigationLink(value: SidebarItem.notes) {
                        Label(title: { Text("nav.notes", bundle: .module) }, icon: { Image(systemName: "book") })
                    }
                }
                Section {
                    NavigationLink(value: SidebarItem.settings) {
                        Label(title: { Text("nav.settings", bundle: .module) }, icon: { Image(systemName: "gearshape") })
                    }
                }
            }
            .navigationTitle("Nudge")
        } content: {
            switch selection ?? .today {
            case .today: DailyHostView(auth: auth)
            case .calendar: CalendarHostView()
            case .notes: NotesHostView()
            case .cards: CardsHostView()
            case .settings: SettingsView(auth: auth)
            }
        } detail: {
            Text("選擇項目")
                .foregroundStyle(.secondary)
        }
    }
}

enum SidebarItem: Hashable {
    case today, calendar, notes, cards, settings
}
#endif

struct PlaceholderTab: View {
    let title: String
    let systemImage: String

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: systemImage)
                .font(.system(size: 48))
                .foregroundStyle(.tertiary)
            Text(title)
                .font(.title3)
                .foregroundStyle(.secondary)
            Text("Phase 2+ 實作")
                .font(.footnote)
                .foregroundStyle(.tertiary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

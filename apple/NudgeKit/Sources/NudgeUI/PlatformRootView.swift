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
        #else
        MacSidebarRoot(auth: auth)
        #endif
    }
}

#if os(iOS)
struct IOSTabRoot: View {
    @Bindable var auth: AuthRepository

    var body: some View {
        TabView {
            PlaceholderTab(title: "行動", systemImage: "checkmark.circle")
                .tabItem { Label("行動", systemImage: "checkmark.circle") }

            PlaceholderTab(title: "日誌", systemImage: "book")
                .tabItem { Label("日誌", systemImage: "book") }

            PlaceholderTab(title: "卡片", systemImage: "square.stack")
                .tabItem { Label("卡片", systemImage: "square.stack") }

            SettingsPlaceholder(auth: auth)
                .tabItem { Label("設定", systemImage: "gearshape") }
        }
    }
}
#else
struct MacSidebarRoot: View {
    @Bindable var auth: AuthRepository
    @State private var selection: SidebarItem? = .today

    var body: some View {
        NavigationSplitView {
            List(selection: $selection) {
                Section("今日") {
                    NavigationLink(value: SidebarItem.today) { Label("今天", systemImage: "sun.max") }
                }
                Section("內容") {
                    NavigationLink(value: SidebarItem.notes) { Label("日誌", systemImage: "book") }
                    NavigationLink(value: SidebarItem.cards) { Label("卡片", systemImage: "square.stack") }
                }
                Section {
                    NavigationLink(value: SidebarItem.settings) { Label("設定", systemImage: "gearshape") }
                }
            }
            .navigationTitle("Nudge")
        } content: {
            switch selection ?? .today {
            case .today: PlaceholderTab(title: "今天", systemImage: "sun.max")
            case .notes: PlaceholderTab(title: "日誌", systemImage: "book")
            case .cards: PlaceholderTab(title: "卡片", systemImage: "square.stack")
            case .settings: SettingsPlaceholder(auth: auth)
            }
        } detail: {
            Text("選擇項目")
                .foregroundStyle(.secondary)
        }
    }
}

enum SidebarItem: Hashable {
    case today, notes, cards, settings
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

struct SettingsPlaceholder: View {
    @Bindable var auth: AuthRepository

    var body: some View {
        List {
            Section("帳號") {
                if let user = auth.currentUser {
                    LabeledContent("Email", value: user.email)
                    LabeledContent("名稱", value: user.name ?? "—")
                }
                Button("登出", role: .destructive) {
                    Task { await auth.logout() }
                }
            }
        }
        #if os(macOS)
        .formStyle(.grouped)
        #endif
    }
}

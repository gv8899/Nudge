import SwiftUI
import NudgeCore

public struct SettingsView: View {
    @Bindable var auth: AuthRepository
    @Environment(CalendarRepository.self) private var calendarRepo
    @Environment(CardRepository.self) private var cardRepo
    @Environment(\.locale) private var locale
    @AppStorage(NudgePreferenceKey.theme) private var themeRaw: String = NudgeTheme.system.rawValue
    @AppStorage(NudgePreferenceKey.language) private var languageRaw: String = NudgeLanguage.auto.rawValue
    @State private var oauth = CalendarOAuthCoordinator()
    @State private var isConnecting = false
    @State private var connectError: String?
    @State private var showDisconnectConfirm = false
    @State private var showLogoutConfirm = false
    @State private var showCleanCardsConfirm = false
    @State private var isCleaning = false
    @State private var cleanResult: String?
    @State private var showDeleteAccountConfirm = false
    @State private var isDeletingAccount = false
    @State private var deleteAccountError: String?

    public init(auth: AuthRepository) {
        self.auth = auth
    }

    private var theme: Binding<NudgeTheme> {
        Binding(
            get: { NudgeTheme(rawValue: themeRaw) ?? .system },
            set: { themeRaw = $0.rawValue }
        )
    }

    private var language: Binding<NudgeLanguage> {
        Binding(
            get: { NudgeLanguage(rawValue: languageRaw) ?? .auto },
            set: { languageRaw = $0.rawValue }
        )
    }

    public var body: some View {
        #if os(iOS)
        contentScroll
            .navigationTitle(Text("settings.title", bundle: .module))
            .navigationBarTitleDisplayMode(.inline)
        #else
        contentScroll
        #endif
    }

    /// Settings groups — iOS / mac 共用內容；wrapper（padding / 置中）
    /// 由 contentScroll 平台分支處理。
    private var settingsGroups: some View {
        VStack(alignment: .leading, spacing: 24) {
            accountGroup
            subscriptionGroup
            calendarGroup
            appearanceGroup
            languageGroup
            tagsGroup
            dangerZoneGroup
            versionFooter
        }
    }

    private var contentScroll: some View {
        ScrollView {
            #if os(macOS)
            // Mac 不吃滿寬 — 跟 Daily 一樣兩邊留白置中（max-width 720pt）。
            // iOS 維持全寬（手機本來就窄、不需要置中）。Spacer minLength
            // 16 確保視窗極窄時 content 不貼邊。
            HStack(spacing: 0) {
                Spacer(minLength: 16)
                settingsGroups
                    .frame(maxWidth: 720)
                    .padding(16)
                Spacer(minLength: 16)
            }
            #else
            settingsGroups
                .padding(16)
            #endif
        }
        .background(Color.nudgeBackground)
        .task { await calendarRepo.refreshConnectionStatusIfNeeded() }
        .task { await auth.refreshEntitlement() }
        .alert(
            Text("settings.logout.confirmTitle", bundle: .module),
            isPresented: $showLogoutConfirm
        ) {
            Button(role: .cancel, action: {}) {
                Text("common.cancel", bundle: .module)
            }
            Button(role: .destructive) {
                Task { await auth.logout() }
            } label: {
                Text("settings.logout.button", bundle: .module)
            }
        } message: {
            Text("settings.logout.confirmBody", bundle: .module)
        }
        .alert(
            Text("calendar.disconnectConfirmTitle", bundle: .module),
            isPresented: $showDisconnectConfirm
        ) {
            Button(role: .cancel, action: {}) {
                Text("common.cancel", bundle: .module)
            }
            Button(role: .destructive) {
                Task { try? await calendarRepo.disconnect() }
            } label: {
                Text("calendar.disconnectButton", bundle: .module)
            }
        } message: {
            Text("calendar.disconnectConfirmBody", bundle: .module)
        }
        .alert(
            Text("settings.cleanUntitled.confirmTitle", bundle: .module),
            isPresented: $showCleanCardsConfirm
        ) {
            Button(role: .cancel, action: {}) {
                Text("common.cancel", bundle: .module)
            }
            Button(role: .destructive, action: cleanUntitledCards) {
                Text("settings.cleanUntitled.confirmOk", bundle: .module)
            }
        } message: {
            Text("settings.cleanUntitled.confirmBody", bundle: .module)
        }
        .alert(
            Text("settings.cleanUntitled.label", bundle: .module),
            isPresented: .init(
                get: { cleanResult != nil },
                set: { if !$0 { cleanResult = nil } }
            )
        ) {
            Button(role: .cancel, action: {}) {
                Text("common.confirm", bundle: .module)
            }
        } message: {
            if let cleanResult { Text(verbatim: cleanResult) }
        }
        .alert(
            Text("settings.deleteAccount.confirmTitle", bundle: .module),
            isPresented: $showDeleteAccountConfirm
        ) {
            Button(role: .cancel, action: {}) {
                Text("common.cancel", bundle: .module)
            }
            Button(role: .destructive, action: deleteAccount) {
                Text("settings.deleteAccount.confirmOk", bundle: .module)
            }
        } message: {
            Text("settings.deleteAccount.confirmBody", bundle: .module)
        }
        .alert(
            Text("settings.deleteAccount.label", bundle: .module),
            isPresented: .init(
                get: { deleteAccountError != nil },
                set: { if !$0 { deleteAccountError = nil } }
            )
        ) {
            Button(role: .cancel, action: {}) {
                Text("common.confirm", bundle: .module)
            }
        } message: {
            if let deleteAccountError { Text(verbatim: deleteAccountError) }
        }
    }

    // MARK: - Groups

    // 訂閱狀態 + 兌換碼（讀 /api/me 的 entitlement；soft 模式、不擋功能）。
    private var subscriptionGroup: some View {
        SettingsGroup(header: "billing.section", icon: "creditcard") {
            SettingsRow {
                Text(verbatim: subscriptionStatusText)
                    .foregroundStyle(subscriptionStatusColor)
            } trailing: {
                EmptyView()
            }
        }
    }

    // 曾付費過的來源（決定 expired 措辭：訂閱已結束 vs 試用已結束）。
    private static let paidSources = ["apple", "paddle", "newebpay"]
    // 仍有權但需提醒的狀態（付款失敗 / 已取消未到期）→ 警告色。
    private static let attentionStatuses = ["past_due", "canceled"]

    private var subscriptionStatusText: String {
        guard let e = auth.entitlement else { return "…" }
        let end = e.currentPeriodEnd ?? e.accessUntil
        switch e.status {
        case "trialing":
            return String(
                format: nudgeLocalized("billing.trialing", locale: locale),
                e.daysLeft ?? 0
            )
        case "active":
            if end == nil {
                return nudgeLocalized("billing.activeForever", locale: locale)
            }
            return String(
                format: nudgeLocalized("billing.activeUntil", locale: locale),
                formattedAccessDate(end ?? "")
            )
        case "canceled":
            return String(
                format: nudgeLocalized("billing.canceled", locale: locale),
                formattedAccessDate(end ?? "")
            )
        case "past_due":
            return nudgeLocalized("billing.pastDue", locale: locale)
        default:
            // expired：曾付費 → 訂閱已結束；否則 → 試用已結束。
            let key = Self.paidSources.contains(e.source ?? "")
                ? "billing.subscriptionEnded" : "billing.expired"
            return nudgeLocalized(key, locale: locale)
        }
    }

    private var subscriptionStatusColor: Color {
        guard let e = auth.entitlement, e.isActive else { return .nudgeTextDim }
        return Self.attentionStatuses.contains(e.status)
            ? .nudgeWarning : .nudgePrimary
    }

    private func formattedAccessDate(_ iso: String) -> String {
        guard let d = NudgeISO8601.date(from: iso) else { return iso }
        let f = DateFormatter()
        f.dateFormat = "yyyy/MM/dd"
        return f.string(from: d)
    }

    private var accountGroup: some View {
        SettingsGroup(header: "settings.account.section", icon: "person.crop.circle") {
            if let user = auth.currentUser {
                SettingsRow {
                    Text("settings.account.email", bundle: .module)
                } trailing: {
                    Text(verbatim: user.email)
                        .lineLimit(1)
                        .truncationMode(.middle)
                }
                SettingsDivider()
                SettingsRow {
                    Text("settings.account.name", bundle: .module)
                } trailing: {
                    if let name = user.name, !name.isEmpty {
                        Text(verbatim: name)
                            .lineLimit(1)
                            .truncationMode(.tail)
                    } else {
                        Text("settings.account.unnamed", bundle: .module)
                            .foregroundStyle(Color.nudgeTextDim)
                    }
                }
            }
        }
    }

    private var calendarGroup: some View {
        SettingsGroup(header: "calendar.section", icon: "calendar") {
            if !calendarRepo.hasInitialized {
                // Loading skeleton sized to the connected (label + value
                // + disconnect) layout so the section doesn't grow when
                // state arrives.
                SettingsRow {
                    HStack(spacing: 8) {
                        ProgressView().controlSize(.small)
                        Text("calendar.checkingStatus", bundle: .module)
                            .nudgeFont(.rowMeta)
                            .foregroundStyle(Color.nudgeTextDim)
                    }
                } trailing: {
                    EmptyView()
                }
                .frame(minHeight: 88)
            } else if calendarRepo.isConnected {
                if !calendarRepo.connectedEmail.isEmpty {
                    // Same [label][value] structure as Email/Name above
                    // — was a single "Connected as xxx" full-width row,
                    // which broke the column rhythm of the page.
                    SettingsRow {
                        Text("calendar.connectedEmailLabel", bundle: .module)
                    } trailing: {
                        Text(verbatim: calendarRepo.connectedEmail)
                            .lineLimit(1)
                            .truncationMode(.middle)
                    }
                }
                // 隱私提示 — 緊貼「已連結」之下、中間不加分隔線（user
                // 拍板）；跟下方中斷連結之間才有線。
                SettingsRow {
                    Text("calendar.syncPrivacyHint", bundle: .module)
                        .nudgeFont(.rowMeta)
                        .foregroundStyle(Color.nudgeTextDim)
                        .fixedSize(horizontal: false, vertical: true)
                } trailing: {
                    EmptyView()
                }
                SettingsDivider()
                SettingsActionRow(
                    labelKey: "calendar.disconnectButton",
                    role: .destructive
                ) {
                    showDisconnectConfirm = true
                }
            } else {
                SettingsActionRow(
                    labelKey: "calendar.connectTitle",
                    role: .primary,
                    isLoading: isConnecting,
                    action: connectCalendar
                )
                // 隱私提示（連結前版位）— 放在連結按鈕之下。
                SettingsDivider()
                SettingsRow {
                    Text("calendar.syncPrivacyHint", bundle: .module)
                        .nudgeFont(.rowMeta)
                        .foregroundStyle(Color.nudgeTextDim)
                        .fixedSize(horizontal: false, vertical: true)
                } trailing: {
                    EmptyView()
                }
                if let connectError {
                    SettingsDivider()
                    SettingsRow {
                        Text(verbatim: connectError)
                            .nudgeFont(.errorMeta)
                            .foregroundStyle(Color.nudgeDestructive)
                            .lineLimit(2)
                    } trailing: {
                        EmptyView()
                    }
                }
            }
        }
    }

    private var appearanceGroup: some View {
        SettingsGroup(header: "settings.appearance.section", icon: "paintpalette") {
            SettingsRow {
                Text("settings.theme.section", bundle: .module)
            } trailing: {
                settingsMenu(
                    selection: theme,
                    options: NudgeTheme.allCases,
                    label: themeLabel
                )
            }
        }
    }

    private var languageGroup: some View {
        SettingsGroup(header: "settings.language.section", icon: "globe") {
            SettingsRow {
                Text("settings.language.section", bundle: .module)
            } trailing: {
                settingsMenu(
                    selection: language,
                    options: NudgeLanguage.allCases,
                    label: languageLabel
                )
            }
        }
    }

    // MARK: - Settings menu（取代 .pickerStyle(.menu)）
    //
    // macOS 上 `.pickerStyle(.menu)` 的 selected-value 文字由 AppKit
    // (NSPopUpButton) 繪製，`.tint` 的 adaptive 色會對到 window 的
    // NSAppearance（跟 SwiftUI `.preferredColorScheme` 不同步）→ 切 theme
    // 後文字色反相、看不清。改用 SwiftUI `Menu` + 自繪 label：label 的
    // `.foregroundStyle` 走 SwiftUI `\.colorScheme`，跟著 theme 正確解析。
    // 與 CardDetailView.moreMenu 同 pattern。
    private func settingsMenu<Value: Hashable>(
        selection: Binding<Value>,
        options: [Value],
        label: @escaping (Value) -> Text
    ) -> some View {
        Menu {
            ForEach(options, id: \.self) { option in
                Button {
                    selection.wrappedValue = option
                } label: {
                    if option == selection.wrappedValue {
                        Label { label(option) } icon: { Image(systemName: "checkmark") }
                    } else {
                        label(option)
                    }
                }
            }
        } label: {
            HStack(spacing: 6) {
                label(selection.wrappedValue)
                    .foregroundStyle(Color.nudgeForeground)
                Image(systemName: "chevron.up.chevron.down")
                    .nudgeFont(.fieldIcon)
                    .foregroundStyle(Color.nudgeTextDim)
            }
            .contentShape(Rectangle())
        }
        .menuIndicator(.hidden)
        .fixedSize()
        #if os(macOS)
        .menuStyle(.borderlessButton)
        #endif
    }

    private func themeLabel(_ t: NudgeTheme) -> Text {
        switch t {
        case .system: Text("settings.theme.system", bundle: .module)
        case .light: Text("settings.theme.light", bundle: .module)
        case .dark: Text("settings.theme.dark", bundle: .module)
        }
    }

    private func languageLabel(_ l: NudgeLanguage) -> Text {
        switch l {
        case .auto: Text("settings.language.auto", bundle: .module)
        case .zhTW: Text("settings.language.zhTW", bundle: .module)
        case .en: Text("settings.language.en", bundle: .module)
        case .ja: Text("settings.language.ja", bundle: .module)
        }
    }

    private var tagsGroup: some View {
        SettingsGroup(header: "settings.tags.section", icon: "tag") {
            TagManagerView()
        }
    }

    /// Logout + Clean cards collected into one section so all
    /// destructive / unrecoverable actions live in one place — was
    /// scattered: logout in account, clean cards in an unlabelled
    /// orphan group at the bottom.
    private var dangerZoneGroup: some View {
        SettingsGroup(header: "settings.dangerZone.section", icon: "exclamationmark.triangle") {
            SettingsActionRow(
                labelKey: "settings.logout.button",
                role: .destructive
            ) {
                showLogoutConfirm = true
            }
            SettingsDivider()
            SettingsActionRow(
                labelKey: isCleaning ? "settings.cleanUntitled.labelLoading" : "settings.cleanUntitled.label",
                role: .destructive,
                isLoading: isCleaning
            ) {
                showCleanCardsConfirm = true
            }
            SettingsDivider()
            // 刪除帳號（App Store 5.1.1(v) 要求）。最不可逆 → 放最底。
            SettingsActionRow(
                labelKey: isDeletingAccount ? "settings.deleteAccount.labelLoading" : "settings.deleteAccount.label",
                role: .destructive,
                isLoading: isDeletingAccount
            ) {
                showDeleteAccountConfirm = true
            }
        }
    }

    /// Build version footer at the very bottom — TestFlight users
    /// reporting bugs need to know which build they're on without
    /// digging into the TestFlight app.
    private var versionFooter: some View {
        let info = Bundle.main.infoDictionary
        let short = (info?["CFBundleShortVersionString"] as? String) ?? "?"
        let build = (info?["CFBundleVersion"] as? String) ?? "?"
        return HStack {
            Spacer()
            Text(verbatim: "Nudge \(short) (\(build))")
                .nudgeFont(.rowMeta)
                .foregroundStyle(Color.nudgeTextDim)
            Spacer()
        }
        .padding(.top, 8)
    }

    private func deleteAccount() {
        isDeletingAccount = true
        deleteAccountError = nil
        Task {
            defer { isDeletingAccount = false }
            do {
                // 成功後 auth.status → .unauthenticated，AuthGateView 自動切回 LoginView。
                try await auth.deleteAccount()
            } catch {
                deleteAccountError = (error as? LocalizedError)?.errorDescription
                    ?? error.localizedDescription
            }
        }
    }

    private func connectCalendar() {
        connectError = nil
        isConnecting = true
        Task {
            defer { isConnecting = false }
            do {
                let url = try await calendarRepo.mobileStart()
                try await oauth.present(connectURL: url)
                await calendarRepo.refreshConnectionStatus()
            } catch CalendarOAuthCoordinator.ConnectError.userCancelled {
                // silent — user chose to back out
            } catch {
                connectError = friendlyError(error)
            }
        }
    }

    /// Translate raw exceptions into localized, user-readable copy.
    /// Was: `String(describing: error)` which dumped enum cases like
    /// "APIError.server(statusCode: 500, message: nil)" straight into
    /// the UI, leaking backend detail and confusing the user.
    private func friendlyError(_ error: Error) -> String {
        if let apiError = error as? APIError {
            switch apiError {
            case .network:
                return nudgeLocalized("error.network", locale: locale)
            case .unauthorized:
                return nudgeLocalized("error.unauthorized", locale: locale)
            default:
                return nudgeLocalized("error.unknown", locale: locale)
            }
        }
        return nudgeLocalized("error.unknown", locale: locale)
    }

    private func cleanUntitledCards() {
        isCleaning = true
        Task {
            defer { isCleaning = false }
            do {
                let count = try await cardRepo.deleteUntitled()
                if count == 0 {
                    cleanResult = nudgeLocalized("settings.cleanUntitled.successEmpty", locale: locale)
                } else {
                    cleanResult = String(
                        format: nudgeLocalized("settings.cleanUntitled.successWithCount", locale: locale),
                        count
                    )
                }
            } catch {
                cleanResult = nudgeLocalized("settings.cleanUntitled.failed", locale: locale)
            }
        }
    }
}

// MARK: - Bordered group primitives

private struct SettingsGroup<Content: View>: View {
    let header: LocalizedStringKey?
    let icon: String?
    @ViewBuilder let content: () -> Content

    init(
        header: LocalizedStringKey? = nil,
        icon: String? = nil,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.header = header
        self.icon = icon
        self.content = content
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let header {
                HStack(spacing: 6) {
                    if let icon {
                        Image(systemName: icon)
                            .nudgeFont(.rowMeta)
                    }
                    Text(header, bundle: .module)
                        .nudgeFont(.rowMeta)
                        .textCase(.uppercase)
                }
                .foregroundStyle(Color.nudgeTextDim)
                .padding(.horizontal, 4)
            }
            // Elevated surface — was 1pt borderLight outline which was
            // invisible on dark mode. Matches Cards/Notes elevated card
            // treatment so all grouped surfaces in the app share one
            // visual language.
            VStack(spacing: 0) {
                content()
            }
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.nudgeForeground.opacity(0.04))
            )
        }
    }
}

private struct SettingsRow<Leading: View, Trailing: View>: View {
    @ViewBuilder let leading: () -> Leading
    @ViewBuilder let trailing: () -> Trailing

    var body: some View {
        HStack {
            leading()
            Spacer(minLength: 12)
            trailing()
        }
        .frame(minHeight: 44)
        .padding(.horizontal, 16)
        // Vertical padding 6 → 10 so the row breathes when Dynamic Type
        // is large; the minHeight 44 still guarantees touch target.
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct SettingsDivider: View {
    var body: some View {
        Rectangle()
            // Slightly stronger than borderLight so it reads on the
            // elevated surface (which itself uses ~4% opacity bg).
            .fill(Color.nudgeForeground.opacity(0.08))
            .frame(height: 1)
    }
}

private struct SettingsActionRow: View {
    enum Role { case primary, destructive }
    let labelKey: LocalizedStringKey
    let role: Role
    var isLoading: Bool = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack {
                Text(labelKey, bundle: .module)
                    .foregroundStyle(role == .destructive ? Color.nudgeDestructive : Color.nudgeForeground)
                Spacer()
                if isLoading {
                    ProgressView().controlSize(.small)
                }
            }
            .frame(minHeight: 44)
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(isLoading)
    }
}

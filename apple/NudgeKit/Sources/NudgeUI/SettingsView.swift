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

    private var contentScroll: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                accountGroup
                calendarGroup
                appearanceGroup
                languageGroup
                tagsGroup
                maintenanceGroup
            }
            .padding(16)
        }
        .background(Color.nudgeBackground)
        .task { await calendarRepo.refreshConnectionStatusIfNeeded() }
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
    }

    // MARK: - Groups

    private var accountGroup: some View {
        SettingsGroup(header: "settings.account.section") {
            if let user = auth.currentUser {
                SettingsRow {
                    Text("settings.account.email", bundle: .module)
                } trailing: {
                    Text(verbatim: user.email)
                }
                SettingsDivider()
                SettingsRow {
                    Text("settings.account.name", bundle: .module)
                } trailing: {
                    if let name = user.name, !name.isEmpty {
                        Text(verbatim: name)
                    } else {
                        Text("settings.account.unnamed", bundle: .module)
                    }
                }
                SettingsDivider()
            }
            SettingsActionRow(
                labelKey: "settings.logout.button",
                role: .destructive
            ) {
                showLogoutConfirm = true
            }
        }
    }

    private var calendarGroup: some View {
        SettingsGroup(header: "calendar.section") {
            // While `hasInitialized` is false the connection state is
            // unknown — show a skeleton row sized to the connected
            // (email + disconnect) layout so the section doesn't grow
            // when state arrives. Skipping this caused the section to
            // pop up by ~44pt on first Settings open and shifted the
            // groups below it.
            if !calendarRepo.hasInitialized {
                SettingsRow {
                    HStack(spacing: 8) {
                        ProgressView().controlSize(.small)
                        Text("calendar.checkingStatus", bundle: .module)
                            .font(.footnote)
                            .foregroundStyle(Color.nudgeTextDim)
                    }
                } trailing: {
                    EmptyView()
                }
                .frame(minHeight: 88)
            } else if calendarRepo.isConnected {
                if !calendarRepo.connectedEmail.isEmpty {
                    SettingsRow {
                        Text("calendar.connectedAs \(calendarRepo.connectedEmail)", bundle: .module)
                    } trailing: {
                        EmptyView()
                    }
                    SettingsDivider()
                }
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
                if let connectError {
                    SettingsDivider()
                    SettingsRow {
                        Text(connectError)
                            .font(.footnote)
                            .foregroundStyle(Color.nudgeDestructive)
                    } trailing: {
                        EmptyView()
                    }
                }
            }
        }
    }

    private var appearanceGroup: some View {
        SettingsGroup(header: "settings.appearance.section") {
            SettingsRow {
                Text("settings.theme.section", bundle: .module)
            } trailing: {
                Picker(selection: theme) {
                    Text("settings.theme.system", bundle: .module).tag(NudgeTheme.system)
                    Text("settings.theme.light", bundle: .module).tag(NudgeTheme.light)
                    Text("settings.theme.dark", bundle: .module).tag(NudgeTheme.dark)
                } label: {
                    EmptyView()
                }
                .pickerStyle(.menu)
                .labelsHidden()
                // Match the row label colour so the value reads as
                // continuation of the same line, not a tinted action.
                .tint(Color.nudgeForeground)
            }
        }
    }

    private var languageGroup: some View {
        SettingsGroup(header: "settings.language.section") {
            SettingsRow {
                Text("settings.language.section", bundle: .module)
            } trailing: {
                Picker(selection: language) {
                    Text("settings.language.auto", bundle: .module).tag(NudgeLanguage.auto)
                    Text("settings.language.zhTW", bundle: .module).tag(NudgeLanguage.zhTW)
                    Text("settings.language.en", bundle: .module).tag(NudgeLanguage.en)
                    Text("settings.language.ja", bundle: .module).tag(NudgeLanguage.ja)
                } label: {
                    EmptyView()
                }
                .pickerStyle(.menu)
                .labelsHidden()
                // Match the row label colour so the value reads as
                // continuation of the same line, not a tinted action.
                .tint(Color.nudgeForeground)
            }
        }
    }

    private var tagsGroup: some View {
        SettingsGroup(header: "settings.tags.section") {
            TagManagerView()
        }
    }

    private var maintenanceGroup: some View {
        SettingsGroup(header: nil) {
            SettingsActionRow(
                labelKey: isCleaning ? "settings.cleanUntitled.labelLoading" : "settings.cleanUntitled.label",
                role: .destructive,
                isLoading: isCleaning
            ) {
                showCleanCardsConfirm = true
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
                connectError = String(describing: error)
            }
        }
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
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let header {
                Text(header, bundle: .module)
                    .font(.caption.weight(.medium))
                    .foregroundStyle(Color.nudgeTextDim)
                    .textCase(.uppercase)
                    .padding(.horizontal, 4)
            }
            VStack(spacing: 0) {
                content()
            }
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color.nudgeBorderLight, lineWidth: 1)
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
        .padding(.vertical, 6)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct SettingsDivider: View {
    var body: some View {
        Rectangle()
            .fill(Color.nudgeBorderLight)
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
            .padding(.vertical, 6)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(isLoading)
    }
}

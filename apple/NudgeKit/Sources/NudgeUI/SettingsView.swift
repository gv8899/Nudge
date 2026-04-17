import SwiftUI
import NudgeCore

public struct SettingsView: View {
    @Bindable var auth: AuthRepository
    @Environment(CalendarRepository.self) private var calendarRepo

    public init(auth: AuthRepository) {
        self.auth = auth
    }

    public var body: some View {
        List {
            Section {
                if let user = auth.currentUser {
                    LabeledContent("Email", value: user.email)
                    LabeledContent {
                        Text(user.name ?? "—")
                    } label: {
                        Text(verbatim: "Name")
                    }
                }
                Button(role: .destructive) {
                    Task { await auth.logout() }
                } label: {
                    Text(verbatim: "Sign out")
                }
            } header: {
                Text(verbatim: "Account")
            }

            Section {
                if calendarRepo.isConnected {
                    Text(verbatim: "Google Calendar connected")
                        .foregroundStyle(Color.nudgeTextDim)
                } else {
                    Button {
                        // Task follow-up: wire to ASWebAuthenticationSession OAuth flow.
                        // Phase 2 scope: show the CTA; actual OAuth handoff deferred.
                    } label: {
                        Text("calendar.connectTitle", bundle: .module)
                    }
                }
            } header: {
                Text(verbatim: "Calendar")
            }
        }
        #if os(macOS)
        .formStyle(.grouped)
        #endif
    }
}

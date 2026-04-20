import SwiftUI
import NudgeCore

public struct SettingsView: View {
    @Bindable var auth: AuthRepository
    @Environment(CalendarRepository.self) private var calendarRepo
    @State private var oauth = CalendarOAuthCoordinator()
    @State private var isConnecting = false
    @State private var connectError: String?

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
                    Button(action: connectCalendar) {
                        HStack {
                            Text("calendar.connectTitle", bundle: .module)
                            if isConnecting {
                                Spacer()
                                ProgressView().controlSize(.small)
                            }
                        }
                    }
                    .disabled(isConnecting)
                    if let connectError {
                        Text(connectError)
                            .font(.footnote)
                            .foregroundStyle(Color.nudgeDestructive)
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
}

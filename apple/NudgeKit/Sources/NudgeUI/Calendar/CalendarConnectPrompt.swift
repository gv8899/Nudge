import SwiftUI
import NudgeCore

/// Full-screen CTA shown in the Calendar tab when Google Calendar
/// isn't connected yet. Reuses the existing CalendarOAuthCoordinator.
public struct CalendarConnectPrompt: View {
    @Environment(CalendarRepository.self) private var calendarRepo
    @State private var oauth = CalendarOAuthCoordinator()
    @State private var isConnecting = false
    @State private var error: String?

    public init() {}

    public var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "calendar")
                .font(.system(size: 56, weight: .regular))
                .foregroundStyle(Color.nudgePrimary)

            Text("calendar.connectTitle", bundle: .module)
                .font(.title3.weight(.semibold))
                .foregroundStyle(Color.nudgeForeground)

            Text("calendar.connectDescription", bundle: .module)
                .font(.subheadline)
                .foregroundStyle(Color.nudgeTextDim)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 280)

            Button(action: connect) {
                HStack {
                    if isConnecting {
                        ProgressView().controlSize(.small)
                    }
                    Text("calendar.connectTitle", bundle: .module)
                        .foregroundStyle(Color.nudgePrimaryForeground)
                }
                .padding(.horizontal, 24)
                .padding(.vertical, 10)
                .background(Capsule().fill(Color.nudgePrimary))
            }
            .buttonStyle(.plain)
            .disabled(isConnecting)

            if let error {
                Text(error)
                    .font(.footnote)
                    .foregroundStyle(Color.nudgeDestructive)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.nudgeBackground)
    }

    private func connect() {
        error = nil
        isConnecting = true
        Task {
            defer { isConnecting = false }
            do {
                let url = try await calendarRepo.mobileStart()
                try await oauth.present(connectURL: url)
                await calendarRepo.refreshConnectionStatus()
            } catch CalendarOAuthCoordinator.ConnectError.userCancelled {
                // silent
            } catch let err {
                error = String(describing: err)
            }
        }
    }
}

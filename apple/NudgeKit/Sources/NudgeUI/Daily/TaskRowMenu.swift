import SwiftUI
import NudgeCore

/// Unified `…` menu shown at the trailing edge of every Daily task row
/// (today, overdue, recurring). Exposes a single set of actions so the
/// past/today/recurring rows look and behave the same way.
public struct TaskRowMenu: View {
    public let isToday: Bool
    public let isRecurring: Bool
    public let onMoveToToday: () -> Void
    public let onMoveToOtherDate: () -> Void
    public let onSkipThisOccurrence: () -> Void
    public let onSetRecurrence: () -> Void
    public let onSetReminder: () -> Void
    public let onArchive: () -> Void

    public init(
        isToday: Bool,
        isRecurring: Bool,
        onMoveToToday: @escaping () -> Void,
        onMoveToOtherDate: @escaping () -> Void,
        onSkipThisOccurrence: @escaping () -> Void,
        onSetRecurrence: @escaping () -> Void,
        onSetReminder: @escaping () -> Void,
        onArchive: @escaping () -> Void
    ) {
        self.isToday = isToday
        self.isRecurring = isRecurring
        self.onMoveToToday = onMoveToToday
        self.onMoveToOtherDate = onMoveToOtherDate
        self.onSkipThisOccurrence = onSkipThisOccurrence
        self.onSetRecurrence = onSetRecurrence
        self.onSetReminder = onSetReminder
        self.onArchive = onArchive
    }

    public var body: some View {
        Menu {
            if !isToday {
                Button(action: onMoveToToday) {
                    Label {
                        Text("daily.moveToToday", bundle: .module)
                    } icon: {
                        Image(systemName: "calendar.badge.checkmark")
                    }
                }
            }
            Button(action: onMoveToOtherDate) {
                Label {
                    Text("daily.moveToOtherDate", bundle: .module)
                } icon: {
                    Image(systemName: "calendar")
                }
            }

            if isRecurring {
                Button(action: onSkipThisOccurrence) {
                    Label {
                        Text("daily.skipThisOccurrence", bundle: .module)
                    } icon: {
                        Image(systemName: "forward")
                    }
                }
            } else {
                Button(action: onSetRecurrence) {
                    Label {
                        Text("daily.setRecurring", bundle: .module)
                    } icon: {
                        Image(systemName: "arrow.triangle.2.circlepath")
                    }
                }
            }

            Button(action: onSetReminder) {
                Label {
                    Text("daily.setReminder", bundle: .module)
                } icon: {
                    Image(systemName: "bell")
                }
            }

            Divider()

            Button(role: .destructive, action: onArchive) {
                Label {
                    Text("daily.archiveButton", bundle: .module)
                } icon: {
                    Image(systemName: "archivebox")
                }
            }
        } label: {
            Image(systemName: "ellipsis")
                .font(.body.weight(.medium))
                .foregroundStyle(Color.nudgeTextDim)
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
        }
        .accessibilityLabel(Text("daily.rowMenu", bundle: .module))
    }
}

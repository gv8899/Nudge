import SwiftUI
import NudgeCore

public struct TaskRowView: View {
    public let assignment: DailyAssignmentDTO
    public let isToday: Bool
    public let onToggleComplete: () -> Void
    public let onOpen: () -> Void
    public let onMoveToToday: () -> Void
    public let onMoveTo: () -> Void
    public let onSkipThisOccurrence: () -> Void
    public let onSetRecurrence: () -> Void
    public let onSetReminder: () -> Void
    public let onArchive: () -> Void

    public init(
        assignment: DailyAssignmentDTO,
        isToday: Bool,
        onToggleComplete: @escaping () -> Void,
        onOpen: @escaping () -> Void,
        onMoveToToday: @escaping () -> Void,
        onMoveTo: @escaping () -> Void,
        onSkipThisOccurrence: @escaping () -> Void,
        onSetRecurrence: @escaping () -> Void,
        onSetReminder: @escaping () -> Void,
        onArchive: @escaping () -> Void
    ) {
        self.assignment = assignment
        self.isToday = isToday
        self.onToggleComplete = onToggleComplete
        self.onOpen = onOpen
        self.onMoveToToday = onMoveToToday
        self.onMoveTo = onMoveTo
        self.onSkipThisOccurrence = onSkipThisOccurrence
        self.onSetRecurrence = onSetRecurrence
        self.onSetReminder = onSetReminder
        self.onArchive = onArchive
    }

    public var body: some View {
        HStack(spacing: 8) {
            NudgeCheckbox(
                isChecked: assignment.isCompleted,
                accessibilityLabel: assignment.isCompleted ? "task.uncomplete" : "task.complete",
                action: onToggleComplete
            )

            Text(assignment.task.title)
                .strikethrough(assignment.isCompleted)
                .foregroundStyle(assignment.isCompleted ? Color.nudgeTextDim : Color.nudgeForeground)
                .opacity(assignment.isCompleted ? 0.6 : 1.0)
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(Rectangle())
                .onTapGesture(perform: onOpen)

            // The unified `…` menu replaced the legacy single-purpose
            // calendar IconButton. All row actions (move, skip, set
            // recurrence, set reminder, archive) live in this one menu so
            // today / overdue / recurring rows look identical.
            TaskRowMenu(
                isToday: isToday,
                isRecurring: assignment.isRecurring,
                onMoveToToday: onMoveToToday,
                onMoveToOtherDate: onMoveTo,
                onSkipThisOccurrence: onSkipThisOccurrence,
                onSetRecurrence: onSetRecurrence,
                onSetReminder: onSetReminder,
                onArchive: onArchive
            )
        }
        .padding(.horizontal, 12)
        .background(Color.nudgeBackground)
        #if os(macOS)
        .draggable(assignment.id)
        #endif
        .contextMenu {
            Button(action: onToggleComplete) {
                Label {
                    Text(assignment.isCompleted ? "task.uncomplete" : "task.complete", bundle: .module)
                } icon: {
                    Image(systemName: assignment.isCompleted ? "circle" : "checkmark.circle")
                }
            }
            Button(action: onMoveTo) {
                Label {
                    Text("task.moveToOtherDate", bundle: .module)
                } icon: {
                    Image(systemName: "calendar")
                }
            }
            if assignment.isRecurring {
                Button(action: onSkipThisOccurrence) {
                    Label {
                        Text("daily.skipThisOccurrence", bundle: .module)
                    } icon: {
                        Image(systemName: "forward")
                    }
                }
            }
            Button(role: .destructive, action: onArchive) {
                Label {
                    Text("daily.archiveButton", bundle: .module)
                } icon: {
                    Image(systemName: "archivebox")
                }
            }
            Button(action: onOpen) {
                Label {
                    Text("common.edit", bundle: .module)
                } icon: {
                    Image(systemName: "pencil")
                }
            }
        }
    }
}

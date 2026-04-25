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
                // Single-stage dim — was nudgeTextDim + .opacity(0.6)
                // which drove luminance below WCAG AA. Foreground-style
                // alone gives the correct "completed but readable" look.
                .foregroundStyle(assignment.isCompleted ? Color.nudgeTextDim : Color.nudgeForeground)
                .frame(maxWidth: .infinity, alignment: .leading)

            // Unified `…` menu — TaskRowMenu's inner Menu/Button consumes
            // its own taps so the row-level onTapGesture (below) doesn't
            // fire when the user opens the menu.
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
        .frame(minHeight: 44)
        .background(Color.nudgeBackground)
        // Whole row is now the tap surface — was only the title text,
        // leaving fat-finger dead zones in the spacing column.
        // NudgeCheckbox / TaskRowMenu are Buttons that consume their
        // own taps before this gesture sees them.
        .contentShape(Rectangle())
        .onTapGesture(perform: onOpen)
        #if os(macOS)
        .draggable(assignment.id)
        #endif
        #if os(iOS)
        // Native iOS list swipe affordances — leading = mark
        // complete/uncomplete, trailing = archive (destructive).
        // Was: only contextMenu (long-press), which iOS users don't
        // always discover. Keeps the `…` menu as the explicit
        // affordance for everything else.
        .swipeActions(edge: .leading, allowsFullSwipe: true) {
            Button(action: onToggleComplete) {
                Label {
                    Text(assignment.isCompleted ? "task.uncomplete" : "task.complete", bundle: .module)
                } icon: {
                    Image(systemName: assignment.isCompleted ? "circle" : "checkmark.circle")
                }
            }
            .tint(.nudgePrimary)
        }
        .swipeActions(edge: .trailing) {
            Button(role: .destructive, action: onArchive) {
                Label {
                    Text("daily.archiveButton", bundle: .module)
                } icon: {
                    Image(systemName: "archivebox")
                }
            }
        }
        #endif
    }
}

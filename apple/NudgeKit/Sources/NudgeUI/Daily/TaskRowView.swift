import SwiftUI
import NudgeCore

public struct TaskRowView: View {
    public let assignment: DailyAssignmentDTO
    public let onToggleComplete: () -> Void
    public let onOpen: () -> Void
    public let onMoveTo: () -> Void
    public let onArchive: () -> Void

    public init(
        assignment: DailyAssignmentDTO,
        onToggleComplete: @escaping () -> Void,
        onOpen: @escaping () -> Void,
        onMoveTo: @escaping () -> Void,
        onArchive: @escaping () -> Void
    ) {
        self.assignment = assignment
        self.onToggleComplete = onToggleComplete
        self.onOpen = onOpen
        self.onMoveTo = onMoveTo
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

            IconButton(
                systemName: "calendar",
                accessibilityLabel: "task.moveToOtherDate",
                action: onMoveTo
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

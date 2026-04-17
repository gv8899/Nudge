import SwiftUI
import NudgeCore

public struct TaskRowView: View {
    public let assignment: DailyAssignmentDTO
    public let onToggleComplete: () -> Void
    public let onTap: () -> Void
    public let onDetailTap: () -> Void
    public let onMoveTo: () -> Void
    public let onArchive: () -> Void

    public init(
        assignment: DailyAssignmentDTO,
        onToggleComplete: @escaping () -> Void,
        onTap: @escaping () -> Void,
        onDetailTap: @escaping () -> Void,
        onMoveTo: @escaping () -> Void,
        onArchive: @escaping () -> Void
    ) {
        self.assignment = assignment
        self.onToggleComplete = onToggleComplete
        self.onTap = onTap
        self.onDetailTap = onDetailTap
        self.onMoveTo = onMoveTo
        self.onArchive = onArchive
    }

    public var body: some View {
        HStack(spacing: 12) {
            Button(action: onToggleComplete) {
                Image(systemName: assignment.isCompleted ? "checkmark.circle.fill" : "circle")
                    .font(.title3)
                    .foregroundStyle(assignment.isCompleted ? Color.nudgePrimary : Color.nudgeTextDim)
            }
            .buttonStyle(.plain)

            Text(assignment.task.title)
                .strikethrough(assignment.isCompleted)
                .foregroundStyle(assignment.isCompleted ? Color.nudgeTextDim : Color.nudgeForeground)
                .opacity(assignment.isCompleted ? 0.6 : 1.0)
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(Rectangle())
                .onTapGesture(perform: onTap)

            Button(action: onMoveTo) {
                Image(systemName: "calendar")
                    .foregroundStyle(Color.nudgeTextDim)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(Color.nudgeBackground)
        #if os(macOS)
        .draggable(assignment.id)
        #endif
        .contextMenu {
            Button(action: onToggleComplete) {
                Label {
                    Text(verbatim: assignment.isCompleted ? "Uncomplete" : "Complete")
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
            Button(action: onDetailTap) {
                Label {
                    Text(verbatim: "Edit")
                } icon: {
                    Image(systemName: "pencil")
                }
            }
        }
    }
}

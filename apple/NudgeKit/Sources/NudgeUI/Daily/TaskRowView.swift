import SwiftUI
import NudgeCore

public struct TaskRowView: View {
    public let assignment: DailyAssignmentDTO
    public let onToggleComplete: () -> Void
    public let onTap: () -> Void
    public let onDetailTap: () -> Void

    public init(
        assignment: DailyAssignmentDTO,
        onToggleComplete: @escaping () -> Void,
        onTap: @escaping () -> Void,
        onDetailTap: @escaping () -> Void
    ) {
        self.assignment = assignment
        self.onToggleComplete = onToggleComplete
        self.onTap = onTap
        self.onDetailTap = onDetailTap
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

            if !assignment.task.description.isEmpty {
                Button(action: onDetailTap) {
                    Image(systemName: "text.alignleft")
                        .foregroundStyle(Color.nudgePrimary)
                }
                .buttonStyle(.plain)
            } else {
                Button(action: onDetailTap) {
                    Image(systemName: "chevron.right")
                        .foregroundStyle(Color.nudgeTextDim)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(Color.nudgeBackground)
    }
}

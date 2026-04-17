import SwiftUI
import NudgeCore

public struct OverdueSectionView: View {
    public let overdueTasks: [DailyAssignmentDTO]
    public let currentDate: String
    public let onToggleComplete: (DailyAssignmentDTO) -> Void
    public let onReschedule: (DailyAssignmentDTO, String) -> Void
    public let onMoveTo: (DailyAssignmentDTO) -> Void
    public let onArchive: (DailyAssignmentDTO) -> Void

    @State private var isExpanded: Bool

    public init(
        overdueTasks: [DailyAssignmentDTO],
        currentDate: String,
        onToggleComplete: @escaping (DailyAssignmentDTO) -> Void,
        onReschedule: @escaping (DailyAssignmentDTO, String) -> Void,
        onMoveTo: @escaping (DailyAssignmentDTO) -> Void,
        onArchive: @escaping (DailyAssignmentDTO) -> Void
    ) {
        self.overdueTasks = overdueTasks
        self.currentDate = currentDate
        self.onToggleComplete = onToggleComplete
        self.onReschedule = onReschedule
        self.onMoveTo = onMoveTo
        self.onArchive = onArchive
        // 六日預設收合 — 用 currentDate（對照 Web）
        let parsed = DateFormatters.parseISODate(currentDate) ?? Date()
        _isExpanded = State(initialValue: !DateFormatters.isWeekend(parsed))
    }

    public var body: some View {
        if overdueTasks.isEmpty {
            EmptyView()
        } else {
            VStack(alignment: .leading, spacing: 8) {
                Button(action: { isExpanded.toggle() }) {
                    HStack {
                        Image(systemName: isExpanded ? "chevron.down" : "chevron.right")
                            .font(.caption)
                        Text(String(
                            format: NSLocalizedString("daily.overdueLabel", bundle: .module, comment: ""),
                            overdueTasks.count
                        ))
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Color.nudgePrimary)
                        Spacer()
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)

                if isExpanded {
                    ForEach(overdueTasks, id: \.id) { task in
                        overdueRow(task)
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
        }
    }

    @ViewBuilder
    private func overdueRow(_ task: DailyAssignmentDTO) -> some View {
        HStack(spacing: 12) {
            Button(action: { onToggleComplete(task) }) {
                Image(systemName: task.isCompleted ? "checkmark.circle.fill" : "circle")
                    .font(.title3)
                    .foregroundStyle(task.isCompleted ? Color.nudgePrimary : Color.nudgeTextDim)
            }
            .buttonStyle(.plain)

            Text(task.task.title)
                .foregroundStyle(task.isCompleted ? Color.nudgeTextDim : Color.nudgeForeground)
                .strikethrough(task.isCompleted)
                .lineLimit(1)

            Spacer()

            Menu {
                Button(action: { onReschedule(task, currentDate) }) {
                    Text("daily.overdueScheduleToday", bundle: .module)
                }
                Button(action: { onMoveTo(task) }) {
                    Text("task.moveToOtherDate", bundle: .module)
                }
                Button(role: .destructive, action: { onArchive(task) }) {
                    Text("daily.archiveButton", bundle: .module)
                }
            } label: {
                Image(systemName: "ellipsis")
                    .foregroundStyle(Color.nudgeTextDim)
            }
        }
        .padding(.vertical, 6)
    }
}

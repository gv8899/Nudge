import SwiftUI
import NudgeCore

public struct OverdueSectionView: View {
    public let overdueTasks: [DailyAssignmentDTO]
    public let onToggleComplete: (DailyAssignmentDTO) -> Void
    public let onScheduleToday: (DailyAssignmentDTO) -> Void
    public let onArchive: (DailyAssignmentDTO) -> Void

    @State private var isExpanded: Bool = true

    public init(
        overdueTasks: [DailyAssignmentDTO],
        onToggleComplete: @escaping (DailyAssignmentDTO) -> Void,
        onScheduleToday: @escaping (DailyAssignmentDTO) -> Void,
        onArchive: @escaping (DailyAssignmentDTO) -> Void
    ) {
        self.overdueTasks = overdueTasks
        self.onToggleComplete = onToggleComplete
        self.onScheduleToday = onScheduleToday
        self.onArchive = onArchive
    }

    public var body: some View {
        if overdueTasks.isEmpty {
            EmptyView()
        } else {
            VStack(alignment: .leading, spacing: 0) {
                header
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)

                if isExpanded {
                    ForEach(Array(overdueTasks.enumerated()), id: \.element.id) { index, task in
                        overdueRow(task)
                        if index < overdueTasks.count - 1 {
                            Divider()
                                .background(Color.nudgeBorderLight)
                                .padding(.leading, 56)
                        }
                    }
                }
            }
            .onAppear {
                let today = DateFormatters.isoDate(Date())
                if let date = DateFormatters.parseISODate(today),
                   DateFormatters.isWeekend(date) {
                    isExpanded = false
                }
            }
        }
    }

    private var header: some View {
        Button(action: { isExpanded.toggle() }) {
            HStack(spacing: 8) {
                Image(systemName: isExpanded ? "chevron.down" : "chevron.right")
                    .font(.caption)
                    .foregroundStyle(Color.nudgeTextDim)
                Image(systemName: "clock.badge.exclamationmark")
                    .foregroundStyle(Color.nudgePrimary)
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
    }

    @ViewBuilder
    private func overdueRow(_ task: DailyAssignmentDTO) -> some View {
        HStack(spacing: 16) {
            Button(action: { onToggleComplete(task) }) {
                Image(systemName: task.isCompleted ? "checkmark.square.fill" : "square")
                    .font(.title3)
                    .foregroundStyle(task.isCompleted ? Color.nudgePrimary : Color.nudgeTextDim)
            }
            .buttonStyle(.plain)

            Text(task.task.title)
                .foregroundStyle(task.isCompleted ? Color.nudgeTextDim : Color.nudgeForeground)
                .strikethrough(task.isCompleted)
                .lineLimit(1)
                .frame(maxWidth: .infinity, alignment: .leading)

            Button(action: { onScheduleToday(task) }) {
                Image(systemName: "calendar")
                    .foregroundStyle(Color.nudgeTextDim)
            }
            .buttonStyle(.plain)

            Button(action: { onArchive(task) }) {
                Image(systemName: "archivebox")
                    .foregroundStyle(Color.nudgeTextDim)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .contentShape(Rectangle())
    }
}

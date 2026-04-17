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
        // 六日預設收合（對照 Web: !isWeekend(parseISO(currentDate))）
        let parsed = DateFormatters.parseISODate(currentDate) ?? Date()
        _isExpanded = State(initialValue: !DateFormatters.isWeekend(parsed))
    }

    public var body: some View {
        if overdueTasks.isEmpty {
            EmptyView()
        } else {
            VStack(alignment: .leading, spacing: 0) {
                header
                if isExpanded {
                    ForEach(overdueTasks, id: \.id) { task in
                        overdueRow(task)
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 4)
        }
    }

    private var header: some View {
        Button(action: { isExpanded.toggle() }) {
            HStack(spacing: 8) {
                Image(systemName: isExpanded ? "chevron.down" : "chevron.right")
                    .font(.caption)
                    .foregroundStyle(Color.nudgePrimary)
                Image(systemName: "clock.badge.exclamationmark")
                    .font(.subheadline)
                    .foregroundStyle(Color.nudgePrimary)
                Text(String(
                    format: NSLocalizedString("daily.overdueLabel", bundle: .module, comment: ""),
                    overdueTasks.count
                ))
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Color.nudgePrimary)
                Spacer()
            }
            .contentShape(Rectangle())
            .padding(.vertical, 6)
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private func overdueRow(_ task: DailyAssignmentDTO) -> some View {
        HStack(spacing: 8) {
            Button(action: { onToggleComplete(task) }) {
                Image(systemName: "square")
                    .font(.body)
                    .foregroundStyle(Color.nudgeTextDim)
            }
            .buttonStyle(.plain)

            Text(task.task.title)
                .font(.subheadline)
                .foregroundStyle(Color.nudgeForeground)
                .lineLimit(1)

            Text(shortDate(task.date))
                .font(.caption)
                .foregroundStyle(Color.nudgeTextDim)

            Spacer()

            Button(action: { onReschedule(task, currentDate) }) {
                Text("daily.overdueScheduleToday", bundle: .module)
                    .font(.caption)
                    .foregroundStyle(Color.nudgePrimary)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
            }
            .buttonStyle(.plain)

            Button(action: { onMoveTo(task) }) {
                Image(systemName: "calendar")
                    .font(.subheadline)
                    .foregroundStyle(Color.nudgeTextDim)
            }
            .buttonStyle(.plain)

            Button(action: { onArchive(task) }) {
                Image(systemName: "archivebox")
                    .font(.subheadline)
                    .foregroundStyle(Color.nudgeTextDim)
            }
            .buttonStyle(.plain)
        }
        .padding(.vertical, 6)
    }

    private func shortDate(_ iso: String) -> String {
        guard let date = DateFormatters.parseISODate(iso) else { return iso }
        let cal = Calendar(identifier: .gregorian)
        return "\(cal.component(.month, from: date))/\(cal.component(.day, from: date))"
    }
}

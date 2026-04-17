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
        _isExpanded = State(initialValue: Self.defaultExpanded(for: currentDate))
    }

    private static func defaultExpanded(for dateString: String) -> Bool {
        let parsed = DateFormatters.parseISODate(dateString) ?? Date()
        return !DateFormatters.isWeekend(parsed)
    }

    public var body: some View {
        if overdueTasks.isEmpty {
            EmptyView()
        } else {
            VStack(alignment: .leading, spacing: 8) {
                header
                if isExpanded {
                    ForEach(overdueTasks, id: \.id) { task in
                        overdueRow(task)
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .animation(.easeOut(duration: 0.2), value: isExpanded)
            .onChange(of: currentDate) { _, newValue in
                isExpanded = Self.defaultExpanded(for: newValue)
            }
        }
    }

    private var header: some View {
        Button(action: { isExpanded.toggle() }) {
            HStack(spacing: 6) {
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
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(Text("daily.overdueSectionAria", bundle: .module))
        .accessibilityValue(Text(isExpanded ? "expanded" : "collapsed"))
        .accessibilityAddTraits(.isHeader)
    }

    @ViewBuilder
    private func overdueRow(_ task: DailyAssignmentDTO) -> some View {
        HStack(spacing: 8) {
            Button(action: { onToggleComplete(task) }) {
                Image(systemName: task.isCompleted ? "checkmark.square.fill" : "square")
                    .font(.title3)
                    .foregroundStyle(task.isCompleted ? Color.nudgePrimary : Color.nudgeTextDim)
                    .frame(minWidth: 44, minHeight: 44)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(Text(task.isCompleted ? "task.uncomplete" : "task.complete", bundle: .module))

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
                    .frame(minWidth: 44, minHeight: 44)
                    .contentShape(Rectangle())
            }
        }
    }
}

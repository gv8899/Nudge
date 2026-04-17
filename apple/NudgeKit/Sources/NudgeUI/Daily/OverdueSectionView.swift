import SwiftUI
import NudgeCore

public struct OverdueSectionView: View {
    public let overdueTasks: [DailyAssignmentDTO]
    public let onScheduleToday: (DailyAssignmentDTO) -> Void
    public let onMoveTo: (DailyAssignmentDTO) -> Void
    public let onArchive: (DailyAssignmentDTO) -> Void

    @State private var isExpanded: Bool = true

    public init(
        overdueTasks: [DailyAssignmentDTO],
        onScheduleToday: @escaping (DailyAssignmentDTO) -> Void,
        onMoveTo: @escaping (DailyAssignmentDTO) -> Void,
        onArchive: @escaping (DailyAssignmentDTO) -> Void
    ) {
        self.overdueTasks = overdueTasks
        self.onScheduleToday = onScheduleToday
        self.onMoveTo = onMoveTo
        self.onArchive = onArchive
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
                            .foregroundStyle(Color.nudgeChart5)
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
            .onAppear {
                // Default collapse on weekends
                let today = DateFormatters.isoDate(Date())
                if let date = DateFormatters.parseISODate(today),
                   DateFormatters.isWeekend(date) {
                    isExpanded = false
                }
            }
        }
    }

    @ViewBuilder
    private func overdueRow(_ task: DailyAssignmentDTO) -> some View {
        HStack {
            Circle()
                .fill(Color.nudgeChart5)
                .frame(width: 4, height: 4)
            Text(task.task.title)
                .foregroundStyle(Color.nudgeForeground)
            Spacer()
            Menu {
                Button(action: { onScheduleToday(task) }) {
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
        .padding(.vertical, 4)
    }
}

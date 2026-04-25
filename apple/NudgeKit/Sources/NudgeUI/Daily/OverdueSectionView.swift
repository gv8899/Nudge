import SwiftUI
import NudgeCore

public struct OverdueSectionView: View {
    public let overdueTasks: [DailyAssignmentDTO]
    public let currentDate: String
    public let onToggleComplete: (DailyAssignmentDTO) -> Void
    public let onReschedule: (DailyAssignmentDTO, String) -> Void
    public let onMoveTo: (DailyAssignmentDTO) -> Void
    public let onArchive: (DailyAssignmentDTO) -> Void
    public let onSkipThisOccurrence: (DailyAssignmentDTO) -> Void
    public let onSetRecurrence: (DailyAssignmentDTO) -> Void
    public let onSetReminder: (DailyAssignmentDTO) -> Void
    public let onOpen: (DailyAssignmentDTO) -> Void

    @Environment(\.locale) private var locale
    @State private var isExpanded: Bool

    public init(
        overdueTasks: [DailyAssignmentDTO],
        currentDate: String,
        onToggleComplete: @escaping (DailyAssignmentDTO) -> Void,
        onReschedule: @escaping (DailyAssignmentDTO, String) -> Void,
        onMoveTo: @escaping (DailyAssignmentDTO) -> Void,
        onArchive: @escaping (DailyAssignmentDTO) -> Void,
        onSkipThisOccurrence: @escaping (DailyAssignmentDTO) -> Void,
        onSetRecurrence: @escaping (DailyAssignmentDTO) -> Void,
        onSetReminder: @escaping (DailyAssignmentDTO) -> Void,
        onOpen: @escaping (DailyAssignmentDTO) -> Void
    ) {
        self.overdueTasks = overdueTasks
        self.currentDate = currentDate
        self.onToggleComplete = onToggleComplete
        self.onReschedule = onReschedule
        self.onMoveTo = onMoveTo
        self.onArchive = onArchive
        self.onSkipThisOccurrence = onSkipThisOccurrence
        self.onSetRecurrence = onSetRecurrence
        self.onSetReminder = onSetReminder
        self.onOpen = onOpen
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
            // Vertical-only padding on the outer; horizontal padding lives
            // inside header / row so they match TaskRowView's 12pt edge
            // (otherwise overdue checkboxes sit 4pt right of today's
            // checkboxes — visible misalignment).
            VStack(alignment: .leading, spacing: 8) {
                header
                if isExpanded {
                    ForEach(overdueTasks, id: \.id) { task in
                        overdueRow(task)
                    }
                }
            }
            .padding(.vertical, 12)
            .animation(.easeOut(duration: 0.2), value: isExpanded)
            .onChange(of: currentDate) { _, newValue in
                isExpanded = Self.defaultExpanded(for: newValue)
            }
        }
    }

    private var header: some View {
        // Outer padding is 12 (matches row edge); the additional 12 inside
        // brings the label / chevron in line with the visual centers of
        // the row's NudgeCheckbox (44pt frame, ~22pt glyph → 11pt inset)
        // and TaskRowMenu's `…` (also 44pt frame). Keeps the optical
        // column from "前幾天的" / chevron consistent with the rows.
        Button(action: {
            withAnimation(.easeOut(duration: 0.2)) { isExpanded.toggle() }
        }) {
            HStack(spacing: 6) {
                Text(String(
                    format: nudgeLocalized("daily.overdueLabel", locale: locale),
                    overdueTasks.count
                ))
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Color.nudgePrimary)
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .rotationEffect(.degrees(isExpanded ? 90 : 0))
                    .foregroundStyle(Color.nudgePrimary)
            }
            .padding(.horizontal, 24)
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(Text("daily.overdueSectionAria", bundle: .module))
        .accessibilityValue(Text(
            isExpanded ? "common.a11y.expanded" : "common.a11y.collapsed",
            bundle: .module
        ))
        .accessibilityAddTraits(.isHeader)
    }

    @ViewBuilder
    private func overdueRow(_ task: DailyAssignmentDTO) -> some View {
        HStack(spacing: 8) {
            NudgeCheckbox(
                isChecked: task.isCompleted,
                accessibilityLabel: task.isCompleted ? "task.uncomplete" : "task.complete",
                action: { onToggleComplete(task) }
            )

            Text(task.task.title)
                .foregroundStyle(task.isCompleted ? Color.nudgeTextDim : Color.nudgeForeground)
                .strikethrough(task.isCompleted)
                .lineLimit(1)
                .frame(maxWidth: .infinity, alignment: .leading)

            // Overdue rows are by definition not "today", so the menu's
            // "Move to today" entry is always shown via isToday: false.
            TaskRowMenu(
                isToday: false,
                isRecurring: task.isRecurring,
                onMoveToToday: { onReschedule(task, currentDate) },
                onMoveToOtherDate: { onMoveTo(task) },
                onSkipThisOccurrence: { onSkipThisOccurrence(task) },
                onSetRecurrence: { onSetRecurrence(task) },
                onSetReminder: { onSetReminder(task) },
                onArchive: { onArchive(task) }
            )
        }
        // Match TaskRowView's horizontal padding so the checkbox column
        // lines up across overdue and today sections.
        .padding(.horizontal, 12)
        .frame(minHeight: 44)
        // Whole-row tap to open detail — was: only the title text was
        // tappable (and even that wasn't wired in the overdue row),
        // so users couldn't open a card from the overdue list.
        // NudgeCheckbox / TaskRowMenu consume their own taps.
        .contentShape(Rectangle())
        .onTapGesture { onOpen(task) }
    }
}

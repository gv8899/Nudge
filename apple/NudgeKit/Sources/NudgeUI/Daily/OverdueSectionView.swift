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
    #if os(macOS)
    @State private var hoveredTaskId: String?
    @State private var popoverTaskId: String?
    #endif

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
                    // iOS：cards 縮 16pt 外邊距，視覺上跟 today task 區
                    // 對齊；header 維持原寬（label 跨整列較顯眼）。
                    // mac：維持原扁平 row，無額外 padding。
                    VStack(spacing: 8) {
                        ForEach(overdueTasks, id: \.id) { task in
                            overdueRow(task)
                        }
                    }
                    #if os(iOS)
                    .padding(.horizontal, 16)
                    #endif
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
                    .nudgeFont(.sectionHeader)
                    .foregroundStyle(Color.nudgeTextDim)
                Spacer()
                Image(systemName: "chevron.right")
                    .nudgeFont(.sectionChevron)
                    .rotationEffect(.degrees(isExpanded ? 90 : 0))
                    .foregroundStyle(Color.nudgeTextDim)
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
                .nudgeFont(.primaryRowTitle)
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
        // iOS card padding 14×14 / mac 維持 12×0 緊湊。
        .padding(.horizontal, rowPaddingH)
        .padding(.vertical, rowPaddingV)
        .frame(minHeight: rowMinHeight)
        .background(rowBackground(for: task.id))
        // Whole-row tap to open detail — was: only the title text was
        // tappable (and even that wasn't wired in the overdue row),
        // so users couldn't open a card from the overdue list.
        // NudgeCheckbox / TaskRowMenu consume their own taps.
        .contentShape(Rectangle())
        #if os(iOS)
        .onTapGesture { onOpen(task) }
        #endif
        #if os(macOS)
        // mac：tap → 視窗中央 sheet（quick-edit），sheet「展開」鍵才
        // 走 onOpen 推到右側 detail。跟 TaskRowView 同 UX。
        .onTapGesture { popoverTaskId = task.id }
        .sheet(
            isPresented: Binding(
                get: { popoverTaskId == task.id },
                set: { if !$0 && popoverTaskId == task.id { popoverTaskId = nil } }
            )
        ) {
            TaskPopoverView(
                assignment: task,
                onToggleComplete: {
                    onToggleComplete(task)
                    popoverTaskId = nil
                },
                onExpand: {
                    popoverTaskId = nil
                    onOpen(task)
                }
            )
        }
        .onHover { hovered in
            hoveredTaskId = hovered ? task.id : (hoveredTaskId == task.id ? nil : hoveredTaskId)
        }
        .contextMenu {
            Button { onToggleComplete(task) } label: {
                Label {
                    Text(task.isCompleted ? "task.uncomplete" : "task.complete", bundle: .module)
                } icon: {
                    Image(systemName: task.isCompleted ? "circle" : "checkmark.circle")
                }
            }
            Divider()
            Button { onReschedule(task, currentDate) } label: {
                Label {
                    Text("daily.moveToToday", bundle: .module)
                } icon: {
                    Image(systemName: "calendar.badge.checkmark")
                }
            }
            Button { onMoveTo(task) } label: {
                Label {
                    Text("daily.moveToOtherDate", bundle: .module)
                } icon: {
                    Image(systemName: "calendar")
                }
            }
            if task.isRecurring {
                Button { onSkipThisOccurrence(task) } label: {
                    Label {
                        Text("daily.skipThisOccurrence", bundle: .module)
                    } icon: {
                        Image(systemName: "forward")
                    }
                }
            }
            Button { onSetReminder(task) } label: {
                Label {
                    Text("daily.setReminder", bundle: .module)
                } icon: {
                    Image(systemName: "bell")
                }
            }
            Divider()
            Button(role: .destructive) { onArchive(task) } label: {
                Label {
                    Text("daily.archiveButton", bundle: .module)
                } icon: {
                    Image(systemName: "archivebox")
                }
            }
        }
        #endif
    }

    private var rowMinHeight: CGFloat {
        #if os(macOS)
        return 32
        #else
        return 56
        #endif
    }

    private var rowPaddingH: CGFloat {
        #if os(macOS)
        return 12
        #else
        return 14
        #endif
    }

    private var rowPaddingV: CGFloat {
        #if os(macOS)
        return 0
        #else
        return 14
        #endif
    }

    @ViewBuilder
    private func rowBackground(for id: String) -> some View {
        #if os(macOS)
        if hoveredTaskId == id {
            Color.nudgeHoverFill
        } else {
            Color.clear
        }
        #else
        // iOS overdue 卡片：warning tint 8% 表達「過期、需要關注」。
        // 比 task tab 一般 row (foreground 4%) 視覺上明顯區隔，但不會
        // 像紅 / orange 那樣搶眼。
        RoundedRectangle(cornerRadius: 12, style: .continuous)
            .fill(Color.nudgeWarning.opacity(0.08))
        #endif
    }
}

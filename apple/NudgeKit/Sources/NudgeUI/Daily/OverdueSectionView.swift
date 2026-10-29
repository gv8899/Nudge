import SwiftUI
import NudgeCore
#if os(macOS)
import AppKit
#endif

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
    public let onChecklistEdit: (DailyAssignmentDTO, ChecklistEdit) -> Void
    /// 行內改標題（mac：點標題文字觸發）。
    public let onUpdateTitle: (DailyAssignmentDTO, String) -> Void

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
        onOpen: @escaping (DailyAssignmentDTO) -> Void,
        onChecklistEdit: @escaping (DailyAssignmentDTO, ChecklistEdit) -> Void,
        onUpdateTitle: @escaping (DailyAssignmentDTO, String) -> Void
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
        self.onChecklistEdit = onChecklistEdit
        self.onUpdateTitle = onUpdateTitle
        _isExpanded = State(initialValue: Self.defaultExpanded(for: currentDate))
    }

    /// 一律預設展開 — user 要求「前幾天的」section 不論平日/週末都不要
    /// 預設收合。保留 function（onChange 仍呼叫）方便未來要改回條件式。
    private static func defaultExpanded(for dateString: String) -> Bool {
        return true
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
                            OverdueRowView(
                                task: task,
                                currentDate: currentDate,
                                onToggleComplete: { onToggleComplete(task) },
                                onReschedule: { onReschedule(task, currentDate) },
                                onMoveTo: { onMoveTo(task) },
                                onArchive: { onArchive(task) },
                                onSkipThisOccurrence: { onSkipThisOccurrence(task) },
                                onSetRecurrence: { onSetRecurrence(task) },
                                onSetReminder: { onSetReminder(task) },
                                onOpen: { onOpen(task) },
                                onChecklistEdit: { edit in onChecklistEdit(task, edit) },
                                onUpdateTitle: { newTitle in onUpdateTitle(task, newTitle) }
                            )
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

}

/// 單一「前幾天」任務列 —— 抽成獨立 View 以擁有自己的收合 @State（鏡像 TaskRowView
/// 的子項目接法）。結構與 TaskRowView 幾乎一致，但選單/背景是 overdue 專屬。
private struct OverdueRowView: View {
    let task: DailyAssignmentDTO
    let currentDate: String
    let onToggleComplete: () -> Void
    let onReschedule: () -> Void
    let onMoveTo: () -> Void
    let onArchive: () -> Void
    let onSkipThisOccurrence: () -> Void
    let onSetRecurrence: () -> Void
    let onSetReminder: () -> Void
    let onOpen: () -> Void
    let onChecklistEdit: (ChecklistEdit) -> Void
    let onUpdateTitle: (String) -> Void

    #if os(macOS)
    @State private var isHovered = false
    #endif
    @State private var collapsed: Bool
    @State private var editingTitle = false
    @State private var titleDraft = ""

    init(
        task: DailyAssignmentDTO,
        currentDate: String,
        onToggleComplete: @escaping () -> Void,
        onReschedule: @escaping () -> Void,
        onMoveTo: @escaping () -> Void,
        onArchive: @escaping () -> Void,
        onSkipThisOccurrence: @escaping () -> Void,
        onSetRecurrence: @escaping () -> Void,
        onSetReminder: @escaping () -> Void,
        onOpen: @escaping () -> Void,
        onChecklistEdit: @escaping (ChecklistEdit) -> Void,
        onUpdateTitle: @escaping (String) -> Void
    ) {
        self.task = task
        self.currentDate = currentDate
        self.onToggleComplete = onToggleComplete
        self.onReschedule = onReschedule
        self.onMoveTo = onMoveTo
        self.onArchive = onArchive
        self.onSkipThisOccurrence = onSkipThisOccurrence
        self.onSetRecurrence = onSetRecurrence
        self.onSetReminder = onSetReminder
        self.onOpen = onOpen
        self.onChecklistEdit = onChecklistEdit
        self.onUpdateTitle = onUpdateTitle
        _collapsed = State(
            initialValue: task.isCompleted
                ? true
                : ChecklistCollapseStore.isCollapsed(task.task.id)
        )
    }

    private var checklistItems: [ChecklistItem] {
        task.isRecurring ? [] : ChecklistHTML.parse(task.task.description)
    }
    private var checklistTotal: Int { checklistItems.count }
    private var checklistDone: Int { checklistItems.filter(\.checked).count }
    private var hasChecklist: Bool { checklistTotal > 0 }
    private var allDone: Bool { checklistTotal > 0 && checklistDone == checklistTotal }
    private var showChecklistBody: Bool { hasChecklist && !collapsed }

    private func toggleCollapsed() {
        collapsed.toggle()
        if !task.isCompleted {
            ChecklistCollapseStore.setCollapsed(task.task.id, collapsed)
        }
    }

    private func commitTitle() {
        guard editingTitle else { return }
        editingTitle = false
        let trimmed = titleDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.isEmpty, trimmed != task.task.title {
            onUpdateTitle(trimmed)
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            rowContent
            if showChecklistBody {
                TaskChecklistBody(
                    items: checklistItems,
                    onToggle: { index in
                        let item = checklistItems[index]
                        onChecklistEdit(.toggle(index: index, text: item.text, checked: !item.checked))
                    },
                    onRemove: { index in
                        let item = checklistItems[index]
                        onChecklistEdit(.remove(index: index, text: item.text))
                    },
                    onSetText: { index, newText in
                        let item = checklistItems[index]
                        onChecklistEdit(.setText(index: index, text: item.text, newText: newText))
                    }
                )
                .padding(.horizontal, rowPaddingH)
                .padding(.bottom, 12)
            }
        }
        // hover 底圖掛外層 → 整塊（標題列＋子項目）一起變底色。
        .background(rowBackground)
        #if os(macOS)
        .onHover { isHovered = $0 }
        #endif
        .onChange(of: task.isCompleted) { _, done in
            if done { collapsed = true }
        }
    }

    private var rowContent: some View {
        HStack(spacing: 8) {
            NudgeCheckbox(
                isChecked: task.isCompleted,
                accessibilityLabel: task.isCompleted ? "task.uncomplete" : "task.complete",
                action: onToggleComplete
            )

            if editingTitle {
                InlineRowTextField(text: $titleDraft, onCommit: commitTitle)
                    .frame(maxWidth: .infinity, alignment: .leading)
            } else {
                Text(task.task.title)
                    .nudgeFont(.primaryRowTitle)
                    .foregroundStyle(task.isCompleted ? Color.nudgeTextDim : Color.nudgeForeground)
                    .strikethrough(task.isCompleted)
                    .lineLimit(1)
                    .layoutPriority(1)
                    .contentShape(Rectangle())
                    #if os(macOS)
                    .onTapGesture {
                        titleDraft = task.task.title
                        editingTitle = true
                    }
                    .onHover { inside in
                        if inside { NSCursor.iBeam.push() } else { NSCursor.pop() }
                    }
                    #endif
                Spacer(minLength: 8)
            }

            if hasChecklist {
                TaskChecklistPill(collapsed: collapsed, allDone: allDone, onToggle: toggleCollapsed)
            }

            // Overdue rows are by definition not "today", so isToday: false.
            TaskRowMenu(
                isToday: false,
                isRecurring: task.isRecurring,
                onMoveToToday: onReschedule,
                onMoveToOtherDate: onMoveTo,
                onSkipThisOccurrence: onSkipThisOccurrence,
                onSetRecurrence: onSetRecurrence,
                onSetReminder: onSetReminder,
                onArchive: onArchive
            )
        }
        .padding(.horizontal, rowPaddingH)
        .padding(.vertical, rowPaddingV)
        .frame(minHeight: rowMinHeight)
        // 背景/hover 已移到外層 VStack（整塊含子項目一起亮）。
        .contentShape(Rectangle())
        #if os(iOS)
        .onTapGesture { onOpen() }
        #endif
        #if os(macOS)
        .onTapGesture {
            NotificationCenter.default.post(
                name: NudgeCommands.openTaskPopoverNotification,
                object: task
            )
        }
        .contextMenu {
            Button(action: onToggleComplete) {
                Label {
                    Text(task.isCompleted ? "task.uncomplete" : "task.complete", bundle: .module)
                } icon: {
                    Image(systemName: task.isCompleted ? "circle" : "checkmark.circle")
                }
            }
            Divider()
            Button(action: onReschedule) {
                Label {
                    Text("daily.moveToToday", bundle: .module)
                } icon: {
                    Image(systemName: "calendar.badge.checkmark")
                }
            }
            Button(action: onMoveTo) {
                Label {
                    Text("daily.moveToOtherDate", bundle: .module)
                } icon: {
                    Image(systemName: "calendar")
                }
            }
            if task.isRecurring {
                Button(action: onSkipThisOccurrence) {
                    Label {
                        Text("daily.skipThisOccurrence", bundle: .module)
                    } icon: {
                        Image(systemName: "forward")
                    }
                }
            }
            Button(action: onSetReminder) {
                Label {
                    Text("daily.setReminder", bundle: .module)
                } icon: {
                    Image(systemName: "bell")
                }
            }
            Divider()
            Button(role: .destructive, action: onArchive) {
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
    private var rowBackground: some View {
        #if os(macOS)
        RoundedRectangle(cornerRadius: 8, style: .continuous)
            .fill(isHovered ? Color.nudgeHoverFill : Color.clear)
            .padding(.horizontal, 8)
        #else
        // iOS overdue 卡片：warning tint 8%（過期、需要關注）。
        RoundedRectangle(cornerRadius: 12, style: .continuous)
            .fill(Color.nudgeWarning.opacity(0.08))
        #endif
    }
}

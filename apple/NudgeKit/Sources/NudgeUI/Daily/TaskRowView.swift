import SwiftUI
import NudgeCore
#if os(macOS)
import AppKit
#endif

public struct TaskRowView: View {
    public let assignment: DailyAssignmentDTO
    public let isToday: Bool
    public let onToggleComplete: () -> Void
    public let onOpen: () -> Void
    public let onMoveToToday: () -> Void
    public let onMoveTo: () -> Void
    public let onSkipThisOccurrence: () -> Void
    public let onSetRecurrence: () -> Void
    public let onSetReminder: () -> Void
    public let onArchive: () -> Void
    public let onChecklistEdit: (ChecklistEdit) -> Void
    /// 行內改標題（mac：點標題文字觸發）。送出 trim 後的新標題。
    public let onUpdateTitle: (String) -> Void

    #if os(macOS)
    @State private var isHovered = false
    #endif
    @State private var collapsed: Bool
    // 標題行內編輯狀態（mac：點標題文字進入）。
    @State private var editingTitle = false
    @State private var titleDraft = ""

    public init(
        assignment: DailyAssignmentDTO,
        isToday: Bool,
        onToggleComplete: @escaping () -> Void,
        onOpen: @escaping () -> Void,
        onMoveToToday: @escaping () -> Void,
        onMoveTo: @escaping () -> Void,
        onSkipThisOccurrence: @escaping () -> Void,
        onSetRecurrence: @escaping () -> Void,
        onSetReminder: @escaping () -> Void,
        onArchive: @escaping () -> Void,
        onChecklistEdit: @escaping (ChecklistEdit) -> Void,
        onUpdateTitle: @escaping (String) -> Void
    ) {
        self.assignment = assignment
        self.isToday = isToday
        self.onToggleComplete = onToggleComplete
        self.onOpen = onOpen
        self.onMoveToToday = onMoveToToday
        self.onMoveTo = onMoveTo
        self.onSkipThisOccurrence = onSkipThisOccurrence
        self.onSetRecurrence = onSetRecurrence
        self.onSetReminder = onSetReminder
        self.onArchive = onArchive
        self.onChecklistEdit = onChecklistEdit
        self.onUpdateTitle = onUpdateTitle
        // 收合狀態：已完成任務一律從收合開始，其餘讀本機記憶（預設展開）。
        _collapsed = State(
            initialValue: assignment.isCompleted
                ? true
                : ChecklistCollapseStore.isCollapsed(assignment.task.id)
        )
    }

    // MARK: Checklist 衍生資料（子項目由 task.description 推導；重複任務不顯示）

    private var checklistItems: [ChecklistItem] {
        assignment.isRecurring ? [] : ChecklistHTML.parse(assignment.task.description)
    }
    private var checklistTotal: Int { checklistItems.count }
    private var checklistDone: Int { checklistItems.filter(\.checked).count }
    private var hasChecklist: Bool { checklistTotal > 0 }
    private var allDone: Bool { checklistTotal > 0 && checklistDone == checklistTotal }
    private var showChecklistBody: Bool { hasChecklist && !collapsed }

    private func toggleCollapsed() {
        collapsed.toggle()
        // 已完成任務點膠囊只改本地 state，不寫入記憶（對齊 Web）。
        if !assignment.isCompleted {
            ChecklistCollapseStore.setCollapsed(assignment.task.id, collapsed)
        }
    }

    // 送出一次（Enter 與失焦都會呼叫，用 editing guard 擋掉第二次）。
    private func commitTitle() {
        guard editingTitle else { return }
        editingTitle = false
        let trimmed = titleDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.isEmpty, trimmed != assignment.task.title {
            onUpdateTitle(trimmed)
        }
    }

    public var body: some View {
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
                // 底部留白對齊上方標題到底圖上緣的間距（避免最後一項貼住底圖下緣）。
                .padding(.bottom, 12)
            }
        }
        // hover 底圖掛外層 → 有子項目時整塊（標題列＋子項目）一起變底色。
        .background(rowBackground)
        #if os(macOS)
        .onHover { isHovered = $0 }
        #endif
        // 母任務一旦完成就收合子項目（不寫入記憶）。
        .onChange(of: assignment.isCompleted) { _, done in
            if done { collapsed = true }
        }
    }

    private var rowContent: some View {
        HStack(spacing: 8) {
            NudgeCheckbox(
                isChecked: assignment.isCompleted,
                accessibilityLabel: assignment.isCompleted ? "task.uncomplete" : "task.complete",
                action: onToggleComplete
            )

            if editingTitle {
                // 行內改標題 — 撐滿可用寬度，字級同顯示（吃 ⌘+/− 倍率）。
                InlineRowTextField(text: $titleDraft, onCommit: commitTitle)
                    .frame(maxWidth: .infinity, alignment: .leading)
            } else {
                Text(assignment.task.title)
                    .nudgeFont(.primaryRowTitle)
                    .strikethrough(assignment.isCompleted)
                    // Single-stage dim — was nudgeTextDim + .opacity(0.6)
                    // which drove luminance below WCAG AA. Foreground-style
                    // alone gives the correct "completed but readable" look.
                    .foregroundStyle(assignment.isCompleted ? Color.nudgeTextDim : Color.nudgeForeground)
                    .lineLimit(1)
                    // 標題只占文字寬（layoutPriority 讓它先要空間、過長才截斷），
                    // 右側交給 Spacer —— 點標題＝改字、點 Spacer（列身）＝popover。
                    .layoutPriority(1)
                    .contentShape(Rectangle())
                    #if os(macOS)
                    .onTapGesture {
                        titleDraft = assignment.task.title
                        editingTitle = true
                    }
                    // 滑過標題 → 文字編輯游標，提示可點進去改字（對齊子項目）。
                    .onHover { inside in
                        if inside { NSCursor.iBeam.push() } else { NSCursor.pop() }
                    }
                    #endif
                Spacer(minLength: 8)
            }

            // 子項目進度膠囊（只有展開/收合箭頭）— 在標題後、選單前。
            if hasChecklist {
                TaskChecklistPill(collapsed: collapsed, allDone: allDone, onToggle: toggleCollapsed)
            }

            // 重複 / 提醒狀態標示已移到點任務彈出的 popover 內，row 上
            // 不再顯示 — 保持列表乾淨。

            // Unified `…` menu — TaskRowMenu's inner Menu/Button consumes
            // its own taps so the row-level onTapGesture (below) doesn't
            // fire when the user opens the menu.
            TaskRowMenu(
                isToday: isToday,
                isRecurring: assignment.isRecurring,
                onMoveToToday: onMoveToToday,
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
        // Whole row is the tap surface. NudgeCheckbox / TaskRowMenu are
        // Buttons that consume their own taps before this gesture sees them.
        // 背景/hover 已移到外層 VStack（整塊含子項目一起亮）。
        .contentShape(Rectangle())
        #if os(iOS)
        .onTapGesture(perform: onOpen)
        #endif
        #if os(macOS)
        // mac：tap → post notification，MacSidebarRoot 用 window-level
        // overlay 彈 quick-edit popover（支援點外取消）。popover 內按 ↗
        // 才走 onOpen 推到右側 detail。iOS 維持直接 push。
        .onTapGesture {
            NotificationCenter.default.post(
                name: NudgeCommands.openTaskPopoverNotification,
                object: assignment
            )
        }
        .draggable(assignment.id)
        // Right-click 是 mac 第一直覺。內容對齊 TaskRowMenu (...)，但少
        // 包一層 Menu，所以 native context menu 會直接展開。
        .contextMenu {
            Button(action: onToggleComplete) {
                Label {
                    Text(assignment.isCompleted ? "task.uncomplete" : "task.complete", bundle: .module)
                } icon: {
                    Image(systemName: assignment.isCompleted ? "circle" : "checkmark.circle")
                }
            }
            Divider()
            if !isToday {
                Button(action: onMoveToToday) {
                    Label {
                        Text("daily.moveToToday", bundle: .module)
                    } icon: {
                        Image(systemName: "calendar.badge.checkmark")
                    }
                }
            }
            Button(action: onMoveTo) {
                Label {
                    Text("daily.moveToOtherDate", bundle: .module)
                } icon: {
                    Image(systemName: "calendar")
                }
            }
            if assignment.isRecurring {
                Button(action: onSkipThisOccurrence) {
                    Label {
                        Text("daily.skipThisOccurrence", bundle: .module)
                    } icon: {
                        Image(systemName: "forward")
                    }
                }
            } else {
                Button(action: onSetRecurrence) {
                    Label {
                        Text("daily.setRecurring", bundle: .module)
                    } icon: {
                        Image(systemName: "arrow.triangle.2.circlepath")
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
        #if os(iOS)
        // Native iOS list swipe affordances — leading = mark
        // complete/uncomplete, trailing = archive (destructive).
        // Was: only contextMenu (long-press), which iOS users don't
        // always discover. Keeps the `…` menu as the explicit
        // affordance for everything else.
        .swipeActions(edge: .leading, allowsFullSwipe: true) {
            Button(action: onToggleComplete) {
                Label {
                    Text(assignment.isCompleted ? "task.uncomplete" : "task.complete", bundle: .module)
                } icon: {
                    Image(systemName: assignment.isCompleted ? "circle" : "checkmark.circle")
                }
            }
            .tint(.nudgePrimary)
        }
        .swipeActions(edge: .trailing) {
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

    /// mac 32pt 密度 / iOS 56pt 卡片高度（block 樣式留呼吸）
    private var rowMinHeight: CGFloat {
        #if os(macOS)
        return 32
        #else
        return 56
        #endif
    }

    /// mac 12h × 0v（緊湊）/ iOS 14h × 14v（卡片 padding）
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
        // hover fill 用 8pt 圓角 RoundedRectangle（之前是直角 Color 填滿、
        // 邊到邊）。8pt 橫向 inset 讓圓角 highlight 像「浮起來的選取塊」、
        // 不貼齊容器邊。
        RoundedRectangle(cornerRadius: 8, style: .continuous)
            .fill(isHovered ? Color.nudgeHoverFill : Color.clear)
            .padding(.horizontal, 8)
        #else
        // iOS block 卡片：完成 2% / 一般 4% (foreground @ opacity)
        // RoundedRect 12pt corner — 對齊 Cards tab CardListItemView 結構
        RoundedRectangle(cornerRadius: 12, style: .continuous)
            .fill(Color.nudgeForeground.opacity(assignment.isCompleted ? 0.02 : 0.04))
        #endif
    }
}

import SwiftUI
import NudgeCore

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

    #if os(macOS)
    @State private var isHovered = false
    #endif

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
        onArchive: @escaping () -> Void
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
    }

    public var body: some View {
        HStack(spacing: 8) {
            NudgeCheckbox(
                isChecked: assignment.isCompleted,
                accessibilityLabel: assignment.isCompleted ? "task.uncomplete" : "task.complete",
                action: onToggleComplete
            )

            Text(assignment.task.title)
                .nudgeFont(.primaryRowTitle)
                .strikethrough(assignment.isCompleted)
                // Single-stage dim — was nudgeTextDim + .opacity(0.6)
                // which drove luminance below WCAG AA. Foreground-style
                // alone gives the correct "completed but readable" look.
                .foregroundStyle(assignment.isCompleted ? Color.nudgeTextDim : Color.nudgeForeground)
                .frame(maxWidth: .infinity, alignment: .leading)

            // Status 標示（重複 / 提醒）— placement B：靠右、動作 icon 左邊。
            TaskStatusIndicators(
                isRecurring: assignment.isRecurring,
                hasReminder: assignment.hasReminder
            )

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
        // Hover background only renders on macOS (isHovered is iOS = no-op).
        // iOS: RoundedRectangle bg makes each task feel like a paper card,
        // 對齊 Cards / Notes tab 的 block 視覺。
        .background(rowBackground)
        // Whole row is now the tap surface — was only the title text,
        // leaving fat-finger dead zones in the spacing column.
        // NudgeCheckbox / TaskRowMenu are Buttons that consume their
        // own taps before this gesture sees them.
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
        .onHover { isHovered = $0 }
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

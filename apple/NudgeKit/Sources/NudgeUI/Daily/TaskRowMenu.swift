import SwiftUI
import NudgeCore

/// Trailing edge of every Daily task row 的動作群組。
///
/// **平台分流**（刻意不共用 body）：
/// - **iOS**：原生 SwiftUI `Menu` —— 系統原生 context menu，「移到其他
///   日期」收在 menu 內。
/// - **macOS**：自訂路線 —— 高頻動作「移到其他日期」抽成 row 上獨立的
///   `calendar` icon，其餘動作走 `…` 自訂 popover。macOS 原生 `Menu`
///   底層是 NSMenu / NSPopUpButton，會吃掉 `.whenHovered` 棲身的
///   `.background`、hover 上色永遠不 fire，所以 macOS 走 Image + popover。
public struct TaskRowMenu: View {
    public let isToday: Bool
    public let isRecurring: Bool
    public let onMoveToToday: () -> Void
    public let onMoveToOtherDate: () -> Void
    public let onSkipThisOccurrence: () -> Void
    public let onSetRecurrence: () -> Void
    public let onSetReminder: () -> Void
    public let onArchive: () -> Void

    #if os(macOS)
    @State private var moveHovered = false
    @State private var menuHovered = false
    @State private var menuShown = false
    #endif

    public init(
        isToday: Bool,
        isRecurring: Bool,
        onMoveToToday: @escaping () -> Void,
        onMoveToOtherDate: @escaping () -> Void,
        onSkipThisOccurrence: @escaping () -> Void,
        onSetRecurrence: @escaping () -> Void,
        onSetReminder: @escaping () -> Void,
        onArchive: @escaping () -> Void
    ) {
        self.isToday = isToday
        self.isRecurring = isRecurring
        self.onMoveToToday = onMoveToToday
        self.onMoveToOtherDate = onMoveToOtherDate
        self.onSkipThisOccurrence = onSkipThisOccurrence
        self.onSetRecurrence = onSetRecurrence
        self.onSetReminder = onSetReminder
        self.onArchive = onArchive
    }

    public var body: some View {
        #if os(macOS)
        macBody
        #else
        iosBody
        #endif
    }

    // MARK: - iOS：原生 Menu

    #if os(iOS)
    private var iosBody: some View {
        Menu {
            if !isToday {
                Button(action: onMoveToToday) {
                    Label {
                        Text("daily.moveToToday", bundle: .module)
                    } icon: {
                        Image(systemName: "calendar.badge.checkmark")
                    }
                }
            }
            Button(action: onMoveToOtherDate) {
                Label {
                    Text("daily.moveToOtherDate", bundle: .module)
                } icon: {
                    Image(systemName: "calendar")
                }
            }

            if isRecurring {
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
        } label: {
            Image(systemName: "ellipsis")
                .font(.body.weight(.medium))
                .foregroundStyle(Color.nudgeTextDim)
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
        }
        .accessibilityLabel(Text("daily.rowMenu", bundle: .module))
        .help(Text("daily.rowMenu", bundle: .module))
    }
    #endif

    // MARK: - macOS：calendar icon + … popover

    #if os(macOS)
    private var macBody: some View {
        // 12pt spacing — 兩顆 icon 在 36pt 大小下需要明確視覺呼吸。
        HStack(spacing: 12) {
            // 高頻動作「移到其他日期」獨立 icon — 裸 Image + tap gesture
            // (不包 Button，否則 Button 在 macOS 吃掉 hover 事件)。
            Image(systemName: "calendar")
                .font(iconFont)
                .foregroundStyle(moveHovered ? Color.nudgePrimary : Color.nudgeTextDim)
                .frame(width: rowMenuSize, height: rowMenuSize)
                .contentShape(Rectangle())
                .onTapGesture(perform: onMoveToOtherDate)
                .whenHovered { moveHovered = $0 }
                .accessibilityAddTraits(.isButton)
                .accessibilityLabel(Text("daily.moveToOtherDate", bundle: .module))
                .help(Text("daily.moveToOtherDate", bundle: .module))

            // … menu — 裸 Image + .popover 自己畫 dropdown，不用原生 Menu
            // （NSMenu 渲染會吃掉 whenHovered 的 .background）。
            Image(systemName: "ellipsis")
                .font(iconFont)
                .foregroundStyle(menuHovered ? Color.nudgePrimary : Color.nudgeTextDim)
                .frame(width: rowMenuSize, height: rowMenuSize)
                .contentShape(Rectangle())
                .onTapGesture { menuShown = true }
                .whenHovered { menuHovered = $0 }
                .accessibilityAddTraits(.isButton)
                .accessibilityLabel(Text("daily.rowMenu", bundle: .module))
                .help(Text("daily.rowMenu", bundle: .module))
                .nudgePopover(isPresented: $menuShown, arrowEdge: .top) {
                    menuItems
                        .padding(.vertical, 6)
                        .frame(minWidth: 200)
                }
        }
    }

    /// Popover 內的 menu items — 樣式對齊 NSMenu，但保留 SwiftUI 控制權。
    @ViewBuilder
    private var menuItems: some View {
        VStack(alignment: .leading, spacing: 0) {
            if !isToday {
                menuItem(label: "daily.moveToToday", icon: "calendar.badge.checkmark") {
                    onMoveToToday()
                }
            }
            if isRecurring {
                menuItem(label: "daily.skipThisOccurrence", icon: "forward") {
                    onSkipThisOccurrence()
                }
            } else {
                menuItem(label: "daily.setRecurring", icon: "arrow.triangle.2.circlepath") {
                    onSetRecurrence()
                }
            }
            menuItem(label: "daily.setReminder", icon: "bell") {
                onSetReminder()
            }
            Divider()
                .padding(.vertical, 4)
            menuItem(label: "daily.archiveButton", icon: "archivebox", destructive: true) {
                onArchive()
            }
        }
    }

    private func menuItem(
        label: LocalizedStringKey,
        icon: String,
        destructive: Bool = false,
        action: @escaping () -> Void
    ) -> some View {
        PopoverMenuItem(
            label: label,
            icon: icon,
            destructive: destructive,
            action: {
                action()
                menuShown = false
            }
        )
    }

    /// macOS 36pt（從 32pt 拉大，icon 更醒目）。
    private var rowMenuSize: CGFloat { 36 }

    /// SF symbol 字級 — ~19pt，配 36pt frame 視覺平衡。
    private var iconFont: Font { .system(size: 19, weight: .medium) }
    #endif
}

#if os(macOS)
/// Popover dropdown 內單一 item — 自己管 hover 高亮 (nudgePrimary @ 15% bg)，
/// destructive item 文字走 red。樣式對齊 NSMenu item 但完全 SwiftUI。
private struct PopoverMenuItem: View {
    let label: LocalizedStringKey
    let icon: String
    let destructive: Bool
    let action: () -> Void

    @State private var hovered = false

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: icon)
                .font(.system(size: 13, weight: .regular))
                .frame(width: 18, alignment: .center)
            Text(label, bundle: .module)
                .font(.system(size: 13))
            Spacer(minLength: 16)
        }
        .foregroundStyle(destructive ? Color.red : Color.nudgeForeground)
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(Rectangle())
        .background(
            RoundedRectangle(cornerRadius: 6, style: .continuous)
                .fill(hovered ? Color.nudgePrimary.opacity(0.15) : Color.clear)
                .padding(.horizontal, 4)
        )
        .onTapGesture(perform: action)
        .whenHovered { hovered = $0 }
    }
}
#endif

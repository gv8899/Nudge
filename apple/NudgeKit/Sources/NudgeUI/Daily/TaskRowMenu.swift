import SwiftUI
import NudgeCore

/// Trailing edge of every Daily task row — 統一 `…` 動作群組 + 一顆獨立
/// 「移到其他日期」icon (放 `…` 左側做為高頻動作的捷徑)。
///
/// 設計取捨：
/// - **移到其他日期**是 user 最常用的動作，從 `…` menu 抽出來變獨立 icon
///   button，少一次點擊；其他次頻動作仍留 `…` 內
/// - `…` 拿掉預設的 ▽ disclosure chevron (`.menuIndicator(.hidden)`)，跟
///   iOS 26 toolbar `…` 視覺一致 (只剩三點、不帶箭頭)
/// - `.menuStyle(.borderlessButton)` 拿掉 macOS 預設的白色 button bezel，
///   不破壞底下 row 的視覺紋理
/// - mac hover 時 icon 上色 nudgePrimary，給 user「這顆可以點」的回饋
public struct TaskRowMenu: View {
    public let isToday: Bool
    public let isRecurring: Bool
    public let onMoveToToday: () -> Void
    public let onMoveToOtherDate: () -> Void
    public let onSkipThisOccurrence: () -> Void
    public let onSetRecurrence: () -> Void
    public let onSetReminder: () -> Void
    public let onArchive: () -> Void

    // iOS 上 .whenHovered 不存在、state 永遠 false (icon 維持 nudgeTextDim)，
    // declare 在 #if 外面避免 body 內參考時 iOS build 缺 symbol。
    @State private var moveHovered = false
    @State private var menuHovered = false
    @State private var menuShown = false

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
        // 12pt spacing — 兩顆 icon 在 36pt 大小下需要明確視覺呼吸。
        //
        // Hover 反覆改不對的 root cause：Button / Menu 在 macOS 上吃掉自己
        // 的 hover 事件、傳不到內部 modifier。最徹底解法是 calendar icon
        // 直接 **不用 Button**，裸 Image + tap gesture + whenHovered，
        // hover state 跟 Image 同一層、沒任何 wrapping 攔。
        HStack(spacing: 12) {
            #if os(macOS)
            // macOS：高頻動作「移到其他日期」獨立 icon — 裸 Image + tap
            // gesture (不包 Button)。iOS row 不放獨立 icon（空間有限），
            // 「移到其他日期」收進 … menu 內。
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
            #endif

            // … menu — 用裸 Image + .popover 自己畫 dropdown，不用 SwiftUI
            // 原生 Menu。Menu 在 macOS 底層走 NSMenu / NSPopUpButton 渲染，
            // `.background()` (whenHovered 棲身處) 在這個轉換中被吃掉、
            // hover 事件永遠不 fire。popover 是純 SwiftUI、保留 view modifier。
            Image(systemName: "ellipsis")
                .font(iconFont)
                .foregroundStyle(menuHovered ? Color.nudgePrimary : Color.nudgeTextDim)
                .frame(width: rowMenuSize, height: rowMenuSize)
                .contentShape(Rectangle())
                .onTapGesture { menuShown = true }
                #if os(macOS)
                .whenHovered { menuHovered = $0 }
                #endif
                .accessibilityAddTraits(.isButton)
                .accessibilityLabel(Text("daily.rowMenu", bundle: .module))
                .help(Text("daily.rowMenu", bundle: .module))
                .popover(isPresented: $menuShown, arrowEdge: .top) {
                    menuItems
                        .padding(.vertical, 6)
                        .frame(minWidth: 200)
                }
        }
    }

    /// Popover 內的 menu items — 樣式對齊 NSMenu (icon + label 水平排列、
    /// 8pt vertical padding、hover 高亮)，但保留 SwiftUI 控制權。
    @ViewBuilder
    private var menuItems: some View {
        VStack(alignment: .leading, spacing: 0) {
            #if os(iOS)
            // iOS：「移到其他日期」收在 menu 內（macOS 是 row 上的獨立 icon）。
            menuItem(label: "daily.moveToOtherDate", icon: "calendar") {
                onMoveToOtherDate()
            }
            #endif
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

    /// macOS 36pt（從 32pt 拉大，icon 更醒目）；iOS 維持 44pt 觸控目標。
    private var rowMenuSize: CGFloat {
        #if os(macOS)
        return 36
        #else
        return 44
        #endif
    }

    /// SF symbol 字級 — 從 `.body.weight(.medium)` (~17pt) 拉到 ~19pt，
    /// 配 36pt frame 視覺更平衡。
    private var iconFont: Font {
        #if os(macOS)
        return .system(size: 19, weight: .medium)
        #else
        return .body.weight(.medium)
        #endif
    }

}

/// Popover dropdown 內單一 item — 自己管 hover 高亮 (nudgePrimary @ 12% bg)，
/// destructive item 文字走 red。樣式對齊 NSMenu item 但完全 SwiftUI、跟
/// design system token 對齊。
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
        #if os(macOS)
        .whenHovered { hovered = $0 }
        #endif
    }
}

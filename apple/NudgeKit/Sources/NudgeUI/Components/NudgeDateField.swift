import SwiftUI

/// 自刻 date field — 顯示當前日期、點開 popover 顯示 NudgeCalendar 月曆讓
/// 使用者選日。繞過 SwiftUI `DatePicker(.graphical)` 系統藍 + 固定 size 問題。
struct NudgeDateField: View {
    @Binding var date: Date
    @Environment(\.locale) private var locale

    @State private var open = false
    @State private var hovered = false

    var body: some View {
        Button {
            open = true
        } label: {
            HStack(spacing: 8) {
                Image(systemName: "calendar")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(Color.nudgeTextDim)
                Text(formattedDate)
                    .nudgeFont(.primaryRowTitle) // 14pt — 跟 NudgeDropdown / row label 同字級
                    .foregroundStyle(Color.nudgeForeground)
            }
            .padding(.horizontal, 14)
            .frame(height: 34) // 跟 NudgeDropdown 同高
            .background(
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(hovered ? Color.nudgeForeground.opacity(0.10) : Color.nudgeForeground.opacity(0.06))
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        #if os(macOS)
        .whenHovered { hovered = $0 }
        #endif
        // arrowEdge `.bottom` = arrow 在 anchor 下緣 → popover 在 anchor
        // 下方彈出（往下展開）。`.top` 反而會在上方，違反 calendar 慣例。
        .nudgePopover(isPresented: $open, arrowEdge: .bottom) {
            NudgeCalendar(selectedDate: $date)
                .padding(16)
                .frame(width: 320)
        }
    }

    private var formattedDate: String {
        date.formatted(.dateTime.year().month(.abbreviated).day().locale(locale))
    }
}

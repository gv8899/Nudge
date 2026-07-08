import SwiftUI

/// 自刻 dropdown — 繞過 SwiftUI `Picker(.menu)` 在 macOS 轉成 NSPopUpButton
/// 帶系統藍 chevron / bezel 的問題。Button + `.popover` 顯示選項清單、
/// item hover = nudgePrimary 12% 高亮、全部 SwiftUI 渲染。
///
/// 用法：
/// ```
/// NudgeDropdown(selection: $selectedPreset, options: [
///     (nil, Text("無")),
///     (.daily, Text("每日"))
/// ])
/// ```
struct NudgeDropdown<Value: Hashable>: View {
    @Binding var selection: Value
    let options: [(Value, Text)]
    /// 顯示在 dropdown trigger 的文字：通常是當前 selection 對應的 label。
    let trigger: Text

    @State private var open = false
    @State private var triggerHovered = false

    var body: some View {
        Button {
            open = true
        } label: {
            HStack(spacing: 6) {
                trigger
                    .nudgeFont(.primaryRowTitle) // 14pt — 跟 row label 同字級
                    .foregroundStyle(Color.nudgeForeground)
                    .lineLimit(1)
                Image(systemName: "chevron.up.chevron.down")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Color.nudgeTextDim)
            }
            .padding(.horizontal, 14)
            .frame(height: 34) // 字級拉到 14pt 後 32pt 太擠、稍微高一點
            .background(
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(triggerHovered ? Color.nudgeForeground.opacity(0.10) : Color.nudgeForeground.opacity(0.06))
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        #if os(macOS)
        .whenHovered { triggerHovered = $0 }
        #endif
        .nudgePopover(isPresented: $open, arrowEdge: .bottom) {
            VStack(alignment: .leading, spacing: 0) {
                ForEach(Array(options.enumerated()), id: \.offset) { _, opt in
                    DropdownItem(
                        label: opt.1,
                        selected: opt.0 == selection,
                        action: {
                            selection = opt.0
                            open = false
                        }
                    )
                }
            }
            .padding(.vertical, 6)
            .frame(minWidth: 160)
        }
    }
}

private struct DropdownItem: View {
    let label: Text
    let selected: Bool
    let action: () -> Void
    @State private var hovered = false

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "checkmark")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Color.nudgePrimary)
                .frame(width: 14)
                .opacity(selected ? 1 : 0)
            label
                .font(.system(size: 13))
                .foregroundStyle(Color.nudgeForeground)
            Spacer(minLength: 16)
        }
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

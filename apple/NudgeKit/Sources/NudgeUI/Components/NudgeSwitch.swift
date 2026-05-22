import SwiftUI

/// 自刻 switch toggle，繞過 SwiftUI `Toggle` 在 macOS 轉成系統灰 NSCheckbox /
/// NSSwitch 的問題（同 [feedback_swiftui_appkit_hybrid_controls]）：tint 進
/// 不去 system control。
///
/// Thumb 用 `.offset` 而非 `ZStack alignment` 換邊 — alignment 是 layout
/// property、切換 = re-layout，動畫不平滑（會 snap）；`.offset` 是 transform
/// property、SwiftUI implicit animation 真的可以連續插值，滑動順。
struct NudgeSwitch: View {
    @Binding var isOn: Bool

    private let width: CGFloat = 44
    private let height: CGFloat = 26
    private let thumb: CGFloat = 22

    /// Thumb 兩端位置（從中央算 offset）：on = +offsetMax / off = -offsetMax。
    private var thumbOffset: CGFloat {
        let max = (width - thumb) / 2 - 2 // 2 = capsule 內側 padding
        return isOn ? max : -max
    }

    var body: some View {
        ZStack {
            Capsule()
                .fill(isOn ? Color.nudgePrimary : Color.nudgeForeground.opacity(0.22))
                .frame(width: width, height: height)

            Circle()
                .fill(Color.white)
                .frame(width: thumb, height: thumb)
                .shadow(color: Color.black.opacity(0.18), radius: 1.5, x: 0, y: 1)
                .offset(x: thumbOffset)
        }
        .frame(width: width, height: height)
        .contentShape(Rectangle())
        .onTapGesture {
            isOn.toggle()
        }
        // animation value 綁在 isOn — capsule fill + thumb offset 兩者同 spring
        // 一起順動畫。spring response 0.28 / damping 0.78 = 接近 Apple system
        // switch 的彈性回饋。
        .animation(.spring(response: 0.28, dampingFraction: 0.78), value: isOn)
        .accessibilityAddTraits(.isButton)
        .accessibilityValue(Text(isOn ? "On" : "Off"))
    }
}

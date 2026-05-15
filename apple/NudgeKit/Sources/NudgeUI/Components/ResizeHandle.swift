#if os(macOS)
import SwiftUI

/// 自製水平 resize handle — 8pt 透明 hit zone，**只在 hover / drag 時**
/// 才浮出 3pt 粗線，平常完全隱形（Heptabase pattern：兩個區塊看起來
/// 無縫，hover 才顯示分隔線）。線用 .easeOut(0.15) fade in/out。
///
/// 假設 panel 在 handle 的**右**邊（list / content 在左）：往右拖 = panel
/// 變窄。要支援其他方向再加 `panelSide` 參數，目前 Daily / Cards 兩個
/// call site 都是 panel-on-right，YAGNI 不先抽。
///
/// `.global` coordinate space 算 drag translation —— 避免 handle 隨 panel
/// 變窄往右移、cursor-handle 相對座標 feedback 抖動（之前 inline 版本
/// 已驗證過這個 root cause）。
struct ResizeHandle: View {
    @Binding var width: Double
    let range: ClosedRange<Double>

    @State private var dragStart: Double?
    @State private var hovered = false

    var body: some View {
        let lineVisible = hovered || dragStart != nil
        ZStack {
            Color.clear
                .contentShape(Rectangle())
            Rectangle()
                .fill(Color.nudgePrimary)
                .frame(width: 3)
                .frame(maxHeight: .infinity)
                .opacity(lineVisible ? 1 : 0)
                .animation(.easeOut(duration: 0.15), value: lineVisible)
        }
        .frame(width: 8)
        .frame(maxHeight: .infinity)
        .onHover { hovering in
            hovered = hovering
            if hovering {
                NSCursor.resizeLeftRight.set()
            } else {
                NSCursor.arrow.set()
            }
        }
        .gesture(
            DragGesture(minimumDistance: 0, coordinateSpace: .global)
                .onChanged { value in
                    if dragStart == nil { dragStart = width }
                    let base = dragStart ?? width
                    let proposed = base - Double(value.translation.width)
                    width = max(range.lowerBound, min(range.upperBound, proposed))
                }
                .onEnded { _ in
                    dragStart = nil
                }
        )
    }
}
#endif

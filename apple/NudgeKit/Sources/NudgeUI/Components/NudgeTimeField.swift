import SwiftUI

/// 自刻時段 picker — 點開 popover 顯示兩個垂直滾動 wheel：時 (00-23) +
/// 分 (00-59，1 分鐘步進)。selected = 滾動到中央的值。
///
/// 繞過 SwiftUI 沒在 macOS 提供 `.pickerStyle(.wheel)` 的限制（wheel 只
/// 在 iOS / watchOS）。自刻 ScrollView + `.scrollTargetBehavior(.viewAligned)`
/// + `.scrollPosition(id:)` (iOS 17 / macOS 14+ API) 達到滾輪 snap 效果。
///
/// 上下漸層 mask + 中央高亮帶營造 iOS wheel picker 的視覺，但完全 SwiftUI、
/// 沒摸 AppKit、用 design system token。
struct NudgeTimeField: View {
    @Binding var date: Date
    @State private var open = false
    @State private var hovered = false

    private let calendar = Calendar(identifier: .gregorian)

    var body: some View {
        Button {
            open = true
        } label: {
            Text(formattedTime)
                .nudgeFont(.primaryRowTitle) // 14pt — 跟 dropdown / row 同字級
                .foregroundStyle(Color.nudgeForeground)
                .padding(.horizontal, 14)
                .frame(height: 34)
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
        .popover(isPresented: $open, arrowEdge: .bottom) {
            HStack(spacing: 4) {
                TimeScrollWheel(values: Array(0..<24), selected: hourBinding)
                Text(":")
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(Color.nudgeForeground)
                TimeScrollWheel(values: Array(0..<60), selected: minuteBinding)
            }
            .padding(16)
        }
    }

    private var formattedTime: String {
        String(format: "%02d:%02d", hour, minute)
    }

    private var hour: Int { calendar.component(.hour, from: date) }
    private var minute: Int { calendar.component(.minute, from: date) }

    private var hourBinding: Binding<Int> {
        Binding(
            get: { hour },
            set: { h in
                date = calendar.date(bySettingHour: h, minute: minute, second: 0, of: date) ?? date
            }
        )
    }

    private var minuteBinding: Binding<Int> {
        Binding(
            get: { minute },
            set: { m in
                date = calendar.date(bySettingHour: hour, minute: m, second: 0, of: date) ?? date
            }
        )
    }
}

/// 單一垂直滾輪 — ScrollView + viewAligned snap + 上下漸層 mask + 中央
/// 高亮帶。中央值 = 當前 selection。
private struct TimeScrollWheel: View {
    let values: [Int]
    @Binding var selected: Int

    @State private var scrollID: Int?

    private let rowHeight: CGFloat = 32
    private let visibleRows = 5
    private var totalHeight: CGFloat { rowHeight * CGFloat(visibleRows) }
    /// 上下各塞兩個空白格（rowHeight × 2）讓首/末值能滾到中央。
    private var edgePadding: CGFloat { rowHeight * 2 }

    var body: some View {
        ScrollView(.vertical, showsIndicators: false) {
            LazyVStack(spacing: 0) {
                Color.clear.frame(height: edgePadding)
                ForEach(values, id: \.self) { value in
                    Text(String(format: "%02d", value))
                        .font(.system(size: 16, weight: value == selected ? .semibold : .regular))
                        .foregroundStyle(value == selected ? Color.nudgePrimary : Color.nudgeForeground)
                        .frame(width: 60, height: rowHeight)
                        .contentShape(Rectangle())
                        .id(value)
                        .onTapGesture {
                            withAnimation(.easeOut(duration: 0.2)) {
                                scrollID = value
                            }
                        }
                }
                Color.clear.frame(height: edgePadding)
            }
            .scrollTargetLayout()
        }
        .scrollPosition(id: $scrollID, anchor: .center)
        .scrollTargetBehavior(.viewAligned)
        .frame(width: 60, height: totalHeight)
        .overlay(
            // 中央高亮帶 — 標記「這列是 selected」。allowsHitTesting(false)
            // 不擋下面的 scroll gesture。
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(Color.nudgePrimary.opacity(0.12))
                .frame(height: rowHeight)
                .allowsHitTesting(false)
        )
        .mask(
            // 上下淡出做 wheel 「霧化」感，視覺收斂到中央 selection。
            LinearGradient(
                stops: [
                    .init(color: .clear, location: 0),
                    .init(color: .black, location: 0.28),
                    .init(color: .black, location: 0.72),
                    .init(color: .clear, location: 1)
                ],
                startPoint: .top,
                endPoint: .bottom
            )
        )
        .onAppear {
            // 初值對齊到當前 selected
            scrollID = selected
        }
        .onChange(of: scrollID) { _, new in
            if let new, new != selected {
                selected = new
            }
        }
    }
}

import SwiftUI
import NudgeCore

#if os(macOS)
/// Mac 版卡片 grid tile — 標題 + 多行預覽 + 日期。比 CardListItemView
/// 更高（160pt 起）、更方形，適合 LazyVGrid 排成 2-3 欄。selected /
/// hover 各有獨立 highlight 樣式。
public struct CardGridItemView: View {
    public let card: CardDTO
    public let isSelected: Bool
    public let onTap: () -> Void

    /// 預覽文字 init 時計算一次（O(L) 字串處理 in body 等於每 scroll
    /// 一幀就跑一次，很貴）。
    private let preview: String

    @State private var isHovered = false

    public init(card: CardDTO, isSelected: Bool, onTap: @escaping () -> Void) {
        self.card = card
        self.isSelected = isSelected
        self.onTap = onTap
        // grid tile 比 list row 高，可以多顯示一些預覽。
        self.preview = card.description.strippedHTML(maxLength: 240)
    }

    public var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: 8) {
                titleText

                if !preview.isEmpty {
                    Text(verbatim: preview)
                        .nudgeFont(.rowBody)
                        .foregroundStyle(Color.nudgeTextDim)
                        .lineLimit(5)
                        .multilineTextAlignment(.leading)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                Spacer(minLength: 4)

                HStack {
                    Spacer()
                    Text(verbatim: updatedShort)
                        .nudgeFont(.rowMeta)
                        .foregroundStyle(Color.nudgeTextDim)
                        .monospacedDigit()
                }
            }
            .padding(14)
            .frame(maxWidth: .infinity, minHeight: 168, alignment: .topLeading)
            .background(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(backgroundColor)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .strokeBorder(
                        isSelected ? Color.nudgeSelectedStroke : Color.clear,
                        lineWidth: 2
                    )
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .onHover { isHovered = $0 }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(Text(verbatim: a11yLabel))
        .accessibilityAddTraits(.isButton)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    /// selected 優先於 hover；hover 用統一 token 跟 list rows 對齊。
    private var backgroundColor: Color {
        if isSelected {
            return Color.nudgeSelectedFill
        } else if isHovered {
            return Color.nudgeHoverFill
        } else {
            return Color.nudgeForeground.opacity(0.04)
        }
    }

    @ViewBuilder
    private var titleText: some View {
        if card.title.isEmpty {
            Text("cards.untitled", bundle: .module)
                .nudgeFont(.cardTitle)
                .italic()
                .foregroundStyle(Color.nudgeTextDim)
                .lineLimit(2)
                .multilineTextAlignment(.leading)
        } else {
            Text(verbatim: card.title)
                .nudgeFont(.cardTitle)
                .foregroundStyle(Color.nudgeForeground)
                .lineLimit(2)
                .multilineTextAlignment(.leading)
        }
    }

    private var updatedShort: String {
        let cal = Calendar(identifier: .gregorian)
        let m = cal.component(.month, from: card.updatedAt)
        let d = cal.component(.day, from: card.updatedAt)
        return "\(m)/\(d)"
    }

    private var a11yLabel: String {
        let title = card.title.isEmpty ? "Untitled" : card.title
        if preview.isEmpty {
            return "\(title), \(updatedShort)"
        }
        return "\(title), \(preview), \(updatedShort)"
    }
}
#endif

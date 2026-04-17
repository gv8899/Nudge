import SwiftUI
import NudgeCore

public struct CardListItemView: View {
    public let card: CardDTO
    public let onTap: () -> Void

    public init(card: CardDTO, onTap: @escaping () -> Void) {
        self.card = card
        self.onTap = onTap
    }

    public var body: some View {
        Button(action: onTap) {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(titleText)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Color.nudgeForeground)
                        .lineLimit(1)

                    Text(preview)
                        .font(.caption)
                        .foregroundStyle(Color.nudgeTextDim)
                        .lineLimit(2)

                    if !card.tags.isEmpty {
                        HStack(spacing: 4) {
                            ForEach(card.tags, id: \.id) { tag in
                                TagBadgeView(tag: tag)
                            }
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                Text(updatedShort)
                    .font(.caption2)
                    .foregroundStyle(Color.nudgeTextDim)
                    .monospacedDigit()
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private var titleText: String {
        card.title.isEmpty ? "—" : card.title
    }

    private var preview: String {
        card.description.strippedHTML(maxLength: 150)
    }

    private var updatedShort: String {
        let cal = Calendar(identifier: .gregorian)
        let m = cal.component(.month, from: card.updatedAt)
        let d = cal.component(.day, from: card.updatedAt)
        return "\(m)/\(d)"
    }
}

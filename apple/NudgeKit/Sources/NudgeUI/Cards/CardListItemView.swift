import SwiftUI
import NudgeCore

public struct CardListItemView: View {
    public let card: CardDTO
    public let onTap: () -> Void

    /// Stripped HTML preview computed once at init — was recomputed on
    /// every body render, which scaled O(L) per visible row × every
    /// scroll frame. With 100 cards that adds up.
    private let preview: String

    public init(card: CardDTO, onTap: @escaping () -> Void) {
        self.card = card
        self.onTap = onTap
        self.preview = card.description.strippedHTML(maxLength: 150)
    }

    public var body: some View {
        Button(action: onTap) {
            // Vertical stack so title fully owns the top line — date moved
            // to bottom-right so it stops competing for the eye's first
            // landing point. Tags removed from list (kept on detail) to
            // reduce density and let title dominate.
            VStack(alignment: .leading, spacing: 6) {
                Text(titleText)
                    .font(.body.weight(.semibold))
                    .italic(card.title.isEmpty)
                    .foregroundStyle(card.title.isEmpty ? Color.nudgeTextDim : Color.nudgeForeground)
                    .lineLimit(1)
                    .frame(maxWidth: .infinity, alignment: .leading)

                if !preview.isEmpty {
                    Text(preview)
                        .font(.caption)
                        .foregroundStyle(Color.nudgeTextDim)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                HStack {
                    Spacer()
                    Text(updatedShort)
                        .font(.caption2)
                        .foregroundStyle(Color.nudgeTextDim)
                        .monospacedDigit()
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .frame(minHeight: 76)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        // Combine for VoiceOver: one trip per row instead of 4 separate
        // labels (title, preview, date, button).
        .accessibilityElement(children: .combine)
        .accessibilityLabel(Text(verbatim: a11yLabel))
        .accessibilityAddTraits(.isButton)
    }

    private var titleText: LocalizedStringKey {
        // LocalizedStringKey can carry literal strings too — falls back
        // to the raw title when present.
        card.title.isEmpty ? "cards.untitled" : LocalizedStringKey(card.title)
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

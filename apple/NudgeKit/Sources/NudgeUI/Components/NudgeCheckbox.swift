import SwiftUI

/// Square checkbox with design tokens, 44×44 touch target, and a
/// mandatory accessibility label. Use this instead of assembling a
/// Button + Image(systemName: "square") + frame + accessibilityLabel
/// by hand in every row.
public struct NudgeCheckbox: View {
    public let isChecked: Bool
    public let accessibilityLabel: LocalizedStringKey
    /// 觸控框尺寸（預設 44 = 標準列）。子項目列傳較小值讓列更緊湊；
    /// 字形大小（.title3）不變 → 勾選框「看起來一樣大」，只是框更小。
    public let size: CGFloat
    public let action: () -> Void

    public init(
        isChecked: Bool,
        accessibilityLabel: LocalizedStringKey,
        size: CGFloat = 44,
        action: @escaping () -> Void
    ) {
        self.isChecked = isChecked
        self.accessibilityLabel = accessibilityLabel
        self.size = size
        self.action = action
    }

    public var body: some View {
        Button(action: action) {
            // Plain symbol swap. The previous version layered
            // `.contentTransition(.symbolEffect(.replace))` and
            // `.symbolEffect(.bounce, value: isChecked)`, which raced with
            // SwiftUI's ForEach reordering when the row moved between
            // pending / completed sections — the freshly-mounted row
            // sometimes rendered the OLD glyph because the symbol effect
            // was animating in. Removing the in-place animation makes
            // the glyph reflect `isChecked` immediately on render.
            Image(systemName: isChecked ? "checkmark.square.fill" : "square")
                .font(.title3)
                .foregroundStyle(isChecked ? Color.nudgePrimary : Color.nudgeTextDim)
                .frame(minWidth: size, minHeight: size)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .sensoryFeedback(.selection, trigger: isChecked)
        .accessibilityLabel(Text(accessibilityLabel, bundle: .module))
        .accessibilityAddTraits(isChecked ? .isSelected : [])
    }
}

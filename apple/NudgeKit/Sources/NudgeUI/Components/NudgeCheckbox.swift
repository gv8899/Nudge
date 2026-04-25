import SwiftUI

/// Square checkbox with design tokens, 44×44 touch target, and a
/// mandatory accessibility label. Use this instead of assembling a
/// Button + Image(systemName: "square") + frame + accessibilityLabel
/// by hand in every row.
public struct NudgeCheckbox: View {
    public let isChecked: Bool
    public let accessibilityLabel: LocalizedStringKey
    public let action: () -> Void

    public init(
        isChecked: Bool,
        accessibilityLabel: LocalizedStringKey,
        action: @escaping () -> Void
    ) {
        self.isChecked = isChecked
        self.accessibilityLabel = accessibilityLabel
        self.action = action
    }

    public var body: some View {
        Button(action: action) {
            // `.symbolEffect(.bounce)` gives the tick a small, physical
            // pop on every toggle — cheap iOS 17+ polish that makes the
            // row feel alive. `.contentTransition(.symbolEffect(.replace))`
            // crossfades between the empty-box and filled glyphs so the
            // change reads as one animation, not a swap.
            Image(systemName: isChecked ? "checkmark.square.fill" : "square")
                .font(.title3)
                .foregroundStyle(isChecked ? Color.nudgePrimary : Color.nudgeTextDim)
                .contentTransition(.symbolEffect(.replace))
                .symbolEffect(.bounce, value: isChecked)
                .frame(minWidth: 44, minHeight: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .sensoryFeedback(.selection, trigger: isChecked)
        .accessibilityLabel(Text(accessibilityLabel, bundle: .module))
        .accessibilityAddTraits(isChecked ? .isSelected : [])
    }
}

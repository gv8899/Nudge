import SwiftUI
import NudgeCore

/// Larger-body tag filter chip used wherever the user picks one or more
/// tags to narrow a card list (Cards host + dedicated Search tab). Sized
/// for a ~40pt tap target (`.subheadline` + 14/10 padding) — the old
/// `.caption` chips at 5pt vertical padding were ~22pt and failed iOS
/// HIG's 44pt guidance.
///
/// Animates scale on press so the touch surface feels responsive without
/// needing color state gymnastics. `contentShape(Capsule())` makes the
/// tap area match the visible pill exactly.
public struct TagFilterChip: View {
    public let name: String
    public let active: Bool
    public let action: () -> Void

    public init(name: String, active: Bool, action: @escaping () -> Void) {
        self.name = name
        self.active = active
        self.action = action
    }

    public var body: some View {
        Button(action: action) {
            Text(name)
                .font(.subheadline.weight(.medium))
                .foregroundStyle(active ? Color.nudgePrimaryForeground : Color.nudgeForeground)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(
                    Capsule().fill(active ? Color.nudgePrimary : Color.clear)
                )
                .overlay(
                    Capsule().stroke(
                        active ? Color.nudgePrimary : Color.nudgeBorder,
                        lineWidth: active ? 1 : 1.25
                    )
                )
                .contentShape(Capsule())
        }
        .buttonStyle(PressableChipStyle())
        .accessibilityAddTraits(active ? [.isSelected] : [])
    }
}

/// Subtle scale-down on press for chip-style buttons. Pure `.scaleEffect`
/// animates via the hardware compositor (no layout invalidation) so the
/// response is crisp even when many chips render at once.
public struct PressableChipStyle: ButtonStyle {
    public init() {}

    public func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.96 : 1.0)
            .opacity(configuration.isPressed ? 0.85 : 1.0)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

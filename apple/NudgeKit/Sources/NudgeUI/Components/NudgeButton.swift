import SwiftUI

/// Primary-action button pre-wired to design tokens. Use this for
/// "確認 / 儲存 / 提交" style actions so every sheet and form doesn't
/// re-specify padding + capsule + colours.
public struct NudgeButton: View {
    public enum Variant {
        case primary
        case secondary
        case destructive
    }

    public let title: LocalizedStringKey
    public let variant: Variant
    public let action: () -> Void

    public init(
        _ title: LocalizedStringKey,
        variant: Variant = .primary,
        action: @escaping () -> Void
    ) {
        self.title = title
        self.variant = variant
        self.action = action
    }

    public var body: some View {
        Button(action: action) {
            Text(title, bundle: .module)
                .fontWeight(.semibold)
                .foregroundStyle(foreground)
                .padding(.horizontal, 24)
                .padding(.vertical, 10)
                .background(Capsule().fill(background))
                .contentShape(Capsule())
        }
        .buttonStyle(.plain)
    }

    private var foreground: Color {
        switch variant {
        case .primary: return .nudgePrimaryForeground
        case .secondary: return .nudgeForeground
        case .destructive: return .nudgePrimaryForeground
        }
    }

    private var background: Color {
        switch variant {
        case .primary: return .nudgePrimary
        case .secondary: return .nudgeBorderLight
        case .destructive: return .nudgeDestructive
        }
    }
}

import SwiftUI

/// First-run 行內提示的小泡泡（鏡像 web `OnboardingHint`）。可 dismiss。
/// 用在任務列上方（TaskListView）與逾期區上方（DailyHostView）。
public struct OnboardingHintBar: View {
    private let textKey: LocalizedStringKey
    private let onDismiss: () -> Void

    public init(textKey: LocalizedStringKey, onDismiss: @escaping () -> Void) {
        self.textKey = textKey
        self.onDismiss = onDismiss
    }

    public var body: some View {
        HStack(spacing: 10) {
            Text(verbatim: "↳")
                .nudgeFont(.rowMeta)
                .foregroundStyle(Color.nudgeTextDim)
            Text(textKey, bundle: .module)
                .nudgeFont(.rowMeta)
                .foregroundStyle(Color.nudgeForeground)
            Spacer(minLength: 8)
            Button(action: onDismiss) {
                Text("onboarding.hint.dismiss", bundle: .module)
                    .nudgeFont(.inlineButtonLabel)
                    .foregroundStyle(Color.nudgeTextDim)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(Color.nudgeSelectedFill)
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }
}

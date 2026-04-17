import SwiftUI

public struct ErrorBannerView: View {
    public let onRetry: () -> Void

    public init(onRetry: @escaping () -> Void) {
        self.onRetry = onRetry
    }

    public var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle")
                .foregroundStyle(Color.nudgeChart5)
            Text("error.unknown", bundle: .module)
                .font(.footnote)
                .foregroundStyle(Color.nudgeForeground)
            Spacer()
            Button(action: onRetry) {
                Text(verbatim: "↻")
                    .font(.footnote.weight(.medium))
                    .foregroundStyle(Color.nudgePrimary)
                    .frame(minWidth: 44, minHeight: 36)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(Color.nudgeChart5.opacity(0.1))
    }
}

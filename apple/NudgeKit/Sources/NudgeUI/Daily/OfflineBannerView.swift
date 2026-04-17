import SwiftUI
import NudgeCore

public struct OfflineBannerView: View {
    public let lastUpdated: String

    public init(lastUpdated: String) {
        self.lastUpdated = lastUpdated
    }

    public var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "wifi.slash")
                .foregroundStyle(Color.nudgeTextDim)
            Text(verbatim: String(
                format: NSLocalizedString("offline.banner", bundle: .module, comment: ""),
                lastUpdated
            ))
                .font(.footnote)
                .foregroundStyle(Color.nudgeForeground)
            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(Color.nudgeBorderLight.opacity(0.3))
    }
}

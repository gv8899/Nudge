import SwiftUI
import NudgeCore

public struct OfflineBannerView: View {
    public let lastUpdated: String
    @Environment(\.locale) private var locale

    public init(lastUpdated: String) {
        self.lastUpdated = lastUpdated
    }

    public var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "wifi.slash")
                .foregroundStyle(Color.nudgeWarning)
            Text(verbatim: String(
                format: nudgeLocalized("offline.banner", locale: locale),
                lastUpdated
            ))
                .font(.footnote)
                .foregroundStyle(Color.nudgeForeground)
            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(Color.nudgeWarning.opacity(0.12))
    }
}

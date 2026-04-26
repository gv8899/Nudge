import SwiftUI

/// Standard icon-only button with a 44×44 touch target (iOS HIG minimum)
/// and a mandatory accessibility label.
public struct IconButton: View {
    public let systemName: String
    public let accessibilityLabel: LocalizedStringKey
    public let foreground: Color
    public let role: ButtonRole?
    public let action: () -> Void

    public init(
        systemName: String,
        accessibilityLabel: LocalizedStringKey,
        foreground: Color = .nudgeTextDim,
        role: ButtonRole? = nil,
        action: @escaping () -> Void
    ) {
        self.systemName = systemName
        self.accessibilityLabel = accessibilityLabel
        self.foreground = foreground
        self.role = role
        self.action = action
    }

    public var body: some View {
        Button(role: role, action: action) {
            Image(systemName: systemName)
                .foregroundStyle(foreground)
                .frame(minWidth: 44, minHeight: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(Text(accessibilityLabel, bundle: .module))
        // mac 端 hover 顯示 tooltip。a11y label 已經是這顆按鈕的意義，
        // 直接重用，不需要每個 call site 自己再加一次 .help()。在 iOS
        // 上 .help() 沒視覺影響，但會被 VoiceOver 用作 hint，無害。
        .help(Text(accessibilityLabel, bundle: .module))
    }
}

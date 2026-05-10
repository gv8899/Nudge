import SwiftUI

/// Standard icon-only button with a 44×44 touch target (iOS HIG minimum)
/// and a mandatory accessibility label.
public struct IconButton: View {
    public let systemName: String
    public let accessibilityLabel: LocalizedStringKey
    public let foreground: Color
    public let role: ButtonRole?
    /// 內部 SF Symbol 字級。預設 nil = SwiftUI 自動 (~13pt mac 系統字
    /// 級)。call site 想要更大的 icon（例如 toolbar action 視覺要 stand
    /// out）就傳 `.system(size: 18, weight: .medium)` 之類的。
    public let imageFont: Font?
    public let action: () -> Void

    public init(
        systemName: String,
        accessibilityLabel: LocalizedStringKey,
        foreground: Color = .nudgeTextDim,
        role: ButtonRole? = nil,
        imageFont: Font? = nil,
        action: @escaping () -> Void
    ) {
        self.systemName = systemName
        self.accessibilityLabel = accessibilityLabel
        self.foreground = foreground
        self.role = role
        self.imageFont = imageFont
        self.action = action
    }

    public var body: some View {
        Button(role: role, action: action) {
            // imageFont 沒傳 (= nil) 時刻意 *不套* `.font(nil)` —
            // `.font(nil)` 跟「完全省略 .font 修飾器」在 SwiftUI 行為上理論
            // 上等效，但實務上偶爾有微妙差異（特別是 SF Symbol）。為了
            // 不影響既有 call site 的視覺，nil 時直接不掛。
            Group {
                if let imageFont {
                    Image(systemName: systemName).font(imageFont)
                } else {
                    Image(systemName: systemName)
                }
            }
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

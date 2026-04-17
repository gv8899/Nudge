import SwiftUI
import NudgeCore

public struct TagBadgeView: View {
    public let tag: TagDTO

    public init(tag: TagDTO) {
        self.tag = tag
    }

    public var body: some View {
        Text(tag.name)
            .font(.caption2)
            .foregroundStyle(Color.nudgeForeground)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(
                Capsule().fill(parsedColor.opacity(0.2))
            )
            .overlay(
                Capsule().stroke(parsedColor, lineWidth: 0.5)
            )
    }

    private var parsedColor: Color {
        Color(hex: tag.color) ?? Color.nudgeTextDim
    }
}

private extension Color {
    init?(hex: String) {
        let hex = hex.replacingOccurrences(of: "#", with: "")
        guard hex.count == 6, let value = UInt32(hex, radix: 16) else { return nil }
        let r = Double((value >> 16) & 0xff) / 255.0
        let g = Double((value >> 8) & 0xff) / 255.0
        let b = Double(value & 0xff) / 255.0
        self.init(red: r, green: g, blue: b)
    }
}

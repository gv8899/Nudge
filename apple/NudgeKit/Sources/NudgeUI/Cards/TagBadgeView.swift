import SwiftUI
import NudgeCore

/// Outline-only tag chip — no colour. Tags now scale to many without
/// colour collisions. The server still stores `tag.color` but we ignore
/// it in display; web is being aligned to drop the picker too.
public struct TagBadgeView: View {
    public let tag: TagDTO

    public init(tag: TagDTO) {
        self.tag = tag
    }

    public var body: some View {
        Text(tag.name)
            .font(.caption2)
            .foregroundStyle(Color.nudgeForeground)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .overlay(
                // Was nudgeBorderLight — invisible against dark mode bg.
                // nudgeBorder gives just enough contrast to read as a chip.
                Capsule().stroke(Color.nudgeBorder, lineWidth: 1)
            )
    }
}

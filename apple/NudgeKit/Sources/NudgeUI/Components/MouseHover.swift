#if os(macOS)
import SwiftUI
import AppKit

/// SwiftUI 原生 `.onHover` / `.onContinuousHover` 在 macOS 上有已知 bug
/// (Apple FB-multiple, John Siracusa Mastodon 2023)：高速 cursor 移動、
/// Button 包裝下 callback 不一定 fire / 不一定 reset。foregroundStyle 跟
/// 著 hover state 切換的場景特別容易卡住。
///
/// 走 AppKit `NSTrackingArea` 直接訂閱 mouseEntered / mouseExited 事件、
/// 完全繞過 SwiftUI 的 hover layer。事件可靠。
///
/// **Reference**: <https://gist.github.com/importRyan/c668904b0c5442b80b6f38a980595031>
///
/// 用法：
/// ```swift
/// Image(systemName: "calendar")
///     .foregroundStyle(hovered ? .nudgePrimary : .nudgeTextDim)
///     .whenHovered { hovered = $0 }
/// ```
extension View {
    func whenHovered(_ mouseIsInside: @escaping (Bool) -> Void) -> some View {
        modifier(MouseInsideModifier(mouseIsInside))
    }
}

private struct MouseInsideModifier: ViewModifier {
    let mouseIsInside: (Bool) -> Void

    init(_ mouseIsInside: @escaping (Bool) -> Void) {
        self.mouseIsInside = mouseIsInside
    }

    func body(content: Content) -> some View {
        content.background(
            GeometryReader { proxy in
                Representable(mouseIsInside: mouseIsInside, frame: proxy.frame(in: .global))
            }
        )
    }

    private struct Representable: NSViewRepresentable {
        let mouseIsInside: (Bool) -> Void
        let frame: NSRect

        func makeCoordinator() -> Coordinator {
            let c = Coordinator()
            c.mouseIsInside = mouseIsInside
            return c
        }

        final class Coordinator: NSResponder {
            var mouseIsInside: ((Bool) -> Void)?

            override func mouseEntered(with event: NSEvent) {
                mouseIsInside?(true)
            }

            override func mouseExited(with event: NSEvent) {
                mouseIsInside?(false)
            }
        }

        func makeNSView(context: Context) -> NSView {
            let view = NSView(frame: frame)
            let options: NSTrackingArea.Options = [
                .mouseEnteredAndExited,
                .inVisibleRect,
                .activeInKeyWindow
            ]
            let trackingArea = NSTrackingArea(
                rect: frame,
                options: options,
                owner: context.coordinator,
                userInfo: nil
            )
            view.addTrackingArea(trackingArea)
            return view
        }

        func updateNSView(_ nsView: NSView, context: Context) {}

        static func dismantleNSView(_ nsView: NSView, coordinator: Coordinator) {
            nsView.trackingAreas.forEach { nsView.removeTrackingArea($0) }
        }
    }
}
#endif

import SwiftUI
import WebKit

#if os(iOS)
import UIKit
#endif

#if os(macOS)
import AppKit
#endif

/// Rich-text editor backed by WKWebView + TipTap.
/// Public API unchanged from the previous NSAttributedString version:
/// caller owns HTML string, editor reports back updated HTML on each edit.
///
/// Ships with activeMarks state for an attached EditorToolbar; if no
/// toolbar is wired up the activeMarks binding can be nil.
public struct RichTextEditor: View {
    @Binding var html: String
    let placeholder: String
    let activeMarks: Binding<ActiveMarks>?
    let commandBus: EditorCommandBus?

    @Environment(\.colorScheme) private var colorScheme
    @State private var contentHeight: CGFloat = 0

    public init(
        html: Binding<String>,
        placeholder: String = "",
        activeMarks: Binding<ActiveMarks>? = nil,
        commandBus: EditorCommandBus? = nil
    ) {
        self._html = html
        self.placeholder = placeholder
        self.activeMarks = activeMarks
        self.commandBus = commandBus
    }

    public var body: some View {
        #if os(macOS)
        // WKWebView 上面是可編輯文字 → WebKit 進入時設 I-beam（正確）；
        // 但離開 WebView 到 SwiftUI 一般區域時，WebKit 不會主動釋放 cursor
        // 回 arrow → 整個視窗都卡 I-beam。兩條 reset 路徑：
        //
        // 1. `.onHover { hovering=false }`：滑鼠正常移出 editor bounds。
        // 2. `.onDisappear`：editor 被父層替換（例 Notes canvas→feed
        //    切換、tab 切換、card detail 關閉）的剎那，滑鼠仍在 editor
        //    座標上、hover 不會 fire false，但 view 消失了 cursor 還卡
        //    著 → onDisappear 補一刀。
        editorView
            .onHover { hovering in
                if !hovering {
                    NSCursor.arrow.set()
                }
            }
            .onDisappear {
                NSCursor.arrow.set()
            }
        #else
        editorView
        #endif
    }

    @ViewBuilder
    private var editorView: some View {
        #if os(iOS)
        UIKitEditor(
            html: $html,
            placeholder: placeholder,
            colorScheme: colorScheme,
            labels: Self.labelsDict(),
            onActiveMarks: { marks in activeMarks?.wrappedValue = marks },
            onHeight: { _ in },
            commandBus: commandBus
        )
        #else
        AppKitEditor(
            html: $html,
            placeholder: placeholder,
            colorScheme: colorScheme,
            labels: Self.labelsDict(),
            onActiveMarks: { marks in activeMarks?.wrappedValue = marks },
            onHeight: { _ in },
            commandBus: commandBus
        )
        #endif
    }

    private static func labelsDict() -> [String: [String: String]] {
        let ids = ["text", "h1", "h2", "h3", "bullet", "ordered", "todo", "quote", "code", "divider"]
        var result: [String: [String: String]] = [:]
        for id in ids {
            result[id] = [
                "label": NSLocalizedString("editor.slash\(id.capitalized)Label", bundle: .module, comment: ""),
                "description": NSLocalizedString("editor.slash\(id.capitalized)Description", bundle: .module, comment: ""),
                "keywords": NSLocalizedString("editor.slash\(id.capitalized)Keywords", bundle: .module, comment: ""),
            ]
        }
        return result
    }
}

/// Commands come from the toolbar into the editor. Shared by reference
/// so the same bus can link RichTextEditor and EditorToolbar without
/// restructuring the parent view.
@MainActor
public final class EditorCommandBus {
    fileprivate var handler: ((EditorCommand) -> Void)?
    public init() {}

    public func send(_ command: EditorCommand) {
        handler?(command)
    }
}

#if os(iOS)
private struct UIKitEditor: UIViewRepresentable {
    @Binding var html: String
    let placeholder: String
    let colorScheme: ColorScheme
    let labels: [String: [String: String]]
    let onActiveMarks: (ActiveMarks) -> Void
    let onHeight: (CGFloat) -> Void
    let commandBus: EditorCommandBus?

    func makeCoordinator() -> EditorCoordinator {
        EditorCoordinator(
            htmlBinding: $html,
            placeholder: placeholder,
            labels: labels,
            onActiveMarks: onActiveMarks,
            onHeight: onHeight
        )
    }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.defaultWebpagePreferences.allowsContentJavaScript = true
        config.preferences.setValue(true, forKey: "allowFileAccessFromFileURLs")
        config.setValue(true, forKey: "allowUniversalAccessFromFileURLs")
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.isScrollEnabled = true
        webView.scrollView.delaysContentTouches = false
        webView.scrollView.bounces = true
        webView.scrollView.keyboardDismissMode = .interactive
        webView.inputAssistantItem.leadingBarButtonGroups = []
        webView.inputAssistantItem.trailingBarButtonGroups = []
        webView.isInspectable = true

        // Install our EditorToolbar as the WKContentView's inputAccessoryView
        // so it sits on top of the keyboard as part of the system input view.
        // This is how Notes / Bear / Heptabase do it: (a) button taps inside
        // an accessoryView don't resign first responder so editor keeps focus
        // and our format commands actually apply, and (b) iOS replaces its
        // default "^ v / Done" form-assistant bar with our accessoryView.
        if let bus = commandBus {
            let toolbarHost = EditorToolbarHost(commandBus: bus)
            context.coordinator.installInputAccessoryView(toolbarHost, on: webView)
        }

        context.coordinator.attach(webView: webView)
        context.coordinator.pushTheme(scheme: colorScheme)
        context.coordinator.loadBundle()
        commandBus?.handler = { [weak coord = context.coordinator] cmd in
            coord?.exec(cmd)
        }
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {
        context.coordinator.pushTheme(scheme: colorScheme)
        context.coordinator.applyIncomingHTMLIfNeeded()
    }
}
#endif

#if os(macOS)
private struct AppKitEditor: NSViewRepresentable {
    @Binding var html: String
    let placeholder: String
    let colorScheme: ColorScheme
    let labels: [String: [String: String]]
    let onActiveMarks: (ActiveMarks) -> Void
    let onHeight: (CGFloat) -> Void
    let commandBus: EditorCommandBus?

    func makeCoordinator() -> EditorCoordinator {
        EditorCoordinator(
            htmlBinding: $html,
            placeholder: placeholder,
            labels: labels,
            onActiveMarks: onActiveMarks,
            onHeight: onHeight
        )
    }

    func makeNSView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.defaultWebpagePreferences.allowsContentJavaScript = true
        config.preferences.setValue(true, forKey: "allowFileAccessFromFileURLs")
        config.setValue(true, forKey: "allowUniversalAccessFromFileURLs")
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.setValue(false, forKey: "drawsBackground")
        webView.isInspectable = true
        context.coordinator.attach(webView: webView)
        context.coordinator.pushTheme(scheme: colorScheme)
        context.coordinator.loadBundle()
        commandBus?.handler = { [weak coord = context.coordinator] cmd in
            coord?.exec(cmd)
        }
        return webView
    }

    func updateNSView(_ nsView: WKWebView, context: Context) {
        context.coordinator.pushTheme(scheme: colorScheme)
        context.coordinator.applyIncomingHTMLIfNeeded()
    }
}
#endif

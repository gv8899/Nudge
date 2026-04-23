import Foundation
import SwiftUI
import WebKit

/// 對應 JS bridge.ts 的 NativeMessage 型別（一致順序）。
enum EditorNativeMessage {
    case ready
    case change(html: String)
    case selection(ActiveMarks)
    case height(CGFloat)
    case focus(Bool)

    static func parse(_ body: Any) -> EditorNativeMessage? {
        guard let dict = body as? [String: Any],
              let kind = dict["kind"] as? String else { return nil }
        switch kind {
        case "ready":
            return .ready
        case "change":
            return .change(html: dict["html"] as? String ?? "")
        case "selection":
            if let active = dict["active"] as? [String: Any] {
                return .selection(ActiveMarks(payload: active))
            }
            return nil
        case "height":
            if let v = dict["value"] as? Double { return .height(CGFloat(v)) }
            return nil
        case "focus":
            if let f = dict["focused"] as? Bool { return .focus(f) }
            return nil
        default:
            return nil
        }
    }
}

public struct ActiveMarks: Equatable, Sendable {
    public var heading: Int? = nil
    public var bulletList = false
    public var orderedList = false
    public var taskList = false
    public var canUndo = false
    public var canRedo = false

    public init() {}

    init(payload: [String: Any]) {
        self.heading = payload["heading"] as? Int
        self.bulletList = payload["bulletList"] as? Bool ?? false
        self.orderedList = payload["orderedList"] as? Bool ?? false
        self.taskList = payload["taskList"] as? Bool ?? false
        self.canUndo = payload["canUndo"] as? Bool ?? false
        self.canRedo = payload["canRedo"] as? Bool ?? false
    }
}

/// 共用 coordinator：管 WKWebView message handling + load/change flow。
/// iOS 用 UIViewRepresentable、macOS 用 NSViewRepresentable，兩邊都呼叫這個。
@MainActor
final class EditorCoordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
    var htmlBinding: Binding<String>
    var onActiveMarks: (ActiveMarks) -> Void
    var onHeight: (CGFloat) -> Void
    var placeholder: String
    var labels: [String: [String: String]]

    private(set) weak var webView: WKWebView?
    private(set) var isReady = false
    private var pendingLoadHTML: String?
    var lastEmittedHTML: String = ""
    private var currentScheme: ColorScheme?

    init(
        htmlBinding: Binding<String>,
        placeholder: String,
        labels: [String: [String: String]],
        onActiveMarks: @escaping (ActiveMarks) -> Void,
        onHeight: @escaping (CGFloat) -> Void
    ) {
        self.htmlBinding = htmlBinding
        self.placeholder = placeholder
        self.labels = labels
        self.onActiveMarks = onActiveMarks
        self.onHeight = onHeight
    }

    func attach(webView: WKWebView) {
        self.webView = webView
        webView.configuration.userContentController.add(self, name: "editor")
        webView.navigationDelegate = self
    }

    /// 載入 editor.html bundle
    func loadBundle() {
        guard let webView else { return }
        guard let url = Bundle.module.url(
            forResource: "editor",
            withExtension: "html",
            subdirectory: "Editor"
        ) else {
            print("[EditorCoordinator] bundle missing editor.html")
            return
        }
        let base = url.deletingLastPathComponent()
        webView.loadFileURL(url, allowingReadAccessTo: base)
    }

    /// Binding → JS；避免把自己剛發出去的值 echo 回去
    func applyIncomingHTMLIfNeeded() {
        guard isReady, let webView else {
            pendingLoadHTML = htmlBinding.wrappedValue
            return
        }
        let target = htmlBinding.wrappedValue
        if target != lastEmittedHTML {
            let escaped = escapeForJS(target)
            webView.evaluateJavaScript("NudgeEditor.load(\(escaped))")
            lastEmittedHTML = target
        }
    }

    func pushTheme(scheme: ColorScheme) {
        guard isReady, let webView else { return }
        if currentScheme == scheme { return }
        currentScheme = scheme
        let tokens: [String: String] = [
            "background": Color.nudgeBackground.cssHex(for: scheme),
            "foreground": Color.nudgeForeground.cssHex(for: scheme),
            "primary": Color.nudgePrimary.cssHex(for: scheme),
            "textDim": Color.nudgeTextDim.cssHex(for: scheme),
            "border": Color.nudgeBorder.cssHex(for: scheme),
            "borderLight": Color.nudgeBorderLight.cssHex(for: scheme),
        ]
        guard let data = try? JSONSerialization.data(withJSONObject: tokens),
              let json = String(data: data, encoding: .utf8) else { return }
        webView.evaluateJavaScript("NudgeEditor.setTheme(\(json))")
    }

    func pushLabels() {
        guard isReady, let webView else { return }
        guard let data = try? JSONSerialization.data(withJSONObject: labels),
              let json = String(data: data, encoding: .utf8) else { return }
        webView.evaluateJavaScript("NudgeEditor.setLabels(\(json))")
    }

    func exec(_ command: EditorCommand) {
        guard isReady, let webView else { return }
        let js: String
        switch command {
        case .undo: js = "NudgeEditor.exec('undo')"
        case .redo: js = "NudgeEditor.exec('redo')"
        case .toggleHeading(let level):
            js = "NudgeEditor.exec('toggleHeading', {level: \(level)})"
        case .toggleBulletList: js = "NudgeEditor.exec('toggleBulletList')"
        case .toggleOrderedList: js = "NudgeEditor.exec('toggleOrderedList')"
        case .toggleTaskList: js = "NudgeEditor.exec('toggleTaskList')"
        case .blur: js = "NudgeEditor.exec('blur')"
        }
        webView.evaluateJavaScript(js)
    }

    // MARK: - WKScriptMessageHandler

    func userContentController(_ userContentController: WKUserContentController,
                               didReceive message: WKScriptMessage) {
        guard let event = EditorNativeMessage.parse(message.body) else { return }
        switch event {
        case .ready:
            isReady = true
            pushLabels()
            if let scheme = currentScheme {
                pushTheme(scheme: scheme)
            }
            let initial = pendingLoadHTML ?? htmlBinding.wrappedValue
            lastEmittedHTML = initial
            let escaped = escapeForJS(initial)
            webView?.evaluateJavaScript("NudgeEditor.load(\(escaped))")
            pendingLoadHTML = nil
        case .change(let html):
            lastEmittedHTML = html
            htmlBinding.wrappedValue = html
        case .selection(let active):
            onActiveMarks(active)
        case .height(let h):
            onHeight(h)
        case .focus:
            break
        }
    }

    // MARK: - Private

    private func escapeForJS(_ s: String) -> String {
        guard let data = try? JSONSerialization.data(
            withJSONObject: [s], options: [.fragmentsAllowed]
        ) else { return "\"\"" }
        guard let str = String(data: data, encoding: .utf8) else { return "\"\"" }
        return str.trimmingCharacters(in: CharacterSet(charactersIn: "[]"))
    }
}

public enum EditorCommand: Equatable {
    case undo, redo
    case toggleHeading(level: Int)
    case toggleBulletList
    case toggleOrderedList
    case toggleTaskList
    case blur
}

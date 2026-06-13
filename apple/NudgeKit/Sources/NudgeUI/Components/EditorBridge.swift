import Foundation
import SwiftUI
import WebKit

#if os(iOS)
import UIKit
#elseif os(macOS)
import AppKit
#endif

/// 對應 JS bridge.ts 的 NativeMessage 型別（一致順序）。
enum EditorNativeMessage {
    case ready
    case change(html: String)
    case selection(ActiveMarks)
    case height(CGFloat)
    case focus(Bool)
    case openURL(url: String)

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
        case "openURL":
            if let url = dict["url"] as? String { return .openURL(url: url) }
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
    private var lastSentScheme: ColorScheme?
    #if os(iOS)
    private var accessoryHost: EditorToolbarHost?
    #endif

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
        let ucc = webView.configuration.userContentController
        ucc.add(self, name: "editor")
        ucc.add(self, name: "editorConsole")
        // Platform flag — JS-side gates platform-specific behaviour
        // (e.g. mac enables slash menu; iOS skips it because of WKWebView
        // input swallow bug). 必須 atDocumentStart 設、editor.js 取用前。
        #if os(macOS)
        let platform = "macos"
        #else
        let platform = "ios"
        #endif
        // Forward console.* to Swift so we can see runtime errors that happen
        // before our own error handler attaches.
        let js = """
        window.NUDGE_PLATFORM = '\(platform)';
        (function() {
            function forward(level, args) {
                try {
                    var msg = Array.prototype.slice.call(args).map(function(a) {
                        if (a instanceof Error) return a.stack || a.message;
                        try { return typeof a === 'string' ? a : JSON.stringify(a); }
                        catch (e) { return String(a); }
                    }).join(' ');
                    window.webkit.messageHandlers.editorConsole.postMessage({level: level, msg: msg});
                } catch (e) { /* swallow */ }
            }
            ['log','info','warn','error','debug'].forEach(function(level) {
                var orig = console[level];
                console[level] = function() { forward(level, arguments); orig.apply(console, arguments); };
            });
            window.addEventListener('error', function(ev) {
                forward('error', ['window.error:', ev.message, 'at', ev.filename+':'+ev.lineno, ev.error && ev.error.stack]);
            });
            window.addEventListener('unhandledrejection', function(ev) {
                forward('error', ['unhandledrejection:', ev.reason && ev.reason.stack || ev.reason]);
            });
        })();
        """
        let script = WKUserScript(source: js, injectionTime: .atDocumentStart, forMainFrameOnly: true)
        ucc.addUserScript(script)
        webView.navigationDelegate = self
    }

    #if os(iOS)
    func installInputAccessoryView(_ host: EditorToolbarHost, on webView: WKWebView) {
        self.accessoryHost = host
    }

    private func tryInstallAccessory() {
        guard let webView, let host = accessoryHost else { return }
        webView.nudgeInstallInputAccessoryView(host)
    }
    #endif

    // MARK: - WKNavigationDelegate

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        print("[EditorCoordinator] didFinish navigation")
        #if os(iOS)
        // WKContentView only exists after a navigation completes — install
        // the inputAccessoryView now so the runtime subclass swap has a real
        // target. Retry in a couple of run-loop ticks just in case.
        tryInstallAccessory()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) { [weak self] in
            self?.tryInstallAccessory()
        }
        #endif
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        print("[EditorCoordinator] didFail: \(error)")
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        print("[EditorCoordinator] didFailProvisionalNavigation: \(error)")
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
        print("[EditorCoordinator] loading bundle from \(url.path)")
        webView.loadFileURL(url, allowingReadAccessTo: base)
    }

    /// Called from updateUIView on every SwiftUI re-render.
    ///
    /// Matches the web fix from commit cfdcda2 ("編輯器 cursor 跳掉"):
    /// once the editor is ready, the editor is the single source of truth
    /// for its HTML content. Do NOT push htmlBinding → editor after that
    /// point. Reason: every typed character triggers postToNative →
    /// htmlBinding update → SwiftUI re-render → updateUIView → this method
    /// firing. If we call NudgeEditor.load(html) here — even with a
    /// "same value" guard — any whitespace / attribute-order difference
    /// from server revalidation causes a setContent(), which RESETS the
    /// ProseMirror selection to doc-end. Next keystroke then inserts at
    /// the bottom of the document and the caret appears to "jump" down.
    ///
    /// To switch to a different card's content, the parent should give
    /// the RichTextEditor a new .id(card.id) to force a fresh instance —
    /// the same pattern web uses with `<TiptapEditor key={task.id} />`.
    func applyIncomingHTMLIfNeeded() {
        guard isReady else {
            pendingLoadHTML = htmlBinding.wrappedValue
            return
        }
        // After ready: editor owns the content. No-op.
    }

    func pushTheme(scheme: ColorScheme) {
        // Always remember the desired scheme, even when the editor isn't
        // ready yet. Otherwise the initial pushTheme() call (from makeUIView)
        // returns early, currentScheme stays nil, and the .ready handler has
        // nothing to replay — the editor runs forever with the default light
        // CSS vars, so dark-mode text renders #1a1a1a on a black background
        // and looks invisible.
        currentScheme = scheme
        guard isReady, let webView else { return }
        if lastSentScheme == scheme { return }
        lastSentScheme = scheme
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

    /// Push the SwiftUI-supplied placeholder string into the JS bundle so
    /// TipTap's Placeholder extension can render `data-placeholder`.
    /// Called after `.ready` because the editor doesn't exist before then.
    func pushPlaceholder() {
        guard isReady, let webView else { return }
        guard let data = try? JSONSerialization.data(
            withJSONObject: [placeholder], options: [.fragmentsAllowed]
        ),
              let json = String(data: data, encoding: .utf8) else { return }
        let arg = json.trimmingCharacters(in: CharacterSet(charactersIn: "[]"))
        webView.evaluateJavaScript("NudgeEditor.setPlaceholder(\(arg))")
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

    /// 直接向編輯器（WebContent 程序）取當前 HTML —— 用於離開前 flush 存檔，
    /// 不依賴可能還沒送達的跨程序 change 訊息。
    func flushContent(_ completion: @escaping (String) -> Void) {
        guard let webView else { return }
        webView.evaluateJavaScript("NudgeEditor.getHTML()") { [weak self] result, _ in
            let html = (result as? String) ?? (self?.htmlBinding.wrappedValue ?? "")
            self?.htmlBinding.wrappedValue = html
            completion(html)
        }
    }

    // MARK: - WKScriptMessageHandler

    func userContentController(_ userContentController: WKUserContentController,
                               didReceive message: WKScriptMessage) {
        if message.name == "editorConsole" {
            if let dict = message.body as? [String: Any],
               let level = dict["level"] as? String,
               let msg = dict["msg"] as? String {
                print("[editor.\(level)] \(msg)")
            }
            return
        }
        guard let event = EditorNativeMessage.parse(message.body) else {
            print("[EditorCoordinator] unparsable message: \(message.body)")
            return
        }
        switch event {
        case .ready:
            print("[EditorCoordinator] ready")
            isReady = true
            pushLabels()
            if let scheme = currentScheme {
                pushTheme(scheme: scheme)
            }
            let initial = pendingLoadHTML ?? htmlBinding.wrappedValue
            print("[EditorCoordinator] loading initial HTML (\(initial.count) chars)")
            lastEmittedHTML = initial
            let escaped = escapeForJS(initial)
            // pushPlaceholder() AFTER load() so the placeholder decoration
            // applies on the post-setContent state — not the pre-load state
            // that load() then replaces.
            webView?.evaluateJavaScript("NudgeEditor.load(\(escaped))") { [weak self] _, err in
                if let err { print("[EditorCoordinator] load() eval error: \(err)") }
                self?.pushPlaceholder()
                // 內容載入後捲到最上面 —— 打開卡片 modal / 全頁時內文不要停在
                // 中間（modal 重開、切換卡片都會重設）。
                self?.webView?.evaluateJavaScript(
                    "try{(document.scrollingElement||document.documentElement).scrollTop=0;window.scrollTo(0,0);}catch(e){}",
                    completionHandler: nil
                )
            }
            pendingLoadHTML = nil
        case .change(let html):
            lastEmittedHTML = html
            htmlBinding.wrappedValue = html
        case .selection(let active):
            onActiveMarks(active)
            #if os(iOS)
            accessoryHost?.state.activeMarks = active
            #endif
        case .height(let h):
            print("[EditorCoordinator] height \(h)")
            onHeight(h)
        case .focus:
            break
        case .openURL(let urlString):
            guard let url = URL(string: urlString) else { break }
            #if os(iOS)
            UIApplication.shared.open(url)
            #elseif os(macOS)
            NSWorkspace.shared.open(url)
            #endif
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

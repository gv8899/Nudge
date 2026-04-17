import SwiftUI

#if os(iOS)
import UIKit
#else
import AppKit
#endif

/// Rich-text editor that roundtrips HTML through `NSAttributedString`.
/// Mirrors Web's TipTap editor contract: caller owns the HTML string,
/// editor reports back updated HTML on each edit. Serialization goes
/// through `NSAttributedString`'s built-in `.html` doc type, which
/// produces verbose markup with inline CSS — not byte-identical to
/// TipTap's `<p><strong>…</strong></p>` output, but the server just
/// stores the string so roundtrip correctness is the only hard
/// requirement.
public struct RichTextEditor: View {
    @Binding var html: String
    let placeholder: String

    public init(html: Binding<String>, placeholder: String = "") {
        _html = html
        self.placeholder = placeholder
    }

    public var body: some View {
        #if os(iOS)
        UIKitRichTextEditor(html: $html, placeholder: placeholder)
        #else
        AppKitRichTextEditor(html: $html, placeholder: placeholder)
        #endif
    }
}

// MARK: - HTML ↔ AttributedString

enum HTMLAttributed {
    /// Parse HTML into an attributed string. Runs on the main thread
    /// (the initializer uses WebKit internally and requires it).
    @MainActor
    static func attributed(from html: String) -> NSAttributedString {
        guard let data = html.data(using: .utf8) else {
            return NSAttributedString(string: "")
        }
        let options: [NSAttributedString.DocumentReadingOptionKey: Any] = [
            .documentType: NSAttributedString.DocumentType.html,
            .characterEncoding: String.Encoding.utf8.rawValue,
        ]
        if let attr = try? NSAttributedString(data: data, options: options, documentAttributes: nil) {
            return attr
        }
        return NSAttributedString(string: "")
    }

    /// Serialize back to HTML. Output is the verbose NSAttributedString
    /// HTML dump (full doctype, inline styles). Empty / whitespace-only
    /// content returns `""` so save-with-no-edit matches Web behavior.
    static func html(from attributed: NSAttributedString) -> String {
        let plain = attributed.string.trimmingCharacters(in: .whitespacesAndNewlines)
        if plain.isEmpty { return "" }
        let range = NSRange(location: 0, length: attributed.length)
        let options: [NSAttributedString.DocumentAttributeKey: Any] = [
            .documentType: NSAttributedString.DocumentType.html,
            .characterEncoding: String.Encoding.utf8.rawValue,
        ]
        if let data = try? attributed.data(from: range, documentAttributes: options),
           let html = String(data: data, encoding: .utf8) {
            return html
        }
        return ""
    }
}

// MARK: - iOS

#if os(iOS)
struct UIKitRichTextEditor: UIViewRepresentable {
    @Binding var html: String
    let placeholder: String

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIView(context: Context) -> UITextView {
        let tv = UITextView()
        tv.delegate = context.coordinator
        tv.isEditable = true
        tv.isScrollEnabled = false
        tv.backgroundColor = .clear
        tv.textContainerInset = .zero
        tv.textContainer.lineFragmentPadding = 0
        tv.allowsEditingTextAttributes = true
        tv.font = UIFont.preferredFont(forTextStyle: .body)
        tv.textColor = UIColor(Color.nudgeForeground) // nudge:allow-color
        tv.tintColor = UIColor(Color.nudgePrimary) // nudge:allow-color
        context.coordinator.applyIncoming(html: html, to: tv)
        return tv
    }

    func updateUIView(_ uiView: UITextView, context: Context) {
        // Only reapply if the incoming HTML came from outside (not our own edit).
        if context.coordinator.lastEmittedHTML != html {
            context.coordinator.applyIncoming(html: html, to: uiView)
        }
        context.coordinator.updatePlaceholder(on: uiView, placeholder: placeholder)
    }

    final class Coordinator: NSObject, UITextViewDelegate {
        var parent: UIKitRichTextEditor
        var lastEmittedHTML: String = ""
        private var placeholderLabel: UILabel?

        init(_ parent: UIKitRichTextEditor) { self.parent = parent }

        @MainActor
        func applyIncoming(html: String, to textView: UITextView) {
            let attr = HTMLAttributed.attributed(from: html)
            let mutable = NSMutableAttributedString(attributedString: attr)
            // Normalize foreground + base font so HTML import's inline CSS
            // doesn't lock us into system colors that ignore theme tokens.
            let full = NSRange(location: 0, length: mutable.length)
            mutable.addAttribute(.foregroundColor, value: UIColor(Color.nudgeForeground), range: full) // nudge:allow-color
            textView.attributedText = mutable
            lastEmittedHTML = html
        }

        func updatePlaceholder(on textView: UITextView, placeholder: String) {
            if placeholderLabel == nil {
                let label = UILabel()
                label.font = UIFont.preferredFont(forTextStyle: .body)
                label.textColor = UIColor(Color.nudgeTextDim) // nudge:allow-color
                label.numberOfLines = 0
                label.translatesAutoresizingMaskIntoConstraints = false
                textView.addSubview(label)
                NSLayoutConstraint.activate([
                    label.topAnchor.constraint(equalTo: textView.topAnchor),
                    label.leadingAnchor.constraint(equalTo: textView.leadingAnchor),
                    label.trailingAnchor.constraint(equalTo: textView.trailingAnchor),
                ])
                placeholderLabel = label
            }
            placeholderLabel?.text = placeholder
            placeholderLabel?.isHidden = !textView.text.isEmpty
        }

        func textViewDidChange(_ textView: UITextView) {
            placeholderLabel?.isHidden = !textView.text.isEmpty
            let newHTML = HTMLAttributed.html(from: textView.attributedText)
            lastEmittedHTML = newHTML
            parent.html = newHTML
        }
    }
}
#endif

// MARK: - macOS

#if os(macOS)
struct AppKitRichTextEditor: NSViewRepresentable {
    @Binding var html: String
    let placeholder: String

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeNSView(context: Context) -> NSScrollView {
        let scroll = NSTextView.scrollableTextView()
        guard let tv = scroll.documentView as? NSTextView else { return scroll }
        tv.delegate = context.coordinator
        tv.isEditable = true
        tv.isRichText = true
        tv.allowsUndo = true
        tv.drawsBackground = false
        tv.textContainerInset = .zero
        tv.font = NSFont.preferredFont(forTextStyle: .body, options: [:])
        tv.textColor = NSColor(Color.nudgeForeground) // nudge:allow-color
        tv.insertionPointColor = NSColor(Color.nudgePrimary) // nudge:allow-color
        scroll.drawsBackground = false
        scroll.hasVerticalScroller = false
        context.coordinator.applyIncoming(html: html, to: tv)
        return scroll
    }

    func updateNSView(_ nsView: NSScrollView, context: Context) {
        guard let tv = nsView.documentView as? NSTextView else { return }
        if context.coordinator.lastEmittedHTML != html {
            context.coordinator.applyIncoming(html: html, to: tv)
        }
    }

    final class Coordinator: NSObject, NSTextViewDelegate {
        var parent: AppKitRichTextEditor
        var lastEmittedHTML: String = ""

        init(_ parent: AppKitRichTextEditor) { self.parent = parent }

        @MainActor
        func applyIncoming(html: String, to textView: NSTextView) {
            let attr = HTMLAttributed.attributed(from: html)
            let mutable = NSMutableAttributedString(attributedString: attr)
            let full = NSRange(location: 0, length: mutable.length)
            mutable.addAttribute(.foregroundColor, value: NSColor(Color.nudgeForeground), range: full) // nudge:allow-color
            textView.textStorage?.setAttributedString(mutable)
            lastEmittedHTML = html
        }

        func textDidChange(_ notification: Notification) {
            guard let tv = notification.object as? NSTextView,
                  let storage = tv.textStorage else { return }
            let newHTML = HTMLAttributed.html(from: storage)
            lastEmittedHTML = newHTML
            parent.html = newHTML
        }
    }
}
#endif

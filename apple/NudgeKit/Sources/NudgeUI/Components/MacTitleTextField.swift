#if os(macOS)
import SwiftUI
import AppKit

/// macOS 卡片標題輸入框 —— 刻意走 AppKit `NSTextField` 而非 SwiftUI `TextField`：
///
/// 1. **caret / 選取 / IME marked-text 底線吃主色**。macOS 的插入點顏色由
///    field editor 的 `insertionPointColor` 決定，**不吃 SwiftUI `.tint`**
///    （`CardDetailView` 早有 `.tint(.nudgePrimary)` 仍是系統藍即證）。
/// 2. **出現時自動聚焦、且游標置尾「不全選」**。SwiftUI `.focused` 聚焦會把整段
///    標題選起來（使用者不要全選）；這裡 `makeFirstResponder` 後把 selectedRange
///    收成尾端 0 長度 = 純游標。
///
/// 僅標題單行用途；內文 caret 由 `RichTextEditor` 的網頁 CSS `caret-color` 控制，
/// 是另一套機制、不在這裡處理。
struct MacTitleTextField: NSViewRepresentable {
    @Binding var text: String
    var placeholder: String
    var fontSize: CGFloat = 26
    var fontWeight: NSFont.Weight = .bold
    /// 只在 modal / popover 情境設 true —— 全頁瀏覽別強搶焦點。
    var autoFocus: Bool = false
    var onSubmit: () -> Void = {}

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeNSView(context: Context) -> NSTextField {
        let field = NSTextField()
        field.isBordered = false
        field.drawsBackground = false
        field.focusRingType = .none
        field.font = .systemFont(ofSize: fontSize, weight: fontWeight)
        field.textColor = NSColor(Color.nudgeForeground)
        field.placeholderString = placeholder
        field.lineBreakMode = .byTruncatingTail
        field.usesSingleLineMode = true
        field.cell?.wraps = false
        field.cell?.isScrollable = true
        field.delegate = context.coordinator
        field.stringValue = text
        // 水平方向低 hugging → 在 HStack 內撐滿可用寬度（對齊原 SwiftUI TextField）。
        field.setContentHuggingPriority(.defaultLow, for: .horizontal)
        field.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        return field
    }

    func updateNSView(_ field: NSTextField, context: Context) {
        // 只有在值真的不同才回寫，避免打字時游標被重置。
        if field.stringValue != text {
            field.stringValue = text
        }
        field.placeholderString = placeholder
        Self.styleEditor(field.currentEditor() as? NSTextView)

        guard autoFocus, !context.coordinator.didAutoFocus else { return }
        context.coordinator.didAutoFocus = true
        // 等進 window 後再聚焦；游標收到尾端（不全選）。
        DispatchQueue.main.async {
            guard let window = field.window else { return }
            window.makeFirstResponder(field)
            if let editor = field.currentEditor() {
                let end = (field.stringValue as NSString).length
                editor.selectedRange = NSRange(location: end, length: 0)
            }
            Self.styleEditor(field.currentEditor() as? NSTextView)
        }
    }

    /// caret 主色。field editor（共用 NSTextView）聚焦 / 每次編輯可能重建，所以
    /// 每個時機都重設一次。
    ///
    /// 註：中文 IME「組字中」的底線色**無法可靠控制** —— NSTextField 的共用
    /// field editor 由系統內部管理 marked text 屬性，外部設 `markedTextAttributes`
    /// 會被忽略/重置，那條底線沿用系統 accent（藍）。已查證無乾淨解，接受它。
    static func styleEditor(_ editor: NSTextView?) {
        editor?.insertionPointColor = NSColor(Color.nudgePrimary)
    }

    final class Coordinator: NSObject, NSTextFieldDelegate {
        let parent: MacTitleTextField
        var didAutoFocus = false

        init(_ parent: MacTitleTextField) { self.parent = parent }

        func controlTextDidBeginEditing(_ obj: Notification) {
            MacTitleTextField.styleEditor(obj.userInfo?["NSFieldEditor"] as? NSTextView)
        }

        func controlTextDidChange(_ obj: Notification) {
            guard let field = obj.object as? NSTextField else { return }
            parent.text = field.stringValue
            MacTitleTextField.styleEditor(field.currentEditor() as? NSTextView)
        }

        func control(
            _ control: NSControl,
            textView: NSTextView,
            doCommandBy commandSelector: Selector
        ) -> Bool {
            if commandSelector == #selector(NSResponder.insertNewline(_:)) {
                parent.onSubmit()
                return true
            }
            return false
        }
    }
}
#endif

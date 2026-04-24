#if os(iOS)
import SwiftUI
import UIKit

/// Hidden UITextField used to pre-raise the software keyboard before a
/// sheet with an auto-focused TextField is presented. Eliminates the
/// "sheet rises → keyboard rises → sheet bumps up again" staircase,
/// which SwiftUI `.onAppear`-based focus can't avoid because the focus
/// state change fires one runloop too late for iOS to merge the two
/// animations.
///
/// Usage pattern:
///
/// ```swift
/// @State private var preload = false
/// @State private var showSheet = false
///
/// Button("Add") {
///     preload = true                              // raise keyboard now
///     DispatchQueue.main.async { showSheet = true }   // sheet animates up
/// }
///
/// KeyboardPreloader(isActive: $preload)
///     .frame(width: 0, height: 0)
/// ```
///
/// Inside the sheet, set your TextField's `@FocusState` to `true` on
/// `.task` — when focus transfers, the hidden field silently gives up
/// first responder and there's no visible keyboard dismiss/re-present.
struct KeyboardPreloader: UIViewRepresentable {
    @Binding var isActive: Bool

    func makeUIView(context: Context) -> UITextField {
        let tf = UITextField()
        tf.autocorrectionType = .no
        tf.spellCheckingType = .no
        // Strip the Quick Type / predictive bar so users don't see the
        // hidden field's suggestions flash while focus transfers.
        tf.inputAssistantItem.leadingBarButtonGroups = []
        tf.inputAssistantItem.trailingBarButtonGroups = []
        // Zero-size + clearColor makes the field invisible but still
        // able to host a first-responder session.
        tf.backgroundColor = .clear
        tf.tintColor = .clear
        return tf
    }

    func updateUIView(_ uiView: UITextField, context: Context) {
        if isActive && !uiView.isFirstResponder {
            uiView.becomeFirstResponder()
        } else if !isActive && uiView.isFirstResponder {
            uiView.resignFirstResponder()
        }
    }
}
#endif

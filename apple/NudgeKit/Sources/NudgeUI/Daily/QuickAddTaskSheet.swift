import SwiftUI

/// Quick-add modal for new tasks。極簡：TextField + 「按 Enter 新增」 hint，
/// 無顯式按鈕。⏎ submit、⎋ cancel。
///
/// 設計取捨：
/// - **無按鈕**：操作面只剩鍵盤，UI 收到最乾淨。Enter 是 universal submit、
///   ⎋ 是 universal cancel；user 看到 input 後直覺就會打字 ⏎ / 按 ⎋
/// - **Hint 「按 Enter 新增任務」只在 user 輸入後出現**：空字串時 input 看
///   起來像 placeholder 等使用者，輸入後 hint 浮出告訴 user「現在可以送出」。
///   fade 過渡，layout 高度永遠保留 hint 那一行避免 jump
/// - **`.textFieldStyle(.plain)`**：拿掉 NSTextField bordered look + 系統藍
///   focus ring，自己畫 nudgePrimary 1.5pt stroke
struct QuickAddTaskSheet: View {
    @Binding var text: String
    let onSubmit: () -> Void
    let onCancel: () -> Void
    @FocusState private var fieldFocused: Bool

    /// Modal exact-fit height — 14 (top) + ~41 (textfield) + 8 (spacing)
    /// + ~16 (hint row) + 14 (bottom) ≈ 93pt，留 7pt margin = 100pt。
    static let fittedHeight: CGFloat = 100

    private var hasText: Bool {
        !text.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var body: some View {
        VStack(spacing: 8) {
            inputField
            hintRow
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 14)
        .overlay(
            // 隱形按鈕承載 ⎋ / ⏎ — SwiftUI keyboardShortcut 必須掛在 Button。
            HStack(spacing: 0) {
                Button("", action: onCancel)
                    .keyboardShortcut(.cancelAction)
                Button("", action: onSubmit)
                    .keyboardShortcut(.defaultAction)
            }
            .opacity(0)
            .frame(width: 0, height: 0)
            .accessibilityHidden(true)
        )
        .task { fieldFocused = true }
    }

    private var inputField: some View {
        TextField(
            "",
            text: $text,
            prompt: Text("task.createPlaceholder", bundle: .module)
        )
        .textFieldStyle(.plain)
        .focused($fieldFocused)
        .submitLabel(.done)
        .onSubmit { onSubmit() }
        .font(.body)
        .foregroundStyle(Color.nudgeForeground)
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Color.nudgeForeground.opacity(0.06))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .strokeBorder(
                    fieldFocused ? Color.nudgePrimary : Color.clear,
                    lineWidth: 1.5
                )
        )
        .animation(.easeOut(duration: 0.15), value: fieldFocused)
    }

    private var hintRow: some View {
        Text("task.pressEnterToAdd", bundle: .module)
            .font(.caption)
            .foregroundStyle(Color.nudgeTextDim)
            .frame(maxWidth: .infinity, alignment: .center)
            .frame(height: 16) // 固定高度避免 layout jump
            .opacity(hasText ? 1 : 0)
            .animation(.easeOut(duration: 0.18), value: hasText)
    }
}

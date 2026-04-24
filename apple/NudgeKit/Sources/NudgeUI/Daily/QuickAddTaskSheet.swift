import SwiftUI

/// Bottom-sheet quick-add for new tasks. Auto-focuses the field; Enter
/// submits and dismisses.
///
/// Sized to fit its content exactly: cancel/save row + input field, no
/// trailing filler. Paired with `KeyboardPreloader` at the call site
/// which raises the keyboard BEFORE this sheet is presented — so the
/// sheet can animate up in one motion to its final position above the
/// already-raised keyboard, rather than landing at the detent height
/// and then being bumped higher.
struct QuickAddTaskSheet: View {
    @Binding var text: String
    let onSubmit: () -> Void
    let onCancel: () -> Void
    @FocusState private var fieldFocused: Bool

    /// Exact fitted height: 12 (bar top) + 24 (bar row) + 12 (spacing)
    /// + 44 (field w/ 12/12 padding) + 12 (bottom) = 104pt.
    static let fittedHeight: CGFloat = 104

    var body: some View {
        VStack(spacing: 12) {
            HStack {
                Button(action: onCancel) {
                    Text("common.cancel", bundle: .module)
                        .foregroundStyle(Color.nudgeTextDim)
                }
                Spacer()
                Button {
                    onSubmit()
                } label: {
                    Text("common.save", bundle: .module)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(
                            text.trimmingCharacters(in: .whitespaces).isEmpty
                                ? Color.nudgeTextDim
                                : Color.nudgePrimary
                        )
                }
                .disabled(text.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            .padding(.horizontal, 20)
            .padding(.top, 12)

            TextField(
                "",
                text: $text,
                prompt: Text("task.createPlaceholder", bundle: .module)
            )
            .focused($fieldFocused)
            .submitLabel(.done)
            .onSubmit { onSubmit() }
            .font(.body)
            .foregroundStyle(Color.nudgeForeground)
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(.ultraThinMaterial)
            )
            .padding(.horizontal, 20)
            .padding(.bottom, 12)
        }
        .background(Color.nudgeBackground)
        // Move focus from the hidden KeyboardPreloader TextField in
        // the parent to this visible one. Firing on `.task` (same
        // frame the view appears) keeps the keyboard continuously
        // raised — no dismiss/re-present flash between transfer.
        .task {
            fieldFocused = true
        }
    }
}

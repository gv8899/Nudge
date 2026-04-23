import SwiftUI

/// Bottom-sheet quick-add for new tasks. Auto-focuses the field; Enter
/// submits and dismisses. Compact 160pt detent keeps the sheet above the
/// keyboard without taking the whole screen.
struct QuickAddTaskSheet: View {
    @Binding var text: String
    let onSubmit: () -> Void
    let onCancel: () -> Void
    @FocusState private var fieldFocused: Bool

    var body: some View {
        VStack(spacing: 16) {
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
            .padding(.top, 16)

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
                RoundedRectangle(cornerRadius: 10)
                    .fill(Color.nudgeBorderLight.opacity(0.3))
            )
            .padding(.horizontal, 20)

            Spacer(minLength: 0)
        }
        .background(Color.nudgeBackground)
        .onAppear {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
                fieldFocused = true
            }
        }
    }
}

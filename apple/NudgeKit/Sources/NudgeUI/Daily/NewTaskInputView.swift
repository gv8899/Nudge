import SwiftUI
import NudgeCore

public struct NewTaskInputView: View {
    @State private var text: String = ""
    @FocusState private var isFocused: Bool
    public let onSubmit: (String) -> Void

    public init(onSubmit: @escaping (String) -> Void) {
        self.onSubmit = onSubmit
    }

    public var body: some View {
        VStack(spacing: 6) {
            TextField(text: $text) {
                Text("task.createPlaceholder", bundle: .module)
            }
            .focused($isFocused)
            .textFieldStyle(.plain)
            .foregroundStyle(Color.nudgeForeground)
            .onSubmit(submit)

            Rectangle()
                .fill(Color.nudgeBorder)
                .frame(height: 1)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
    }

    private func submit() {
        let trimmed = text.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return }
        onSubmit(trimmed)
        text = ""
    }
}

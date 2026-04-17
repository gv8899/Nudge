import SwiftUI
import NudgeCore

public struct NewTaskInputView: View {
    @State private var text: String = ""
    @FocusState private var isFocused: Bool
    public let onSubmit: (String) -> Void
    public let focusTrigger: () -> Bool?

    public init(onSubmit: @escaping (String) -> Void, focusTrigger: @escaping () -> Bool? = { nil }) {
        self.onSubmit = onSubmit
        self.focusTrigger = focusTrigger
    }

    public var body: some View {
        VStack(spacing: 6) {
            TextField(text: $text) {
                Text("task.createPlaceholder", bundle: .module)
            }
            .focused($isFocused)
            .textFieldStyle(.plain)
            .foregroundStyle(Color.nudgeForeground)
            .onSubmit {
                let trimmed = text.trimmingCharacters(in: .whitespaces)
                guard !trimmed.isEmpty else { return }
                onSubmit(trimmed)
                text = ""
            }

            Rectangle()
                .fill(Color.nudgeBorder)
                .frame(height: 1)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(Color.nudgeBackground)
    }
}

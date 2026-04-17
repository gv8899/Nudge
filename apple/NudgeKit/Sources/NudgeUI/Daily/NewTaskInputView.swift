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
        HStack {
            TextField(text: $text) {
                Text("task.createPlaceholder", bundle: .module)
            }
            .focused($isFocused)
            .textFieldStyle(.plain)
            .onSubmit {
                let trimmed = text.trimmingCharacters(in: .whitespaces)
                guard !trimmed.isEmpty else { return }
                onSubmit(trimmed)
                text = ""
            }
            .padding(12)
            .background(Color.nudgeBackground)
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(Color.nudgeBorder, lineWidth: 1)
            )
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
        }
        .background(Color.nudgeBackground)
    }
}

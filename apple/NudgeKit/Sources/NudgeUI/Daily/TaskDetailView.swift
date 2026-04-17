import SwiftUI
import NudgeCore

public struct TaskDetailView: View {
    public let assignment: DailyAssignmentDTO
    public let onUpdateTitle: (String) -> Void
    public let onUpdateDescription: (String) -> Void

    @State private var title: String
    @State private var description: String

    public init(
        assignment: DailyAssignmentDTO,
        onUpdateTitle: @escaping (String) -> Void,
        onUpdateDescription: @escaping (String) -> Void
    ) {
        self.assignment = assignment
        self.onUpdateTitle = onUpdateTitle
        self.onUpdateDescription = onUpdateDescription
        _title = State(initialValue: assignment.task.title)
        _description = State(initialValue: assignment.task.description)
    }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                TextField(text: $title) {
                    Text("task.createPlaceholder", bundle: .module)
                }
                .font(.title2.weight(.semibold))
                .textFieldStyle(.plain)
                .onSubmit { onUpdateTitle(title) }

                Divider()
                    .background(Color.nudgeBorderLight)

                TextEditor(text: $description)
                    .font(.body)
                    .scrollContentBackground(.hidden)
                    .frame(minHeight: 200)
                    .onChange(of: description) { _, newValue in
                        onUpdateDescription(newValue)
                    }
            }
            .padding()
        }
        .background(Color.nudgeBackground)
    }
}

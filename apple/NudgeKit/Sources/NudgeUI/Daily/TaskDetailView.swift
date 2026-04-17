import SwiftUI
import NudgeCore

public struct TaskDetailView: View {
    public let assignment: DailyAssignmentDTO
    public let tags: [TagDTO]
    public let onUpdateTitle: (String) -> Void
    public let onUpdateDescription: (String) -> Void
    public let onScheduleToday: () -> Void
    public let onMoveTo: () -> Void
    public let onArchive: () -> Void

    @State private var title: String
    @State private var description: String

    public init(
        assignment: DailyAssignmentDTO,
        tags: [TagDTO],
        onUpdateTitle: @escaping (String) -> Void,
        onUpdateDescription: @escaping (String) -> Void,
        onScheduleToday: @escaping () -> Void,
        onMoveTo: @escaping () -> Void,
        onArchive: @escaping () -> Void
    ) {
        self.assignment = assignment
        self.tags = tags
        self.onUpdateTitle = onUpdateTitle
        self.onUpdateDescription = onUpdateDescription
        self.onScheduleToday = onScheduleToday
        self.onMoveTo = onMoveTo
        self.onArchive = onArchive
        _title = State(initialValue: assignment.task.title)
        _description = State(initialValue: assignment.task.description)
    }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                TextField("", text: $title)
                    .font(.title2.weight(.semibold))
                    .onSubmit { onUpdateTitle(title) }

                TextEditor(text: $description)
                    .frame(minHeight: 120)
                    .padding(8)
                    .background(Color.nudgeBackground)
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(Color.nudgeBorder, lineWidth: 1)
                    )
                    .onChange(of: description) { _, newValue in
                        onUpdateDescription(newValue)
                    }

                if !tags.isEmpty {
                    HStack {
                        ForEach(tags, id: \.id) { tag in
                            Text(tag.name)
                                .font(.caption)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(Color(hex: tag.color) ?? Color.nudgePrimary)
                                .cornerRadius(6)
                        }
                    }
                }

                Button(action: onScheduleToday) {
                    HStack {
                        Image(systemName: "sun.max")
                        Text("daily.overdueScheduleToday", bundle: .module)
                    }
                }
                .buttonStyle(.bordered)

                Button(action: onMoveTo) {
                    HStack {
                        Image(systemName: "calendar")
                        Text("task.moveToOtherDate", bundle: .module)
                    }
                }
                .buttonStyle(.bordered)

                Button(role: .destructive, action: onArchive) {
                    HStack {
                        Image(systemName: "archivebox")
                        Text("daily.archiveButton", bundle: .module)
                    }
                }
                .buttonStyle(.borderedProminent)
            }
            .padding()
        }
        .background(Color.nudgeBackground)
    }
}

private extension Color {
    init?(hex: String) {
        let hex = hex.replacingOccurrences(of: "#", with: "")
        guard hex.count == 6,
              let value = UInt32(hex, radix: 16) else { return nil }
        let r = Double((value >> 16) & 0xff) / 255.0
        let g = Double((value >> 8) & 0xff) / 255.0
        let b = Double(value & 0xff) / 255.0
        self.init(red: r, green: g, blue: b)
    }
}

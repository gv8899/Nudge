import SwiftUI
import NudgeCore

public struct TaskListView: View {
    public let assignments: [DailyAssignmentDTO]
    public let onToggleComplete: (DailyAssignmentDTO) -> Void
    public let onTap: (DailyAssignmentDTO) -> Void
    public let onDetailTap: (DailyAssignmentDTO) -> Void
    public let onMove: (IndexSet, Int) -> Void

    public init(
        assignments: [DailyAssignmentDTO],
        onToggleComplete: @escaping (DailyAssignmentDTO) -> Void,
        onTap: @escaping (DailyAssignmentDTO) -> Void,
        onDetailTap: @escaping (DailyAssignmentDTO) -> Void,
        onMove: @escaping (IndexSet, Int) -> Void
    ) {
        self.assignments = assignments
        self.onToggleComplete = onToggleComplete
        self.onTap = onTap
        self.onDetailTap = onDetailTap
        self.onMove = onMove
    }

    /// Completed tasks sorted to the bottom (matches Web behavior).
    private var sorted: [DailyAssignmentDTO] {
        let pending = assignments.filter { !$0.isCompleted }.sorted { $0.sortOrder < $1.sortOrder }
        let done = assignments.filter { $0.isCompleted }.sorted { $0.sortOrder < $1.sortOrder }
        return pending + done
    }

    public var body: some View {
        List {
            ForEach(sorted, id: \.id) { assignment in
                TaskRowView(
                    assignment: assignment,
                    onToggleComplete: { onToggleComplete(assignment) },
                    onTap: { onTap(assignment) },
                    onDetailTap: { onDetailTap(assignment) }
                )
                .listRowInsets(EdgeInsets())
                .listRowBackground(Color.nudgeBackground)
            }
            .onMove(perform: onMove)
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .background(Color.nudgeBackground)
    }
}

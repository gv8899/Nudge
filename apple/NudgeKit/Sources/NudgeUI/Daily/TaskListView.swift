import SwiftUI
import NudgeCore

public struct TaskListView: View {
    public let assignments: [DailyAssignmentDTO]
    public let onToggleComplete: (DailyAssignmentDTO) -> Void
    public let onTap: (DailyAssignmentDTO) -> Void
    public let onDetailTap: (DailyAssignmentDTO) -> Void
    public let onMove: (IndexSet, Int) -> Void
    public let onArchive: (DailyAssignmentDTO) -> Void
    public let onMoveTo: (DailyAssignmentDTO) -> Void

    public init(
        assignments: [DailyAssignmentDTO],
        onToggleComplete: @escaping (DailyAssignmentDTO) -> Void,
        onTap: @escaping (DailyAssignmentDTO) -> Void,
        onDetailTap: @escaping (DailyAssignmentDTO) -> Void,
        onMove: @escaping (IndexSet, Int) -> Void,
        onArchive: @escaping (DailyAssignmentDTO) -> Void,
        onMoveTo: @escaping (DailyAssignmentDTO) -> Void
    ) {
        self.assignments = assignments
        self.onToggleComplete = onToggleComplete
        self.onTap = onTap
        self.onDetailTap = onDetailTap
        self.onMove = onMove
        self.onArchive = onArchive
        self.onMoveTo = onMoveTo
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
                    onDetailTap: { onDetailTap(assignment) },
                    onMoveTo: { onMoveTo(assignment) },
                    onArchive: { onArchive(assignment) }
                )
                .listRowInsets(EdgeInsets())
                .listRowBackground(Color.nudgeBackground)
                #if os(iOS)
                .swipeActions(edge: .leading) {
                    Button(role: .destructive, action: { onArchive(assignment) }) {
                        Label {
                            Text("daily.archiveButton", bundle: .module)
                        } icon: {
                            Image(systemName: "archivebox")
                        }
                    }
                }
                .swipeActions(edge: .trailing) {
                    Button(action: { onMoveTo(assignment) }) {
                        Label {
                            Text("task.moveToOtherDate", bundle: .module)
                        } icon: {
                            Image(systemName: "calendar")
                        }
                    }
                    .tint(Color.nudgePrimary)
                }
                #endif
                #if os(macOS)
                .dropDestination(for: String.self) { droppedIds, _ in
                    guard let draggedId = droppedIds.first,
                          let fromIdx = sorted.firstIndex(where: { $0.id == draggedId }),
                          let toIdx = sorted.firstIndex(where: { $0.id == assignment.id }) else {
                        return false
                    }
                    let indexSet: IndexSet = [fromIdx]
                    let destination = fromIdx < toIdx ? toIdx + 1 : toIdx
                    onMove(indexSet, destination)
                    return true
                }
                #endif
            }
            .onMove(perform: onMove)
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .background(Color.nudgeBackground)
    }
}

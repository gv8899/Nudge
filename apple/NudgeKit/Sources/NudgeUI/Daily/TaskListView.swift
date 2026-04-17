import SwiftUI
import NudgeCore

public struct TaskListView: View {
    public let assignments: [DailyAssignmentDTO]
    public let isLoading: Bool
    public let onToggleComplete: (DailyAssignmentDTO) -> Void
    public let onOpen: (DailyAssignmentDTO) -> Void
    public let onMove: (IndexSet, Int) -> Void
    public let onArchive: (DailyAssignmentDTO) -> Void
    public let onMoveTo: (DailyAssignmentDTO) -> Void

    public init(
        assignments: [DailyAssignmentDTO],
        isLoading: Bool = false,
        onToggleComplete: @escaping (DailyAssignmentDTO) -> Void,
        onOpen: @escaping (DailyAssignmentDTO) -> Void,
        onMove: @escaping (IndexSet, Int) -> Void,
        onArchive: @escaping (DailyAssignmentDTO) -> Void,
        onMoveTo: @escaping (DailyAssignmentDTO) -> Void
    ) {
        self.assignments = assignments
        self.isLoading = isLoading
        self.onToggleComplete = onToggleComplete
        self.onOpen = onOpen
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
        if assignments.isEmpty && !isLoading {
            emptyState
        } else {
            list
        }
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Spacer(minLength: 48)
            Image(systemName: "sparkles")
                .font(.largeTitle)
                .foregroundStyle(Color.nudgeTextDim.opacity(0.5))
            Text("daily.emptyToday", bundle: .module)
                .font(.subheadline)
                .foregroundStyle(Color.nudgeTextDim)
            Spacer()
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 16)
    }

    private var list: some View {
        List {
            ForEach(sorted, id: \.id) { assignment in
                TaskRowView(
                    assignment: assignment,
                    onToggleComplete: { onToggleComplete(assignment) },
                    onOpen: { onOpen(assignment) },
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

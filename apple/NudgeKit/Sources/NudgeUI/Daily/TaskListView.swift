import SwiftUI
import NudgeCore

public struct TaskListView: View {
    public let assignments: [DailyAssignmentDTO]
    public let isLoading: Bool
    public let isToday: Bool
    public let onToggleComplete: (DailyAssignmentDTO) -> Void
    public let onOpen: (DailyAssignmentDTO) -> Void
    public let onMove: (IndexSet, Int) -> Void
    public let onArchive: (DailyAssignmentDTO) -> Void
    public let onMoveTo: (DailyAssignmentDTO) -> Void
    public let onMoveToToday: (DailyAssignmentDTO) -> Void
    public let onSkipThisOccurrence: (DailyAssignmentDTO) -> Void
    public let onSetRecurrence: (DailyAssignmentDTO) -> Void
    public let onSetReminder: (DailyAssignmentDTO) -> Void

    @Environment(\.locale) private var locale
    @State private var isCompletedExpanded: Bool = false

    public init(
        assignments: [DailyAssignmentDTO],
        isLoading: Bool = false,
        isToday: Bool,
        onToggleComplete: @escaping (DailyAssignmentDTO) -> Void,
        onOpen: @escaping (DailyAssignmentDTO) -> Void,
        onMove: @escaping (IndexSet, Int) -> Void,
        onArchive: @escaping (DailyAssignmentDTO) -> Void,
        onMoveTo: @escaping (DailyAssignmentDTO) -> Void,
        onMoveToToday: @escaping (DailyAssignmentDTO) -> Void,
        onSkipThisOccurrence: @escaping (DailyAssignmentDTO) -> Void,
        onSetRecurrence: @escaping (DailyAssignmentDTO) -> Void,
        onSetReminder: @escaping (DailyAssignmentDTO) -> Void
    ) {
        self.assignments = assignments
        self.isLoading = isLoading
        self.isToday = isToday
        self.onToggleComplete = onToggleComplete
        self.onOpen = onOpen
        self.onMove = onMove
        self.onArchive = onArchive
        self.onMoveTo = onMoveTo
        self.onMoveToToday = onMoveToToday
        self.onSkipThisOccurrence = onSkipThisOccurrence
        self.onSetRecurrence = onSetRecurrence
        self.onSetReminder = onSetReminder
    }

    /// Single combined list of items so SwiftUI tracks identity across
    /// pending → completed transitions consistently. The previous
    /// implementation used two nested ForEach containers — when a row
    /// flipped completion state and moved between containers, SwiftUI
    /// was occasionally rendering the old row's view (with old
    /// `isCompleted`) at the new position, producing the "checkmark
    /// not visible after toggle" report.
    private enum Item: Identifiable {
        case row(DailyAssignmentDTO)
        case completedHeader(count: Int)

        var id: String {
            switch self {
            case .row(let a): return "row-\(a.id)"
            case .completedHeader: return "header-completed"
            }
        }
    }

    private var items: [Item] {
        let pending = assignments
            .filter { !$0.isCompleted }
            .sorted { $0.sortOrder < $1.sortOrder }
        let completed = assignments
            .filter { $0.isCompleted }
            .sorted { $0.sortOrder < $1.sortOrder }

        var result: [Item] = pending.map { .row($0) }
        if !completed.isEmpty {
            result.append(.completedHeader(count: completed.count))
            if isCompletedExpanded {
                result.append(contentsOf: completed.map { .row($0) })
            }
        }
        return result
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
                .foregroundStyle(Color.nudgeTextDim)
            Text("daily.emptyToday", bundle: .module)
                .nudgeFont(.emptyStateBody)
                .foregroundStyle(Color.nudgeTextDim)
            Spacer()
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 16)
    }

    private var list: some View {
        // iOS: 卡片之間 8pt + 外側 16pt margin（block 視覺）
        // mac: 緊湊列表，零間距 + 無外側 margin（dense workspace）
        LazyVStack(spacing: listSpacing) {
            ForEach(items) { item in
                switch item {
                case .row(let assignment):
                    row(assignment)
                case .completedHeader(let count):
                    completedHeader(count: count)
                }
            }
        }
        .padding(.horizontal, listOuterPaddingH)
        .background(Color.nudgeBackground)
    }

    private var listSpacing: CGFloat {
        #if os(macOS)
        return 0
        #else
        return 8
        #endif
    }

    private var listOuterPaddingH: CGFloat {
        #if os(macOS)
        return 0
        #else
        return 16
        #endif
    }

    private func row(_ assignment: DailyAssignmentDTO) -> some View {
        TaskRowView(
            assignment: assignment,
            isToday: isToday,
            onToggleComplete: { onToggleComplete(assignment) },
            onOpen: { onOpen(assignment) },
            onMoveToToday: { onMoveToToday(assignment) },
            onMoveTo: { onMoveTo(assignment) },
            onSkipThisOccurrence: { onSkipThisOccurrence(assignment) },
            onSetRecurrence: { onSetRecurrence(assignment) },
            onSetReminder: { onSetReminder(assignment) },
            onArchive: { onArchive(assignment) }
        )
        #if os(macOS)
        .dropDestination(for: String.self) { droppedIds, _ in
            let combined = assignments.sorted { $0.sortOrder < $1.sortOrder }
            guard let draggedId = droppedIds.first,
                  let fromIdx = combined.firstIndex(where: { $0.id == draggedId }),
                  let toIdx = combined.firstIndex(where: { $0.id == assignment.id }) else {
                return false
            }
            let indexSet: IndexSet = [fromIdx]
            let destination = fromIdx < toIdx ? toIdx + 1 : toIdx
            onMove(indexSet, destination)
            return true
        }
        #endif
    }

    private func completedHeader(count: Int) -> some View {
        Button {
            withAnimation(.easeOut(duration: 0.2)) { isCompletedExpanded.toggle() }
        } label: {
            HStack(spacing: 6) {
                Text(verbatim: String(
                    format: nudgeLocalized("daily.completedSection %lld", locale: locale),
                    count
                ))
                    .nudgeFont(.sectionHeader)
                    .foregroundStyle(Color.nudgeTextDim)
                Spacer()
                Image(systemName: "chevron.right")
                    .nudgeFont(.sectionChevron)
                    .rotationEffect(.degrees(isCompletedExpanded ? 90 : 0))
                    .foregroundStyle(Color.nudgeTextDim)
            }
            .padding(.horizontal, 24)
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

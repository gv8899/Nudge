import SwiftUI
import NudgeCore
import NudgeData

public struct DailyHostView: View {
    @Environment(TaskRepository.self) private var taskRepo
    @Environment(CalendarRepository.self) private var calendarRepo
    @Environment(TagRepository.self) private var tagRepo

    @State private var selectedDate: String = DateFormatters.isoDate(Date())
    @State private var dailyData: DailyDataDTO?
    @State private var events: [CalendarEventDTO] = []
    @State private var weekDates: Set<String> = []
    @State private var isOffline: Bool = false
    @State private var lastUpdated: String = ""
    @State private var selectedAssignmentForDetail: DailyAssignmentDTO?
    @State private var moveSheetAssignment: DailyAssignmentDTO?

    #if os(iOS)
    @State private var navigationPath = NavigationPath()
    #endif

    public init() {}

    public var body: some View {
        #if os(iOS)
        iOSLayout
        #else
        macOSLayout
        #endif
    }

    // MARK: - iOS layout

    #if os(iOS)
    private var iOSLayout: some View {
        NavigationStack(path: $navigationPath) {
            VStack(spacing: 0) {
                if isOffline {
                    OfflineBannerView(lastUpdated: lastUpdated)
                }
                WeekStripView(
                    selectedDate: selectedDate,
                    datesWithTasks: weekDates,
                    onSelectDate: { selectedDate = $0 },
                    onTapToday: { selectedDate = DateFormatters.isoDate(Date()) },
                    onWeekOffset: offsetWeek
                )
                ScrollView {
                    VStack(spacing: 0) {
                        CalendarSectionView(
                            events: events,
                            isConnected: calendarRepo.isConnected,
                            onConnectTapped: {}  // Task 23 wires to OAuth flow
                        )
                        OverdueSectionView(
                            overdueTasks: dailyData?.overdueTasks ?? [],
                            onScheduleToday: { scheduleOverdueToToday($0) },
                            onMoveTo: { moveSheetAssignment = $0 },
                            onArchive: { archiveTask($0) }
                        )
                        TaskListView(
                            assignments: dailyData?.assignments ?? [],
                            onToggleComplete: toggleComplete,
                            onTap: { navigationPath.append($0) },
                            onDetailTap: { navigationPath.append($0) },
                            onMove: handleMove
                        )
                        .frame(minHeight: 300)
                    }
                }
                NewTaskInputView(onSubmit: createTask)
            }
            .background(Color.nudgeBackground)
            .navigationDestination(for: DailyAssignmentDTO.self) { assignment in
                TaskDetailView(
                    assignment: assignment,
                    tags: [],  // Phase 2: tag resolution deferred
                    onUpdateTitle: { updateTitle(assignment: assignment, title: $0) },
                    onUpdateDescription: { updateDescription(assignment: assignment, description: $0) },
                    onMoveTo: { moveSheetAssignment = assignment },
                    onArchive: { archiveTask(assignment) }
                )
            }
            .sheet(item: $moveSheetAssignment) { assignment in
                MoveToDatePickerView(
                    initialDate: assignment.date,
                    onPick: { newDate in
                        moveSheetAssignment = nil
                        moveAssignment(assignment, to: newDate)
                    },
                    onCancel: { moveSheetAssignment = nil }
                )
            }
        }
        .task(id: selectedDate) { await reload() }
    }
    #endif

    // MARK: - macOS layout

    #if os(macOS)
    private var macOSLayout: some View {
        HStack(spacing: 0) {
            // Left pane: calendar section (~300pt wide)
            VStack(spacing: 0) {
                CalendarSectionView(
                    events: events,
                    isConnected: calendarRepo.isConnected,
                    onConnectTapped: {}
                )
                Spacer()
            }
            .frame(width: 300)
            .background(Color.nudgeBackground)

            Divider()

            // Right pane: week strip + lists + input
            VStack(spacing: 0) {
                if isOffline {
                    OfflineBannerView(lastUpdated: lastUpdated)
                }
                WeekStripView(
                    selectedDate: selectedDate,
                    datesWithTasks: weekDates,
                    onSelectDate: { selectedDate = $0 },
                    onTapToday: { selectedDate = DateFormatters.isoDate(Date()) },
                    onWeekOffset: offsetWeek
                )
                ScrollView {
                    VStack(spacing: 0) {
                        OverdueSectionView(
                            overdueTasks: dailyData?.overdueTasks ?? [],
                            onScheduleToday: { scheduleOverdueToToday($0) },
                            onMoveTo: { moveSheetAssignment = $0 },
                            onArchive: { archiveTask($0) }
                        )
                        TaskListView(
                            assignments: dailyData?.assignments ?? [],
                            onToggleComplete: toggleComplete,
                            onTap: { selectedAssignmentForDetail = $0 },
                            onDetailTap: { selectedAssignmentForDetail = $0 },
                            onMove: handleMove
                        )
                        .frame(minHeight: 300)
                    }
                }
                NewTaskInputView(onSubmit: createTask)
            }
        }
        .background(Color.nudgeBackground)
        .sheet(item: $selectedAssignmentForDetail) { assignment in
            TaskDetailView(
                assignment: assignment,
                tags: [],
                onUpdateTitle: { updateTitle(assignment: assignment, title: $0) },
                onUpdateDescription: { updateDescription(assignment: assignment, description: $0) },
                onMoveTo: { moveSheetAssignment = assignment },
                onArchive: { archiveTask(assignment) }
            )
            .frame(minWidth: 500, minHeight: 400)
        }
        .sheet(item: $moveSheetAssignment) { assignment in
            MoveToDatePickerView(
                initialDate: assignment.date,
                onPick: { newDate in
                    moveSheetAssignment = nil
                    moveAssignment(assignment, to: newDate)
                },
                onCancel: { moveSheetAssignment = nil }
            )
        }
        .task(id: selectedDate) { await reload() }
    }
    #endif

    // MARK: - Data loading

    private func reload() async {
        do {
            let data = try await taskRepo.dailyData(date: selectedDate)
            dailyData = data
            lastUpdated = Self.currentTimeString()
            isOffline = false
        } catch APIError.network {
            isOffline = true
        } catch {
            // Other errors: treat as offline for now so banner shows
            isOffline = true
        }

        // Week summary
        if let date = DateFormatters.parseISODate(selectedDate) {
            let start = DateFormatters.isoDate(DateFormatters.startOfWeek(date))
            let calendar = Calendar(identifier: .gregorian)
            let endDate = calendar.date(byAdding: .day, value: 6, to: DateFormatters.startOfWeek(date)) ?? date
            let end = DateFormatters.isoDate(endDate)
            if let summary = try? await taskRepo.weekSummary(start: start, end: end) {
                weekDates = Set(summary.datesWithTasks)
            }
        }

        // Calendar events
        events = (try? await calendarRepo.events(date: selectedDate)) ?? []
    }

    private static func currentTimeString() -> String {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        return formatter.string(from: Date())
    }

    // MARK: - Actions

    private func offsetWeek(_ delta: Int) {
        guard let date = DateFormatters.parseISODate(selectedDate) else { return }
        let calendar = Calendar(identifier: .gregorian)
        if let newDate = calendar.date(byAdding: .day, value: 7 * delta, to: date) {
            selectedDate = DateFormatters.isoDate(newDate)
        }
    }

    private func createTask(_ title: String) {
        Task {
            _ = try? await taskRepo.createTask(date: selectedDate, title: title)
            await reload()
        }
    }

    private func toggleComplete(_ assignment: DailyAssignmentDTO) {
        Task {
            try? await taskRepo.toggleComplete(
                assignmentId: assignment.id,
                isCompleted: !assignment.isCompleted,
                onDate: assignment.date
            )
            await reload()
        }
    }

    private func handleMove(_ indices: IndexSet, _ newOffset: Int) {
        guard var assignments = dailyData?.assignments else { return }
        assignments.move(fromOffsets: indices, toOffset: newOffset)
        let ids = assignments.map(\.id)
        Task {
            try? await taskRepo.reorder(date: selectedDate, orderedIds: ids)
            await reload()
        }
    }

    private func moveAssignment(_ assignment: DailyAssignmentDTO, to newDate: String) {
        Task {
            try? await taskRepo.moveToDate(
                assignmentId: assignment.id,
                from: assignment.date,
                to: newDate
            )
            await reload()
        }
    }

    private func scheduleOverdueToToday(_ assignment: DailyAssignmentDTO) {
        let today = DateFormatters.isoDate(Date())
        moveAssignment(assignment, to: today)
    }

    private func archiveTask(_ assignment: DailyAssignmentDTO) {
        Task {
            try? await taskRepo.archive(taskId: assignment.task.id)
            await reload()
        }
    }

    private func updateTitle(assignment: DailyAssignmentDTO, title: String) {
        Task {
            try? await taskRepo.updateTitle(taskId: assignment.task.id, title: title)
        }
    }

    private func updateDescription(assignment: DailyAssignmentDTO, description: String) {
        Task {
            try? await taskRepo.updateDescription(taskId: assignment.task.id, description: description)
        }
    }
}

// Needed for sheet(item:) and navigationDestination(for:).
// DailyAssignmentDTO has `id: String`, so Identifiable is satisfied.
// Hashable is combined from `id` (unique per assignment) so NavigationPath can append.
extension DailyAssignmentDTO: Identifiable {}

extension DailyAssignmentDTO: Hashable {
    public func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }
}

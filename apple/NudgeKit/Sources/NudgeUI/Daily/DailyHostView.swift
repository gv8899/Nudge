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
                            currentDate: selectedDate,
                            onToggleComplete: toggleComplete,
                            onReschedule: { task, date in moveAssignment(task, to: date) },
                            onMoveTo: { moveSheetAssignment = $0 },
                            onArchive: { archiveTask($0) }
                        )
                        TaskListView(
                            assignments: dailyData?.assignments ?? [],
                            onToggleComplete: toggleComplete,
                            onTap: { navigationPath.append($0) },
                            onDetailTap: { navigationPath.append($0) },
                            onMove: handleMove,
                            onArchive: { archiveTask($0) },
                            onMoveTo: { moveSheetAssignment = $0 }
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
                    onUpdateTitle: { updateTitle(assignment: assignment, title: $0) },
                    onUpdateDescription: { updateDescription(assignment: assignment, description: $0) }
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
                    onWeekOffset: offsetWeek
                )
                ScrollView {
                    VStack(spacing: 0) {
                        OverdueSectionView(
                            overdueTasks: dailyData?.overdueTasks ?? [],
                            currentDate: selectedDate,
                            onToggleComplete: toggleComplete,
                            onReschedule: { task, date in moveAssignment(task, to: date) },
                            onMoveTo: { moveSheetAssignment = $0 },
                            onArchive: { archiveTask($0) }
                        )
                        TaskListView(
                            assignments: dailyData?.assignments ?? [],
                            onToggleComplete: toggleComplete,
                            onTap: { selectedAssignmentForDetail = $0 },
                            onDetailTap: { selectedAssignmentForDetail = $0 },
                            onMove: handleMove,
                            onArchive: { archiveTask($0) },
                            onMoveTo: { moveSheetAssignment = $0 }
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
                onUpdateTitle: { updateTitle(assignment: assignment, title: $0) },
                onUpdateDescription: { updateDescription(assignment: assignment, description: $0) }
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
        let requestedDate = selectedDate
        // Clear prior-date data so the UI never shows another day's rows
        // while the new fetch is in flight (or if it fails).
        dailyData = nil
        events = []

        do {
            let data = try await taskRepo.dailyData(date: requestedDate)
            guard requestedDate == selectedDate else { return }
            dailyData = data
            lastUpdated = Self.currentTimeString()
            isOffline = false
        } catch APIError.network {
            if requestedDate == selectedDate { isOffline = true }
        } catch {
            if requestedDate == selectedDate { isOffline = true }
        }

        // Week summary
        if let date = DateFormatters.parseISODate(requestedDate) {
            let start = DateFormatters.isoDate(DateFormatters.startOfWeek(date))
            let calendar = Calendar(identifier: .gregorian)
            let endDate = calendar.date(byAdding: .day, value: 6, to: DateFormatters.startOfWeek(date)) ?? date
            let end = DateFormatters.isoDate(endDate)
            if let summary = try? await taskRepo.weekSummary(start: start, end: end),
               requestedDate == selectedDate {
                weekDates = Set(summary.datesWithTasks)
            }
        }

        // Calendar events
        let fetchedEvents = (try? await calendarRepo.events(date: requestedDate)) ?? []
        if requestedDate == selectedDate {
            events = fetchedEvents
        }
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
            do {
                _ = try await taskRepo.createTask(date: selectedDate, title: title)
            } catch {
                print("[DailyHostView] createTask failed: \(error)")
            }
            await reload()
        }
    }

    private func toggleComplete(_ assignment: DailyAssignmentDTO) {
        Task {
            do {
                try await taskRepo.toggleComplete(
                    assignmentId: assignment.id,
                    isCompleted: !assignment.isCompleted,
                    onDate: assignment.date
                )
            } catch {
                print("[DailyHostView] toggleComplete failed: \(error)")
            }
            await reload()
        }
    }

    private func handleMove(_ indices: IndexSet, _ newOffset: Int) {
        guard var assignments = dailyData?.assignments else { return }
        assignments.move(fromOffsets: indices, toOffset: newOffset)
        let ids = assignments.map(\.id)
        Task {
            do {
                try await taskRepo.reorder(date: selectedDate, orderedIds: ids)
            } catch {
                print("[DailyHostView] reorder failed: \(error)")
            }
            await reload()
        }
    }

    private func moveAssignment(_ assignment: DailyAssignmentDTO, to newDate: String) {
        // Guard: server's PATCH treats from==to as update+delete on the same
        // row, which ends up deleting the task entirely. No-op on the client
        // when the task is already on the requested date.
        if assignment.date == newDate {
            print("[DailyHostView] moveAssignment skipped: already on \(newDate)")
            return
        }
        print("[DailyHostView] moveAssignment id=\(assignment.id) from=\(assignment.date) to=\(newDate)")
        Task {
            do {
                try await taskRepo.moveToDate(
                    assignmentId: assignment.id,
                    from: assignment.date,
                    to: newDate
                )
            } catch {
                print("[DailyHostView] moveToDate failed: \(error)")
            }
            await reload()
        }
    }

    private func scheduleOverdueToToday(_ assignment: DailyAssignmentDTO) {
        // Matches Web's onReschedule(a.id, currentDate): "today" from the
        // user's POV is the date they're viewing, not the wall-clock today.
        moveAssignment(assignment, to: selectedDate)
    }

    private func archiveTask(_ assignment: DailyAssignmentDTO) {
        print("[DailyHostView] archiveTask taskId=\(assignment.task.id)")
        Task {
            do {
                try await taskRepo.archive(taskId: assignment.task.id)
            } catch {
                print("[DailyHostView] archive failed: \(error)")
            }
            await reload()
        }
    }

    private func updateTitle(assignment: DailyAssignmentDTO, title: String) {
        Task {
            do {
                try await taskRepo.updateTitle(taskId: assignment.task.id, title: title)
            } catch {
                print("[DailyHostView] updateTitle failed: \(error)")
            }
        }
    }

    private func updateDescription(assignment: DailyAssignmentDTO, description: String) {
        Task {
            do {
                try await taskRepo.updateDescription(taskId: assignment.task.id, description: description)
            } catch {
                print("[DailyHostView] updateDescription failed: \(error)")
            }
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

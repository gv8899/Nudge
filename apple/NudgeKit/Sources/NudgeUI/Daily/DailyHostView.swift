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
    @State private var loadState: LoadState = .idle
    @State private var lastUpdated: String = ""
    @State private var selectedAssignmentForDetail: DailyAssignmentDTO?
    @State private var moveSheetAssignment: DailyAssignmentDTO?

    // Haptic feedback triggers (iOS 17+)
    @State private var completionTicker: Int = 0
    @State private var archiveTicker: Int = 0
    @State private var moveTicker: Int = 0

    @State private var oauth = CalendarOAuthCoordinator()
    @State private var isConnectingCalendar = false

    #if os(iOS)
    @State private var navigationPath = NavigationPath()
    #endif

    public init() {}

    enum LoadState: Equatable {
        case idle
        case loading
        case loaded
        case offline
        case error
    }

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
                statusBanner
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
                            onConnectTapped: connectCalendar
                        )
                        OverdueSectionView(
                            overdueTasks: dailyData?.overdueTasks ?? [],
                            currentDate: selectedDate,
                            onToggleComplete: toggleComplete,
                            onReschedule: { moveAssignment($0, to: $1) },
                            onMoveTo: { moveSheetAssignment = $0 },
                            onArchive: { archiveTask($0) }
                        )
                        NewTaskInputView(onSubmit: createTask)
                        TaskListView(
                            assignments: dailyData?.assignments ?? [],
                            isLoading: loadState == .loading,
                            onToggleComplete: toggleComplete,
                            onOpen: { navigationPath.append($0) },
                            onMove: handleMove,
                            onArchive: { archiveTask($0) },
                            onMoveTo: { moveSheetAssignment = $0 }
                        )
                        .frame(minHeight: 300)
                    }
                }
            }
            .background(Color.nudgeBackground)
            .animation(.easeOut(duration: 0.2), value: loadState)
            #if os(iOS)
            .sensoryFeedback(.success, trigger: completionTicker)
            .sensoryFeedback(.impact(weight: .medium), trigger: archiveTicker)
            .sensoryFeedback(.selection, trigger: moveTicker)
            #endif
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
            VStack(spacing: 0) {
                CalendarSectionView(
                    events: events,
                    isConnected: calendarRepo.isConnected,
                    onConnectTapped: connectCalendar
                )
                Spacer()
            }
            .frame(width: 300)
            .background(Color.nudgeBackground)

            Divider()

            VStack(spacing: 0) {
                statusBanner
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
                            onReschedule: { moveAssignment($0, to: $1) },
                            onMoveTo: { moveSheetAssignment = $0 },
                            onArchive: { archiveTask($0) }
                        )
                        NewTaskInputView(onSubmit: createTask)
                        TaskListView(
                            assignments: dailyData?.assignments ?? [],
                            isLoading: loadState == .loading,
                            onToggleComplete: toggleComplete,
                            onOpen: { selectedAssignmentForDetail = $0 },
                            onMove: handleMove,
                            onArchive: { archiveTask($0) },
                            onMoveTo: { moveSheetAssignment = $0 }
                        )
                        .frame(minHeight: 300)
                    }
                }
            }
        }
        .background(Color.nudgeBackground)
        .animation(.easeOut(duration: 0.2), value: loadState)
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

    @ViewBuilder
    private var statusBanner: some View {
        switch loadState {
        case .offline:
            OfflineBannerView(lastUpdated: lastUpdated)
        case .error:
            ErrorBannerView(onRetry: { Task { await reload() } })
        default:
            EmptyView()
        }
    }

    func connectCalendar() {
        guard !isConnectingCalendar else { return }
        isConnectingCalendar = true
        Task {
            defer { isConnectingCalendar = false }
            do {
                let url = try await calendarRepo.mobileStart()
                try await oauth.present(connectURL: url)
                await reload()
            } catch CalendarOAuthCoordinator.ConnectError.userCancelled {
                // silent
            } catch {
                print("[Calendar] connect failed: \(error)")
            }
        }
    }
}

// MARK: - Actions

extension DailyHostView {
    func reload() async {
        let requestedDate = selectedDate
        loadState = .loading
        dailyData = nil
        events = []

        // Parallelize the three fetches. Daily data is authoritative for
        // loadState; week summary and calendar events are best-effort.
        async let daily = taskRepo.dailyData(date: requestedDate)
        async let weekSummary = weekSummaryFor(date: requestedDate)
        async let calendarEvents = (try? calendarRepo.events(date: requestedDate)) ?? []

        do {
            let data = try await daily
            guard requestedDate == selectedDate else { return }
            dailyData = data
            lastUpdated = Self.currentTimeString()
            loadState = .loaded
        } catch APIError.network {
            if requestedDate == selectedDate { loadState = .offline }
        } catch {
            print("[DailyHostView] dailyData failed: \(error)")
            if requestedDate == selectedDate { loadState = .error }
        }

        if let summary = await weekSummary, requestedDate == selectedDate {
            weekDates = Set(summary.datesWithTasks)
        }

        let fetchedEvents = await calendarEvents
        if requestedDate == selectedDate {
            events = fetchedEvents
        }
    }

    private func weekSummaryFor(date: String) async -> WeekSummaryDTO? {
        guard let parsed = DateFormatters.parseISODate(date) else { return nil }
        let start = DateFormatters.isoDate(DateFormatters.startOfWeek(parsed))
        let calendar = Calendar(identifier: .gregorian)
        guard let endDate = calendar.date(byAdding: .day, value: 6, to: DateFormatters.startOfWeek(parsed)) else {
            return nil
        }
        let end = DateFormatters.isoDate(endDate)
        return try? await taskRepo.weekSummary(start: start, end: end)
    }

    private static func currentTimeString() -> String {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        return formatter.string(from: Date())
    }

    func offsetWeek(_ delta: Int) {
        guard let date = DateFormatters.parseISODate(selectedDate) else { return }
        let calendar = Calendar(identifier: .gregorian)
        if let newDate = calendar.date(byAdding: .day, value: 7 * delta, to: date) {
            selectedDate = DateFormatters.isoDate(newDate)
        }
    }

    func createTask(_ title: String) {
        Task {
            do {
                _ = try await taskRepo.createTask(date: selectedDate, title: title)
            } catch {
                print("[DailyHostView] createTask failed: \(error)")
            }
            await reload()
        }
    }

    func toggleComplete(_ assignment: DailyAssignmentDTO) {
        if !assignment.isCompleted { completionTicker &+= 1 }
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

    func handleMove(_ indices: IndexSet, _ newOffset: Int) {
        guard var assignments = dailyData?.assignments, !indices.isEmpty else { return }
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

    func moveAssignment(_ assignment: DailyAssignmentDTO, to newDate: String) {
        if assignment.date == newDate {
            return
        }
        moveTicker &+= 1
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

    func archiveTask(_ assignment: DailyAssignmentDTO) {
        archiveTicker &+= 1
        Task {
            do {
                try await taskRepo.archive(taskId: assignment.task.id)
            } catch {
                print("[DailyHostView] archive failed: \(error)")
            }
            await reload()
        }
    }

    func updateTitle(assignment: DailyAssignmentDTO, title: String) {
        Task {
            do {
                try await taskRepo.updateTitle(taskId: assignment.task.id, title: title)
            } catch {
                print("[DailyHostView] updateTitle failed: \(error)")
            }
        }
    }

    func updateDescription(assignment: DailyAssignmentDTO, description: String) {
        Task {
            do {
                try await taskRepo.updateDescription(taskId: assignment.task.id, description: description)
            } catch {
                print("[DailyHostView] updateDescription failed: \(error)")
            }
        }
    }
}

extension DailyAssignmentDTO: Identifiable {}

extension DailyAssignmentDTO: Hashable {
    public func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }
}

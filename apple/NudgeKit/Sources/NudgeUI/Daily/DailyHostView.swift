import SwiftUI
import NudgeCore
import NudgeData

public struct DailyHostView: View {
    let auth: AuthRepository

    @Environment(TaskRepository.self) private var taskRepo
    @Environment(TagRepository.self) private var tagRepo

    @State private var selectedDate: String = DateFormatters.isoDate(Date())
    @State private var dailyData: DailyDataDTO?
    @State private var weekDates: Set<String> = []
    @State private var loadState: LoadState = .idle
    @State private var lastUpdated: String = ""
    @State private var selectedAssignmentForDetail: DailyAssignmentDTO?
    @State private var moveSheetAssignment: DailyAssignmentDTO?

    // Haptic feedback triggers (iOS 17+)
    @State private var completionTicker: Int = 0
    @State private var archiveTicker: Int = 0
    @State private var moveTicker: Int = 0

    @State private var showQuickAdd = false
    @State private var quickAddText = ""

    #if os(iOS)
    @State private var navigationPath = NavigationPath()
    #endif

    public init(auth: AuthRepository) {
        self.auth = auth
    }

    enum LoadState: Equatable {
        case idle
        case loading
        case loaded
        case offline
        case error
    }

    enum DailyRoute: Hashable { case settings }

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
            ZStack(alignment: .bottomTrailing) {
                VStack(spacing: 0) {
                    HStack(alignment: .firstTextBaseline) {
                        Text("nav.tasks", bundle: .module)
                            .font(.largeTitle.weight(.bold))
                            .foregroundStyle(Color.nudgeForeground)
                        Spacer()
                        NavigationLink(value: DailyRoute.settings) {
                            Image(systemName: "gearshape")
                                .font(.title3)
                                .foregroundStyle(Color.nudgePrimary)
                                .frame(width: 44, height: 44)
                                .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 8)
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
                            TaskListView(
                                assignments: dailyData?.assignments ?? [],
                                isLoading: loadState == .loading,
                                onToggleComplete: toggleComplete,
                                onOpen: { navigationPath.append($0) },
                                onMove: handleMove,
                                onArchive: { archiveTask($0) },
                                onMoveTo: { moveSheetAssignment = $0 }
                            )
                        }
                    }
                }
                .background(Color.nudgeBackground)

                createTaskFAB
                    .padding(.trailing, 20)
                    .padding(.bottom, 20)
            }
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
            .navigationDestination(for: DailyRoute.self) { route in
                switch route {
                case .settings:
                    SettingsView(auth: auth)
                }
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
            .sheet(isPresented: $showQuickAdd, onDismiss: { quickAddText = "" }) {
                quickAddSheet
                    .presentationDetents([.height(160)])
                    .presentationDragIndicator(.visible)
            }
        }
        .task(id: selectedDate) { await reload() }
    }

    private var createTaskFAB: some View {
        Button {
            quickAddText = ""
            showQuickAdd = true
        } label: {
            Image(systemName: "plus")
                .font(.title2.weight(.semibold))
                .foregroundStyle(Color.nudgePrimaryForeground)
                .frame(width: 56, height: 56)
                .background(Circle().fill(Color.nudgePrimary))
                .shadow(color: Color.black.opacity(0.2), radius: 6, x: 0, y: 3) // nudge:allow-color
        }
        .buttonStyle(.plain)
        .accessibilityLabel(Text("task.createPlaceholder", bundle: .module))
    }

    private var quickAddSheet: some View {
        QuickAddTaskSheet(
            text: $quickAddText,
            onSubmit: {
                let title = quickAddText.trimmingCharacters(in: .whitespaces)
                guard !title.isEmpty else { return }
                createTask(title)
                showQuickAdd = false
            },
            onCancel: { showQuickAdd = false }
        )
    }
    #endif

    // MARK: - macOS layout

    #if os(macOS)
    private var macOSLayout: some View {
        ZStack(alignment: .bottomTrailing) {
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

            createTaskFABMacOS
                .padding(.trailing, 20)
                .padding(.bottom, 20)
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
        .sheet(isPresented: $showQuickAdd, onDismiss: { quickAddText = "" }) {
            QuickAddTaskSheet(
                text: $quickAddText,
                onSubmit: {
                    let title = quickAddText.trimmingCharacters(in: .whitespaces)
                    guard !title.isEmpty else { return }
                    createTask(title)
                    showQuickAdd = false
                },
                onCancel: { showQuickAdd = false }
            )
            .frame(minWidth: 420, minHeight: 180)
        }
        .task(id: selectedDate) { await reload() }
    }

    private var createTaskFABMacOS: some View {
        Button {
            quickAddText = ""
            showQuickAdd = true
        } label: {
            Image(systemName: "plus")
                .font(.title2.weight(.semibold))
                .foregroundStyle(Color.nudgePrimaryForeground)
                .frame(width: 48, height: 48)
                .background(Circle().fill(Color.nudgePrimary))
                .shadow(color: Color.black.opacity(0.18), radius: 6, x: 0, y: 3) // nudge:allow-color
        }
        .buttonStyle(.plain)
        .accessibilityLabel(Text("task.createPlaceholder", bundle: .module))
        .keyboardShortcut("n", modifiers: .command)
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

}

// MARK: - Actions

extension DailyHostView {
    func reload() async {
        let requestedDate = selectedDate
        loadState = .loading
        dailyData = nil

        // Parallelize the two fetches. Daily data is authoritative for
        // loadState; week summary is best-effort.
        async let daily = taskRepo.dailyData(date: requestedDate)
        async let weekSummary = weekSummaryFor(date: requestedDate)

        do {
            let data = try await daily
            guard requestedDate == selectedDate else { return }
            dailyData = data
            lastUpdated = Self.currentTimeString()
            loadState = .loaded
        } catch let error as APIError where error.isCancellation {
            return
        } catch APIError.network {
            if requestedDate == selectedDate { loadState = .offline }
        } catch {
            print("[DailyHostView] dailyData failed: \(error)")
            if requestedDate == selectedDate { loadState = .error }
        }

        if let summary = await weekSummary, requestedDate == selectedDate {
            weekDates = Set(summary.datesWithTasks)
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

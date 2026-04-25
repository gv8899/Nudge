import SwiftUI
import NudgeCore
import NudgeData

public struct DailyHostView: View {
    let auth: AuthRepository

    @Environment(TaskRepository.self) private var taskRepo
    @Environment(TagRepository.self) private var tagRepo
    @Environment(CardRepository.self) private var cardRepo
    #if os(iOS)
    @Environment(NotificationRouter.self) private var notificationRouter
    #endif

    @State private var selectedDate: String = DateFormatters.isoDate(Date())
    @State private var dailyData: DailyDataDTO?
    @State private var weekDates: Set<String> = []
    @State private var loadState: LoadState = .idle
    @State private var lastUpdated: String = ""
    @State private var selectedAssignmentForDetail: DailyAssignmentDTO?
    @State private var moveSheetAssignment: DailyAssignmentDTO?
    @State private var scheduleSheetAssignment: DailyAssignmentDTO?
    @State private var scheduleSheetRemindAt: String?

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

    /// Navigation route used when a notification tap routes us straight to
    /// a task whose assignment isn't in `dailyData` (e.g. a non-recurring
    /// task with an absolute reminder, or a recurring occurrence on a day
    /// the user wasn't viewing). Carries only the task id; CardDetailLoader
    /// fetches the rest.
    struct TaskIdRoute: Hashable { let id: String }

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
                    // Date eyebrow sits immediately under the nav bar and
                    // above the week strip — small, centered, MM, yyyy only
                    // (e.g. "04, 2026"). Intentionally OUTSIDE the nav bar
                    // subtitle slot so it doesn't fight the toolbar's liquid
                    // glass background on iOS 26.
                    Text(formattedSelectedDate)
                        .font(.footnote.weight(.medium))
                        .foregroundStyle(Color.nudgeTextDim)
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding(.horizontal, 16)
                        .padding(.top, 6)
                        .animation(.easeOut(duration: 0.2), value: selectedDate)

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
                                onArchive: { archiveTask($0) },
                                onSkipThisOccurrence: { skipOccurrence($0) },
                                onSetRecurrence: { openScheduleSheet(for: $0) },
                                onSetReminder: { openScheduleSheet(for: $0) }
                            )
                            TaskListView(
                                assignments: dailyData?.assignments ?? [],
                                isLoading: loadState == .loading,
                                isToday: isViewingToday,
                                onToggleComplete: toggleComplete,
                                onOpen: { navigationPath.append($0) },
                                onMove: handleMove,
                                onArchive: { archiveTask($0) },
                                onMoveTo: { moveSheetAssignment = $0 },
                                onMoveToToday: { moveAssignment($0, to: DateFormatters.isoDate(Date())) },
                                onSkipThisOccurrence: { skipOccurrence($0) },
                                onSetRecurrence: { openScheduleSheet(for: $0) },
                                onSetReminder: { openScheduleSheet(for: $0) }
                            )
                        }
                    }
                }
                .background(Color.nudgeBackground)

                createTaskFAB
                    .padding(.trailing, 20)
                    .padding(.bottom, 20)
            }
            // System nav bar + toolbar — iOS 26 auto-renders gear as a
            // liquid glass pill. Settings lives there because it's a
            // secondary page action; the primary "create task" lives in
            // the floating FAB (bottom-right) per user convention.
            .navigationTitle(Text("nav.tasks", bundle: .module))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    NavigationLink(value: DailyRoute.settings) {
                        Image(systemName: "gearshape")
                    }
                    .accessibilityLabel(Text("nav.settings", bundle: .module))
                }
            }
            .animation(.easeOut(duration: 0.2), value: loadState)
            .sensoryFeedback(.success, trigger: completionTicker)
            .sensoryFeedback(.impact(weight: .medium), trigger: archiveTicker)
            .sensoryFeedback(.selection, trigger: moveTicker)
            .navigationDestination(for: DailyAssignmentDTO.self) { assignment in
                // Unified with Cards → CardDetailView. Loader fetches fresh
                // CardDTO (including tags) since DailyAssignmentDTO only
                // carries a tag-less TaskDTO.
                CardDetailLoader(
                    taskId: assignment.task.id,
                    onUpdateTitle: { updateTaskTitle(taskId: assignment.task.id, title: $0) },
                    onUpdateDescription: { updateTaskDescription(taskId: assignment.task.id, description: $0) },
                    onUpdateTags: { newIds in await updateTaskTags(taskId: assignment.task.id, tagIds: newIds) }
                )
            }
            .navigationDestination(for: DailyRoute.self) { route in
                switch route {
                case .settings:
                    SettingsView(auth: auth)
                }
            }
            .navigationDestination(for: TaskIdRoute.self) { route in
                CardDetailLoader(
                    taskId: route.id,
                    onUpdateTitle: { updateTaskTitle(taskId: route.id, title: $0) },
                    onUpdateDescription: { updateTaskDescription(taskId: route.id, description: $0) },
                    onUpdateTags: { newIds in await updateTaskTags(taskId: route.id, tagIds: newIds) }
                )
            }
            .onChange(of: notificationRouter.pendingTaskId) { _, taskId in
                guard let taskId else { return }
                navigationPath.append(TaskIdRoute(id: taskId))
                notificationRouter.clear()
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
            .sheet(item: $scheduleSheetAssignment) { assignment in
                ScheduleEditSheet(
                    taskId: assignment.task.id,
                    taskTitle: assignment.task.title,
                    initialAbsoluteRemindAt: $scheduleSheetRemindAt,
                    onChangeAbsoluteRemindAt: { newValue in
                        Task {
                            do {
                                try await cardRepo.updateRemindAt(
                                    cardId: assignment.task.id,
                                    remindAt: newValue
                                )
                            } catch {
                                print("[DailyHostView] updateRemindAt failed: \(error)")
                            }
                        }
                    },
                    onDone: {
                        scheduleSheetAssignment = nil
                        Task { await reload() }
                    }
                )
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
                .presentationBackground(Color.nudgeBackground)
            }
            // Quick-add goes through a native `.alert` rather than a
            // custom bottom sheet. Reasons:
            //  1. `.sheet + .height()` + auto-focus TextField produces
            //     a visible two-stage animation (sheet rises, then
            //     bumps higher when keyboard appears) that neither
            //     `.medium` nor the FocusOnAppear hidden-UITextField
            //     trick cleanly fixes on iOS 26.
            //  2. A nested `.ultraThinMaterial` inside a material
            //     sheet background ended up looking like a floating
            //     card stacked on a card — the user called it out.
            //  3. Alerts are what Apple uses for their own widget
            //     quick-add: single coordinated animation, native
            //     input styling, zero custom code.
            .alert(
                Text("task.createPlaceholder", bundle: .module),
                isPresented: $showQuickAdd
            ) {
                TextField(
                    "",
                    text: $quickAddText,
                    prompt: Text("task.createPlaceholder", bundle: .module)
                )
                .submitLabel(.done)
                Button {
                    submitQuickAdd()
                } label: {
                    Text("common.save", bundle: .module)
                }
                Button(role: .cancel) {
                    quickAddText = ""
                } label: {
                    Text("common.cancel", bundle: .module)
                }
            }
        }
        .task(id: selectedDate) { await reload() }
    }

    private func submitQuickAdd() {
        let title = quickAddText.trimmingCharacters(in: .whitespaces)
        quickAddText = ""
        guard !title.isEmpty else { return }
        createTask(title)
    }

    /// iOS 26 neutral glass FAB — `.glass` (not `.glassProminent`) so
    /// the disk stays transparent instead of carrying a tint. Matches
    /// the unemphasized liquid-glass affordance the system uses for
    /// toolbar and tab-bar buttons.
    private var createTaskFAB: some View {
        Button {
            quickAddText = ""
            showQuickAdd = true
        } label: {
            Image(systemName: "plus")
                .font(.title2.weight(.semibold))
                .frame(width: 28, height: 28)
        }
        .buttonStyle(.glass)
        .buttonBorderShape(.circle)
        .controlSize(.extraLarge)
        // Override the `.tint(Color.nudgePrimary)` inherited from the
        // root TabView so the glyph stays neutral — matches the iOS 26
        // separated search pill, which also renders its icon in the
        // system's primary label color, not a brand tint.
        .tint(.primary)
        .accessibilityLabel(Text("task.createPlaceholder", bundle: .module))
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
                            onArchive: { archiveTask($0) },
                            onSkipThisOccurrence: { skipOccurrence($0) },
                            onSetRecurrence: { openScheduleSheet(for: $0) },
                            onSetReminder: { openScheduleSheet(for: $0) }
                        )
                        TaskListView(
                            assignments: dailyData?.assignments ?? [],
                            isLoading: loadState == .loading,
                            isToday: isViewingToday,
                            onToggleComplete: toggleComplete,
                            onOpen: { selectedAssignmentForDetail = $0 },
                            onMove: handleMove,
                            onArchive: { archiveTask($0) },
                            onMoveTo: { moveSheetAssignment = $0 },
                            onMoveToToday: { moveAssignment($0, to: DateFormatters.isoDate(Date())) },
                            onSkipThisOccurrence: { skipOccurrence($0) },
                            onSetRecurrence: { openScheduleSheet(for: $0) },
                            onSetReminder: { openScheduleSheet(for: $0) }
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
            // Unified with Cards detail — see iOS navigationDestination
            // above for rationale.
            CardDetailLoader(
                taskId: assignment.task.id,
                onUpdateTitle: { updateTaskTitle(taskId: assignment.task.id, title: $0) },
                onUpdateDescription: { updateTaskDescription(taskId: assignment.task.id, description: $0) },
                onUpdateTags: { newIds in await updateTaskTags(taskId: assignment.task.id, tagIds: newIds) }
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
        .sheet(item: $scheduleSheetAssignment) { assignment in
            ScheduleEditSheet(
                taskId: assignment.task.id,
                taskTitle: assignment.task.title,
                initialAbsoluteRemindAt: $scheduleSheetRemindAt,
                onChangeAbsoluteRemindAt: { newValue in
                    Task {
                        do {
                            try await cardRepo.updateRemindAt(
                                cardId: assignment.task.id,
                                remindAt: newValue
                            )
                        } catch {
                            print("[DailyHostView] updateRemindAt failed: \(error)")
                        }
                    }
                },
                onDone: {
                    scheduleSheetAssignment = nil
                    Task { await reload() }
                }
            )
            .frame(minWidth: 480, minHeight: 420)
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

    /// "MM, yyyy" (zero-padded month + year, e.g. "04, 2026") used as the
    /// small eyebrow above the "任務" page title. Locale-independent —
    /// this is a pure numeric eyebrow; the week strip and the week's
    /// selected-day highlight carry the rest of the temporal context.
    /// True when the user is viewing today's date — drives the "Move to
    /// today" entry visibility in TaskRowMenu (hidden when already today).
    private var isViewingToday: Bool {
        selectedDate == DateFormatters.isoDate(Date())
    }

    private var formattedSelectedDate: String {
        guard let date = DateFormatters.parseISODate(selectedDate) else {
            return selectedDate
        }
        let cal = Calendar(identifier: .gregorian)
        let m = cal.component(.month, from: date)
        let y = cal.component(.year, from: date)
        return String(format: "%02d, %d", m, y)
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
        let newValue = !assignment.isCompleted
        // Optimistic update: flip isCompleted locally so the row redraws
        // immediately (no full-page flash from reload()'s "dailyData = nil
        // → loadState = .loading → fetch → assign → loaded" cycle, which
        // looked like the whole screen blinked on every checkbox tap).
        applyAssignmentIsCompletedLocally(id: assignment.id, value: newValue)
        Task {
            do {
                try await taskRepo.toggleComplete(
                    assignmentId: assignment.id,
                    isCompleted: newValue,
                    onDate: assignment.date
                )
            } catch {
                // Revert on server failure — the row snaps back to its
                // original state instead of lying about persistence.
                applyAssignmentIsCompletedLocally(id: assignment.id, value: !newValue)
                print("[DailyHostView] toggleComplete failed: \(error)")
            }
        }
    }

    /// Flips `isCompleted` on a specific assignment inside both
    /// `assignments` and `overdueTasks` without touching any other state —
    /// no loadState transition, no `dailyData = nil`, no fetch.
    private func applyAssignmentIsCompletedLocally(id: String, value: Bool) {
        guard let data = dailyData else { return }
        func rewrap(_ a: DailyAssignmentDTO) -> DailyAssignmentDTO {
            guard a.id == id else { return a }
            return DailyAssignmentDTO(
                id: a.id,
                taskId: a.taskId,
                date: a.date,
                isCompleted: value,
                sortOrder: a.sortOrder,
                task: a.task
            )
        }
        dailyData = DailyDataDTO(
            date: data.date,
            assignments: data.assignments.map(rewrap),
            overdueTasks: data.overdueTasks.map(rewrap),
            noteContent: data.noteContent
        )
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

    /// Presents the schedule sheet for `assignment`. Fetches the latest
    /// remindAt from the server first so the sheet's reminder DatePicker
    /// initializes correctly when the task is non-recurring.
    func openScheduleSheet(for assignment: DailyAssignmentDTO) {
        scheduleSheetRemindAt = nil
        scheduleSheetAssignment = assignment
        Task {
            do {
                let card = try await cardRepo.get(cardId: assignment.task.id)
                if scheduleSheetAssignment?.id == assignment.id {
                    scheduleSheetRemindAt = card.remindAt
                }
            } catch {
                print("[DailyHostView] preloadCard failed: \(error)")
            }
        }
    }

    /// Marks a recurring assignment as skipped for its specific date,
    /// hiding it from the row list while preserving the recurrence rule
    /// so the next occurrence still materializes.
    func skipOccurrence(_ assignment: DailyAssignmentDTO) {
        archiveTicker &+= 1
        Task {
            do {
                try await taskRepo.toggleSkip(assignmentId: assignment.id, isSkipped: true)
            } catch {
                print("[DailyHostView] toggleSkip failed: \(error)")
            }
            await reload()
        }
    }

    func updateTaskTitle(taskId: String, title: String) {
        // Optimistic local update so the row in the list (and overdue
        // section) reflects the new title the moment the user navigates
        // back, without waiting for the PATCH + reload round-trip.
        applyTaskPatchLocally(taskId: taskId) { task in
            TaskDTO(
                id: task.id,
                title: title,
                description: task.description,
                status: task.status,
                createdAt: task.createdAt,
                updatedAt: task.updatedAt
            )
        }
        Task {
            do {
                try await taskRepo.updateTitle(taskId: taskId, title: title)
            } catch {
                print("[DailyHostView] updateTitle failed: \(error)")
            }
        }
    }

    func updateTaskDescription(taskId: String, description: String) {
        applyTaskPatchLocally(taskId: taskId) { task in
            TaskDTO(
                id: task.id,
                title: task.title,
                description: description,
                status: task.status,
                createdAt: task.createdAt,
                updatedAt: task.updatedAt
            )
        }
        Task {
            do {
                try await taskRepo.updateDescription(taskId: taskId, description: description)
            } catch {
                print("[DailyHostView] updateDescription failed: \(error)")
            }
        }
    }

    /// Rebuilds `dailyData` with one task swapped out across both
    /// `assignments` and `overdueTasks` lists. Pure local mutation so the
    /// UI reflects rename / description edits without a round-trip.
    private func applyTaskPatchLocally(
        taskId: String,
        patch: (TaskDTO) -> TaskDTO
    ) {
        guard let data = dailyData else { return }
        func rewrap(_ a: DailyAssignmentDTO) -> DailyAssignmentDTO {
            guard a.task.id == taskId else { return a }
            return DailyAssignmentDTO(
                id: a.id,
                taskId: a.taskId,
                date: a.date,
                isCompleted: a.isCompleted,
                sortOrder: a.sortOrder,
                task: patch(a.task)
            )
        }
        dailyData = DailyDataDTO(
            date: data.date,
            assignments: data.assignments.map(rewrap),
            overdueTasks: data.overdueTasks.map(rewrap),
            noteContent: data.noteContent
        )
    }

    func updateTaskTags(taskId: String, tagIds: Set<String>) async {
        do {
            try await tagRepo.setTaskTags(taskId: taskId, tagIds: Array(tagIds))
        } catch {
            print("[DailyHostView] updateTags failed: \(error)")
        }
    }
}

extension DailyAssignmentDTO: Identifiable {}

extension DailyAssignmentDTO: Hashable {
    public func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }
}

import SwiftUI
import NudgeCore
import NudgeData

public struct DailyHostView: View {
    let auth: AuthRepository
    /// Mac MacSidebarRoot 用 ZStack 同時 mount 所有 5 個 host（保留
    /// navigation state），inactive view 的 toolbar items 會 bubble 到
    /// 外層 NavigationSplitView 共用 toolbar，污染畫面。embedded = true
    /// 跳過 .toolbar / .navigationTitle / .navigationSubtitle，讓 inactive
    /// 時 toolbar 完全不貢獻。Active host 傳 false (default) 行為不變。
    let embedded: Bool

    @Environment(TaskRepository.self) private var taskRepo
    @Environment(TagRepository.self) private var tagRepo
    @Environment(CardRepository.self) private var cardRepo
    @Environment(\.locale) private var locale
    @Environment(\.scenePhase) private var scenePhase
    #if os(iOS)
    @Environment(NotificationRouter.self) private var notificationRouter
    #endif

    @State private var selectedDate: String = DateFormatters.isoDate(Date())
    @State private var dailyData: DailyDataDTO?
    @State private var weekDates: Set<String> = []
    @State private var loadState: LoadState = .idle
    @State private var lastUpdated: String = ""
    @State private var moveSheetAssignment: DailyAssignmentDTO?
    @State private var scheduleSheetAssignment: DailyAssignmentDTO?
    @State private var scheduleSheetRemindAt: String?

    // Haptic feedback triggers (iOS 17+)
    @State private var completionTicker: Int = 0
    @State private var archiveTicker: Int = 0
    @State private var moveTicker: Int = 0

    @State private var showQuickAdd = false
    @State private var quickAddText = ""

    // 30 秒 smart polling — server 多數時候回 304，只有真有變動才更新
    // 本地 cache + widget snapshot。scenePhase 切走時 cancel，回前景再啟。
    @State private var pollingTask: Task<Void, Never>?

    // Used by both platforms now — macOS pushes detail into the
    // sidebar's content column NavigationStack instead of opening a
    // sheet (was: phone-shaped sheet detail covering the window).
    @State private var navigationPath = NavigationPath()

    #if os(macOS)
    // mac Dashboard：兩欄 — 中央 task / 右側 cards。原本還有日曆欄，
    // 已移除 (使用者偏好直接走獨立 Calendar tab)。
    @State private var dashboardRecentCards: [CardDTO] = []

    // 右欄 manual conditional 切換 detail / list（取代 inner
    // NavigationStack，避免 push 把 detail 撐到整個視窗）。當
    // dashboardCardDetailCard != nil 時欄內顯示 detail，左上角 back
    // chevron 返回；nil 時顯示搜尋 / tag chip / list。
    @State private var dashboardCardDetailCard: CardDTO?
    @State private var dashboardCardSearchQuery = ""
    @State private var dashboardCardDebouncedQuery = ""
    @State private var dashboardCardSelectedTagIds: Set<String> = []
    @State private var dashboardCardAllTags: [TagDTO] = []
    @State private var dashboardCardSearchResults: [CardDTO] = []
    @State private var dashboardCardSearchIsLoading = false
    @State private var dashboardCardHasSearched = false
    /// Cards 區搜尋 / 標籤區塊預設收合 — 點 header 右側放大鏡才展開。
    /// 收合時搜尋條件不清空，再次展開可看到上次 query / tag 選擇。
    @State private var dashboardCardSearchExpanded: Bool = false

    // Right panel — 使用者可選的副面板。預設關閉，開啟時內容由
    // `dashboardRightPanelKind` 在 Calendar / Cards 之間切換。Tasks 主
    // 欄不論面板開不開都維持置中 + 760pt max-width；面板開啟時走
    // HSplitView 把面板放在右邊，使用者可拖拉欄寬。@AppStorage 持久
    // 偏好，下次開啟保留狀態。
    @AppStorage("daily.mac.rightPanelOpen") private var dashboardRightPanelOpen: Bool = false
    @AppStorage("daily.mac.rightPanelKind") private var dashboardRightPanelKindRaw: String = DashboardRightPanelKind.calendar.rawValue
    /// Right panel 寬度（pt）— 自製 resize handle 拖拉時更新；重開保留。
    /// 280 ~ 720 clamp 避免擠到 tasks 欄或瘦到 panel 不可用。
    @AppStorage("daily.mac.rightPanelWidth") private var dashboardRightPanelWidth: Double = 400
    @State private var dashboardRightPanelDragStart: Double? = nil
    /// hover 在 resize zone 時顯示分隔線 + 雙箭頭 cursor。drag 期間也維持
    /// 顯示，避免拖到一半線消失。Heptabase pattern。
    @State private var dashboardResizeHandleHovered: Bool = false
    enum DashboardRightPanelKind: String { case calendar, cards }
    private var dashboardRightPanelKind: DashboardRightPanelKind {
        get { DashboardRightPanelKind(rawValue: dashboardRightPanelKindRaw) ?? .calendar }
    }
    #endif

    public init(auth: AuthRepository, embedded: Bool = false) {
        self.auth = auth
        self.embedded = embedded
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
        Group {
            #if os(iOS)
            iOSLayout
            #else
            macOSLayout
            #endif
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active {
                startPolling()
            } else {
                pollingTask?.cancel()
                pollingTask = nil
            }
        }
        .onAppear {
            // scenePhase 在 view 第一次出現時若已是 .active 不會 fire
            // onChange，所以開頭也手動 start 一次
            if scenePhase == .active {
                startPolling()
            }
        }
        .onDisappear {
            pollingTask?.cancel()
            pollingTask = nil
        }
    }

    /// 啟動 30 秒 polling loop。Idempotent — 重複呼叫先 cancel 舊的。
    /// scenePhase != active、view disappear、selectedDate 換都會被外層
    /// cancel 掉，loop 自然結束。
    private func startPolling() {
        pollingTask?.cancel()
        pollingTask = Task { [weak taskRepo] in
            while !Task.isCancelled {
                // 30 秒 — 用 nanoseconds 避免新 API 在較舊 deployment
                // target 上不可用的問題
                try? await Task.sleep(nanoseconds: 30_000_000_000)
                if Task.isCancelled { break }
                guard let repo = taskRepo else { break }
                let today = DateFormatters.isoDate(Date())
                await repo.refreshIfChanged(date: today)
            }
        }
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
                                onSetReminder: { openScheduleSheet(for: $0) },
                                onOpen: { navigationPath.append($0) }
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
                        // Explicit foregroundStyle overrides the
                        // .tint(Color.nudgePrimary) inherited from
                        // PlatformRootView's TabView root, which would
                        // otherwise paint this glyph orange.
                        Image(systemName: "gearshape")
                            .foregroundStyle(Color.nudgeForeground)
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
            .onChange(of: notificationRouter.pendingNewTask) { _, isPending in
                guard isPending else { return }
                // Mirror the FAB tap path — fresh empty input then present
                // the quick-add alert. Today selected so the new task lands
                // on the day the user expects when arriving via widget.
                selectedDate = DateFormatters.isoDate(Date())
                quickAddText = ""
                showQuickAdd = true
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

    #endif

    /// iOS 26 / macOS 15+ neutral glass FAB — `.glass` (not
    /// `.glassProminent`) so the disk stays transparent instead of
    /// carrying a tint. Matches the unemphasized liquid-glass affordance
    /// the system uses for toolbar and tab-bar buttons. iOS 浮在 daily
    /// view 右下；mac 浮在 centered tasks 欄右下（透過 ZStack）。
    @ViewBuilder
    private var createTaskFAB: some View {
        let core = Button {
            quickAddText = ""
            showQuickAdd = true
        } label: {
            // Frame + contentShape 必須在 label 內，整個 60×60 圓形
            // 才是 button 的 hit area。之前 frame 加在 button 外面只
            // 是「視覺置中 28pt image 在 56pt glass disk」，但實際
            // 可點區只有中央 28pt — 使用者點偏一點就 miss。
            Image(systemName: "plus")
                .font(.title2.weight(.semibold))
                .frame(width: 60, height: 60)
                .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .tint(.primary)
        .accessibilityLabel(Text("task.createPlaceholder", bundle: .module))

        // glassEffect 在 iOS 是 26.0+、macOS 也是 26.0+。低於這個版本的
        // mac (deployment target 15.0) fallback 用 Material.regular +
        // shadow 模擬 glass 質感，視覺接近、不需要 OS 26。
        if #available(iOS 26.0, macOS 26.0, *) {
            core.glassEffect(.regular, in: .circle)
        } else {
            core.background(
                Circle()
                    .fill(.regularMaterial)
                    .shadow(color: Color.nudgeForeground.opacity(0.15), radius: 8, x: 0, y: 4)
            )
        }
    }

    // MARK: - macOS layout

    #if os(macOS)
    private var macOSLayout: some View {
        // NavigationStack so tap-task pushes detail into the same
        // column instead of opening a sheet (mac convention). Sheet
        // is reserved for create / move-to-date / schedule which are
        // discrete modal actions. Chrome (toolbar / title) 由 macOSContent
        // 條件套用 — embedded=true 時跳過避免 inactive sidebar host 的
        // toolbar items 漂進外層 NavigationSplitView 共用 toolbar。
        NavigationStack(path: $navigationPath) {
            macOSContent
        }
        .animation(.easeOut(duration: 0.2), value: loadState)
        .sheet(item: $moveSheetAssignment) { assignment in
            MoveToDatePickerView(
                initialDate: assignment.date,
                onPick: { newDate in
                    moveSheetAssignment = nil
                    moveAssignment(assignment, to: newDate)
                },
                onCancel: { moveSheetAssignment = nil }
            )
            .frame(minWidth: 360, minHeight: 320)
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
        // Menu bar / keyboard command listeners (declared in
        // CommandNotifications.swift). Posted by NudgeCommandsMenu in
        // the app target; received here so Daily reacts to ⌘N, ⌘←,
        // ⌘→, ⌘T, ⇧⌘← / ⇧⌘→.
        .onReceive(NotificationCenter.default.publisher(for: NudgeCommands.newTaskNotification)) { _ in
            quickAddText = ""
            showQuickAdd = true
        }
        .onReceive(NotificationCenter.default.publisher(for: NudgeCommands.prevDayNotification)) { _ in
            offsetDay(-1)
        }
        .onReceive(NotificationCenter.default.publisher(for: NudgeCommands.nextDayNotification)) { _ in
            offsetDay(1)
        }
        .onReceive(NotificationCenter.default.publisher(for: NudgeCommands.todayNotification)) { _ in
            selectedDate = DateFormatters.isoDate(Date())
        }
        .onReceive(NotificationCenter.default.publisher(for: NudgeCommands.prevWeekNotification)) { _ in
            offsetWeek(-1)
        }
        .onReceive(NotificationCenter.default.publisher(for: NudgeCommands.nextWeekNotification)) { _ in
            offsetWeek(1)
        }
        .task(id: selectedDate) {
            await reload()
        }
        .task {
            await reloadDashboardCards()
        }
    }

    /// dashboardContent + chrome (background / title / toolbar)。embedded
    /// 時只套 background，跳掉 title / toolbar，inactive 時不污染外層
    /// NavigationSplitView 的共用 toolbar。
    @ViewBuilder
    private var macOSContent: some View {
        let core = dashboardContent.background(Color.nudgeBackground)
        if embedded {
            core
        } else {
            core
                .navigationTitle(Text("nav.tasks", bundle: .module))
                .navigationSubtitle(Text(verbatim: formattedSelectedDate))
                .toolbar {
                    ToolbarItemGroup(placement: .navigation) {
                        Button { offsetWeek(-1) } label: {
                            Image(systemName: "chevron.left")
                        }
                        .help(Text("daily.prevWeekAria", bundle: .module))

                        Button { selectedDate = DateFormatters.isoDate(Date()) } label: {
                            Text("daily.todayButton", bundle: .module)
                        }
                        .help(Text("daily.todayAria", bundle: .module))

                        Button { offsetWeek(1) } label: {
                            Image(systemName: "chevron.right")
                        }
                        .help(Text("daily.nextWeekAria", bundle: .module))
                    }
                    // .principal 放一個 Spacer 把 primaryAction 推到
                    // 右邊。macOS NavigationStack 沒 principal 內容
                    // 時，toolbar 把所有 items 擠在左邊；給個 Spacer
                    // 撐開中間，primaryAction 才會走到 trailing。
                    ToolbarItem(placement: .principal) {
                        Spacer()
                    }
                    ToolbarItemGroup(placement: .primaryAction) {
                        // Toggle 放左、picker 從 toggle 右側展開。
                        // .tint(Color.nudgePrimary) 覆蓋系統 accent
                        // (預設藍) → ON-state 用品牌色 cream/brown 實心。
                        Toggle(isOn: $dashboardRightPanelOpen) {
                            Image(systemName: "sidebar.right")
                        }
                        .toggleStyle(.button)
                        .tint(Color.nudgePrimary)
                        .help(Text("daily.toggleRightPanel", bundle: .module))

                        // Right panel 開啟時才顯示 Calendar / Cards
                        // segmented picker；同樣 .tint 用品牌色，避免
                        // 選中 segment 顯示為系統藍。
                        if dashboardRightPanelOpen {
                            Picker(selection: $dashboardRightPanelKindRaw) {
                                Text("nav.calendar", bundle: .module)
                                    .tag(DashboardRightPanelKind.calendar.rawValue)
                                Text("nav.cards", bundle: .module)
                                    .tag(DashboardRightPanelKind.cards.rawValue)
                            } label: {
                                EmptyView()
                            }
                            .pickerStyle(.segmented)
                            .controlSize(.small)
                            .fixedSize()
                            .tint(Color.nudgePrimary)
                        }
                    }
                }
        }
    }

    private func offsetDay(_ days: Int) {
        guard let date = DateFormatters.parseISODate(selectedDate),
              let next = Calendar(identifier: .gregorian).date(byAdding: .day, value: days, to: date)
        else { return }
        selectedDate = DateFormatters.isoDate(next)
    }

    // MARK: - macOS dashboard 主欄 + 可選 right panel

    /// 主欄（tasks）永遠置中 + 760pt max-width，不論 right panel 開不
    /// 開。Right panel 開啟時走 HSplitView，使用者可拖拉欄寬調整左右
    /// 比例；面板內由 picker 切 Calendar / Cards。
    /// Heptabase-style slide-in 右側面板：永遠是同一棵 HStack（parent 樹
    /// 不變），open 時把 right panel 條件 insert + .transition(.move(edge:
    /// .trailing))，SwiftUI 才會做正確的 slide-in 動畫。
    /// 之前用 if-else 切換 `HSplitView ↔ centeredTasksColumn` SwiftUI 看
    /// 成兩棵不同 view tree，預設 crossfade → 「啪一下」感。
    /// Trade-off：失去 HSplitView 的拖拉欄寬；用固定 width 換到順動畫，
    /// 拖拉之後再加。
    private var dashboardContent: some View {
        HStack(spacing: 0) {
            centeredTasksColumn
                .frame(maxWidth: .infinity, maxHeight: .infinity)

            if dashboardRightPanelOpen {
                // resize handle + panel 包成一個 HStack，整段一起 slide
                // (transition 掛在外層)。之前 handle / panel 各自分離、
                // 動畫時兩者錯開、視覺上像「條 + 區塊」分兩段進來。
                HStack(spacing: 0) {
                    resizeHandle
                    dashboardRightPanel
                        .frame(width: dashboardRightPanelWidth)
                        .frame(maxHeight: .infinity)
                }
                .transition(.asymmetric(
                    insertion: .move(edge: .trailing).combined(with: .opacity),
                    removal: .move(edge: .trailing).combined(with: .opacity)
                ))
            }
        }
        .animation(.spring(response: 0.32, dampingFraction: 0.86), value: dashboardRightPanelOpen)
        .clipped()
    }

    /// 自製 resize handle — 8pt 透明 hit zone，**只在 hover / drag 時**
    /// 才浮出 3pt 粗線，平常完全隱形（Heptabase pattern：兩個區塊看起
    /// 來無縫，hover 才顯示分隔線）。線用 .easeOut(0.15) fade in/out。
    /// .global coordinate space 算 drag translation，避免 handle 隨
    /// panel 變窄往右移、cursor-handle 相對座標 feedback 抖動。
    private var resizeHandle: some View {
        let lineVisible = dashboardResizeHandleHovered || dashboardRightPanelDragStart != nil
        return ZStack {
            // 8pt 透明 hit zone — 略寬好抓。
            Color.clear
                .contentShape(Rectangle())
            // 中央 3pt 粗線（從原本 1pt 提到 3pt 視覺更明顯）：hover /
            // drag 才顯示。Color.nudgePrimary 用品牌主色，跟 Heptabase
            // 預設藍 cursor highlight 同感。.frame(maxHeight: .infinity)
            // 確保線從 dashboardContent 頂端拉到底端，不被父層 ZStack
            // 子 view 的 intrinsic height 限制住。
            Rectangle()
                .fill(Color.nudgePrimary)
                .frame(width: 3)
                .frame(maxHeight: .infinity)
                .opacity(lineVisible ? 1 : 0)
                .animation(.easeOut(duration: 0.15), value: lineVisible)
        }
        .frame(width: 8)
        .frame(maxHeight: .infinity)
        #if os(macOS)
        .onHover { hovering in
            dashboardResizeHandleHovered = hovering
            if hovering {
                NSCursor.resizeLeftRight.set()
            } else {
                NSCursor.arrow.set()
            }
        }
        #endif
        .gesture(
            // .global 避免 handle 隨 panel 寬度變動而位移、translation
            // 又重算的 feedback 迴圈（→ 抖動 root cause）。global 座標
            // 下 handle 怎麼動、cursor 螢幕絕對位置不變、translation 穩。
            DragGesture(minimumDistance: 0, coordinateSpace: .global)
                .onChanged { value in
                    // 第一次 onChanged 記下 drag 開始時的 width，
                    // 整段 drag 都從這個基準算 delta，避免每幀累加漂移。
                    if dashboardRightPanelDragStart == nil {
                        dashboardRightPanelDragStart = dashboardRightPanelWidth
                    }
                    let base = dashboardRightPanelDragStart ?? dashboardRightPanelWidth
                    // panel 在右邊，divider 往右拖 = panel 變窄
                    // (translation.width 正值 = 往右)，所以減。
                    let proposed = base - Double(value.translation.width)
                    dashboardRightPanelWidth = max(280, min(720, proposed))
                }
                .onEnded { _ in
                    dashboardRightPanelDragStart = nil
                }
        )
    }

    /// Tasks 欄置中 wrapper — 兩側 Spacer + 760pt max-width。Min spacer
    /// 16pt 確保內容不會貼到視窗邊；視窗夠寬就自然出現對稱留白，把使
    /// 用者注意力收斂到 reading column 上。
    /// ZStack(.bottomTrailing) 把 FAB 浮在 column 右下，跟 iOS 同位置／
    /// 同 glass 外觀；FAB 只屬於 tasks 欄不會跟著 right panel 跑。
    private var centeredTasksColumn: some View {
        HStack(spacing: 0) {
            Spacer(minLength: 16)
            ZStack(alignment: .bottomTrailing) {
                dashboardTasksColumn
                createTaskFAB
                    // trailing 24 + bottom 40 — 上移離視窗底邊一點，
                    // 比 iOS (20/20) 高，因為 mac 底邊沒有 home indicator
                    // 視覺壓力，FAB 太貼底會像被切掉。
                    .padding(.trailing, 24)
                    .padding(.bottom, 40)
            }
            .frame(maxWidth: 760)
            Spacer(minLength: 16)
        }
    }

    /// Right panel：picker 已挪到 toolbar（panel 開啟時才顯示），這裡
    /// 直接顯示對應內容，內容從 panel 頂端開始，跟左欄 dashboardDateHeader
    /// 的 Friday eyebrow 對齊。
    @ViewBuilder
    private var dashboardRightPanel: some View {
        switch dashboardRightPanelKind {
        case .calendar:
            // embedded: true 避免 CalendarHostView 的 modePicker
            // (square.grid.2x2) bubble 到外層視窗 toolbar。
            CalendarHostView(embedded: true)
        case .cards:
            dashboardCardsColumn
        }
    }

    @ViewBuilder
    private var dashboardTasksColumn: some View {
        VStack(spacing: 0) {
            // 取代原本小字「今日任務 N」的 column header — 改成兩行
            // hierarchy：weekday eyebrow（小、dim）+ 大字 H1 日期。Mac
            // window subtitle 太弱，需要在 content 內把日期撐起來，跟
            // iOS 用 nav bar large title 對等。
            dashboardDateHeader
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
                        onSetReminder: { openScheduleSheet(for: $0) },
                        onOpen: openTaskInRightColumn
                    )
                    // 「今天 (N)」section divider — 把今天的任務跟前
                    // 幾天 rollup 視覺分清楚。只在當日有任務、且 user
                    // 看的是 today 時才出（其他日期看不需要這個 cue，
                    // 因為日期 H1 已經點明）。
                    if isViewingToday,
                       let count = dailyData?.assignments.count,
                       count > 0 {
                        todaySectionHeader(count: count)
                    }
                    TaskListView(
                        assignments: dailyData?.assignments ?? [],
                        isLoading: loadState == .loading,
                        isToday: isViewingToday,
                        onToggleComplete: toggleComplete,
                        onOpen: openTaskInRightColumn,
                        onMove: handleMove,
                        onArchive: { archiveTask($0) },
                        onMoveTo: { moveSheetAssignment = $0 },
                        onMoveToToday: { moveAssignment($0, to: DateFormatters.isoDate(Date())) },
                        onSkipThisOccurrence: { skipOccurrence($0) },
                        onSetRecurrence: { openScheduleSheet(for: $0) },
                        onSetReminder: { openScheduleSheet(for: $0) }
                    )
                    // alignment: .top — frame minHeight 300 是給 drop
                    // zone 用的，但沒指定 alignment 預設置中，內容變
                    // 「漂在 frame 中央」上下各空一截。明確 top 固定。
                    .frame(minHeight: 300, alignment: .top)
                }
            }
        }
    }

    /// 點 task → 在 right panel 顯示對應卡片 detail。若 right panel 收
    /// 起或正在顯示 Calendar，自動切到 Cards 並打開，確保點下去一定有
    /// 東西可看。fetch 完才更新 state，期間維持上次的 detail（避免閃爍）。
    private func openTaskInRightColumn(_ assignment: DailyAssignmentDTO) {
        if !dashboardRightPanelOpen { dashboardRightPanelOpen = true }
        if dashboardRightPanelKind != .cards {
            dashboardRightPanelKindRaw = DashboardRightPanelKind.cards.rawValue
        }
        Task {
            do {
                let card = try await cardRepo.get(cardId: assignment.task.id)
                await MainActor.run {
                    dashboardCardDetailCard = card
                }
            } catch {
                if !APIError.isCancellation(error) {
                    print("[DailyHostView] open task in right column failed: \(error)")
                }
            }
        }
    }

    @ViewBuilder
    private var dashboardCardsColumn: some View {
        Group {
            if let card = dashboardCardDetailCard {
                dashboardCardsColumnDetail(card)
            } else {
                dashboardCardsColumnList
            }
        }
        .background(Color.nudgeForeground.opacity(0.025))
        .task { await loadDashboardCardTags() }
        .task(id: dashboardCardSearchQuery) { await debounceDashboardCardSearch() }
        .task(id: dashboardCardSearchKey) { await fetchDashboardCardSearch() }
    }

    @ViewBuilder
    private var dashboardCardsColumnList: some View {
        // VStack spacing 16 — 統一 token，不需要再各自加 padding/divider；
        // header / search / chips / grid 用空白分隔，不畫線（Heptabase 同
        // pattern：用 spacing 而不是 divider 強化區塊感）。
        VStack(alignment: .leading, spacing: 16) {
            dashboardCardsHeaderWithSearchToggle
            if dashboardCardSearchExpanded {
                dashboardCardsSearchField
                if !dashboardCardAllTags.isEmpty {
                    dashboardCardsTagChips
                }
            }
            if displayedDashboardCards.isEmpty {
                if dashboardCardSearchIsLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .padding(20)
                } else if isDashboardCardsFiltering && dashboardCardHasSearched {
                    dashboardEmptyState(
                        systemName: "magnifyingglass",
                        titleKey: "cards.emptyWithQuery"
                    )
                } else {
                    dashboardEmptyState(
                        systemName: "square.stack",
                        titleKey: "cards.emptyNoCards"
                    )
                }
            } else {
                ScrollView {
                    // adaptive minimum 280pt — 220 在 ~700pt 面板寬會
                    // 排到 3 欄，每張卡片字被擠到不可讀（user feedback
                    // 「很擠」）。280 讓 ~700pt 面板降為 2 欄、>900pt 才
                    // 再升為 3 欄。Cards tab 全寬視圖在大視窗仍可排 5+
                    // 欄，不影響該情境。
                    LazyVGrid(
                        columns: [GridItem(.adaptive(minimum: 280), spacing: 10)],
                        spacing: 10
                    ) {
                        ForEach(displayedDashboardCards) { card in
                            CardGridItemView(
                                card: card,
                                isSelected: dashboardCardDetailCard?.id == card.id,
                                onTap: { dashboardCardDetailCard = card }
                            )
                        }
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 10)
                }
            }
            Spacer(minLength: 0)
        }
        // 跟 detail 一樣 claim 滿欄寬，這樣 HSplitView 看到兩種模式
        // 都是同一個 intrinsic width，切換時不會 rebalance 欄寬。
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    @ViewBuilder
    private func dashboardCardsColumnDetail(_ card: CardDTO) -> some View {
        DashboardColumnCardDetail(
            card: card,
            onUpdateTitle: { updateTaskTitle(taskId: card.id, title: $0) },
            onUpdateDescription: { updateTaskDescription(taskId: card.id, description: $0) },
            onBack: { dashboardCardDetailCard = nil }
        )
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    /// 卡片欄目前要顯示的清單 — 沒搜尋 / 沒選 tag → 用最近卡片快取；
    /// 否則 → 用搜尋結果。
    private var displayedDashboardCards: [CardDTO] {
        isDashboardCardsFiltering ? dashboardCardSearchResults : dashboardRecentCards
    }

    private var isDashboardCardsFiltering: Bool {
        !dashboardCardDebouncedQuery.isEmpty || !dashboardCardSelectedTagIds.isEmpty
    }

    /// debouncedQuery + 選中 tag 一起 key — chip 切換也會 re-fetch。
    private var dashboardCardSearchKey: String {
        let tags = dashboardCardSelectedTagIds.sorted().joined(separator: ",")
        return "\(dashboardCardDebouncedQuery)|\(tags)"
    }

    private var dashboardCardsSearchField: some View {
        HStack(spacing: 6) {
            Image(systemName: "magnifyingglass")
                .nudgeFont(.fieldIcon)
                .foregroundStyle(Color.nudgeTextDim)
            TextField(
                "",
                text: $dashboardCardSearchQuery,
                prompt: Text("cards.searchPlaceholder", bundle: .module)
            )
            .textFieldStyle(.plain)
            .nudgeFont(.fieldText)
            .foregroundStyle(Color.nudgeForeground)
            if !dashboardCardSearchQuery.isEmpty {
                Button { dashboardCardSearchQuery = "" } label: {
                    Image(systemName: "xmark.circle.fill")
                        .nudgeFont(.fieldIcon)
                        .foregroundStyle(Color.nudgeTextDim)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .background(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(Color.nudgeForeground.opacity(0.06))
        )
        .padding(.horizontal, 12)
        .padding(.bottom, 8)
    }

    @ViewBuilder
    private var dashboardCardsTagChips: some View {
        // 橫向 scrollable chip 列。窄欄寬不適合 FlowLayout 折行，改成
        // 一條橫向 strip — 最右側多 1 顆 clear 鍵清空。
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                ForEach(dashboardCardAllTags) { tag in
                    let active = dashboardCardSelectedTagIds.contains(tag.id)
                    Button {
                        if active {
                            dashboardCardSelectedTagIds.remove(tag.id)
                        } else {
                            dashboardCardSelectedTagIds.insert(tag.id)
                        }
                    } label: {
                        Text(verbatim: tag.name)
                            .nudgeFont(.chipLabel)
                            .foregroundStyle(active ? Color.nudgePrimaryForeground : Color.nudgeForeground)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 5)
                            .background(
                                Capsule()
                                    .fill(active ? Color.nudgePrimary : Color.nudgeForeground.opacity(0.06))
                            )
                    }
                    .buttonStyle(.plain)
                }
                if !dashboardCardSelectedTagIds.isEmpty {
                    Button {
                        dashboardCardSelectedTagIds.removeAll()
                    } label: {
                        HStack(spacing: 3) {
                            Image(systemName: "xmark")
                                .nudgeFont(.chipLabel)
                            Text("common.clear", bundle: .module)
                                .nudgeFont(.chipLabel)
                        }
                        .foregroundStyle(Color.nudgePrimary)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 5)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 12)
        }
        .padding(.bottom, 8)
    }

    private func loadDashboardCardTags() async {
        do {
            dashboardCardAllTags = try await tagRepo.list()
        } catch {
            if !APIError.isCancellation(error) {
                print("[DailyHostView] dashboard tags load failed: \(error)")
            }
        }
    }

    private func debounceDashboardCardSearch() async {
        try? await Task.sleep(nanoseconds: 300_000_000)
        if !Task.isCancelled {
            dashboardCardDebouncedQuery = dashboardCardSearchQuery
                .trimmingCharacters(in: .whitespaces)
        }
    }

    private func fetchDashboardCardSearch() async {
        let q = dashboardCardDebouncedQuery
        let tagIds = Array(dashboardCardSelectedTagIds)
        guard !q.isEmpty || !tagIds.isEmpty else {
            dashboardCardSearchResults = []
            dashboardCardHasSearched = false
            return
        }
        dashboardCardSearchIsLoading = true
        do {
            let page = try await cardRepo.list(query: q, cursor: nil, tagIds: tagIds)
            dashboardCardSearchResults = page.cards
            dashboardCardHasSearched = true
        } catch {
            if !APIError.isCancellation(error) {
                print("[DailyHostView] dashboard card search failed: \(error)")
                dashboardCardSearchResults = []
                dashboardCardHasSearched = true
            }
        }
        dashboardCardSearchIsLoading = false
    }

    /// Daily 視圖頂端日期 header — 兩行 hierarchy：
    ///   1. eyebrow：weekday 全名（locale-aware），nudgeTextDim
    ///   2. H1：完整日期（年月日），nudgeForeground 大字
    /// 統一用 weekday 跟 dateTitle font tokens，受 ⌘+/- 字級縮放影響。
    /// 對齊 Heptabase / Things-style mac app 的 page header 慣例：日期
    /// 用大字、week strip / content 跟著。
    private var dashboardDateHeader: some View {
        let date = DateFormatters.parseISODate(selectedDate) ?? Date()
        let weekday = date.formatted(.dateTime.weekday(.wide).locale(locale))
        let fullDate = date.formatted(
            .dateTime.year().month(.wide).day().locale(locale)
        )
        return VStack(alignment: .leading, spacing: 4) {
            Text(verbatim: weekday)
                .nudgeFont(.dateEyebrow)
                .foregroundStyle(Color.nudgeTextDim)
            Text(verbatim: fullDate)
                .nudgeFont(.dateTitle)
                .foregroundStyle(Color.nudgeForeground)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 24)
        .padding(.top, 16)
        .padding(.bottom, 12)
        .animation(.easeOut(duration: 0.2), value: selectedDate)
    }

    /// 「今天 (N)」section divider — 跟 OverdueSectionView header 視覺
    /// 對齊（同 sectionHeader font + nudgeTextDim 顏色 + 同 padding）。
    /// 純文字、不可展開（今天本來就是主要內容、不需要 collapsed by
    /// default）。
    private func todaySectionHeader(count: Int) -> some View {
        HStack(spacing: 6) {
            Text(String(
                format: nudgeLocalized("daily.todaySectionTitle", locale: locale),
                count
            ))
                .nudgeFont(.sectionHeader)
                .foregroundStyle(Color.nudgeTextDim)
            Spacer()
        }
        .padding(.horizontal, 24)
        .padding(.top, 12)
        .padding(.bottom, 6)
    }

    /// Cards 專用 header — 跟 dashboardColumnHeader 視覺一致 (同 font /
    /// padding / count style)，多右側放大鏡 toggle 來展開搜尋 / tag 區。
    /// 用既有 IconButton (44×44 hit target + a11y label) 對齊設計系統。
    /// 切換用 .easeOut(0.2) 動畫，跟 OverdueSection 展開動畫同 spec。
    private var dashboardCardsHeaderWithSearchToggle: some View {
        HStack(spacing: 6) {
            Text("daily.dashboardCardsTitle", bundle: .module)
                .nudgeFont(.columnTitle)
                .foregroundStyle(Color.nudgeForeground)
            if displayedDashboardCards.count > 0 {
                Text(verbatim: "\(displayedDashboardCards.count)")
                    .nudgeFont(.columnTitleAccessory)
                    .foregroundStyle(Color.nudgeTextDim)
            }
            Spacer()
            IconButton(
                systemName: dashboardCardSearchExpanded ? "magnifyingglass.circle.fill" : "magnifyingglass",
                accessibilityLabel: "cards.searchAria",
                foreground: dashboardCardSearchExpanded ? .nudgePrimary : .nudgeTextDim
            ) {
                withAnimation(.easeOut(duration: 0.2)) {
                    dashboardCardSearchExpanded.toggle()
                }
            }
        }
        // padding(.top, 16) 對齊左欄 dashboardDateHeader 的 padding(.top, 16)，
        // Recent Cards 跟 Friday eyebrow 同一條基準線。
        .padding(.horizontal, 16)
        .padding(.top, 16)
        .padding(.bottom, 10)
    }

    private func dashboardColumnHeader(titleKey: LocalizedStringKey, count: Int) -> some View {
        HStack(spacing: 6) {
            Text(titleKey, bundle: .module)
                .nudgeFont(.columnTitle)
                .foregroundStyle(Color.nudgeForeground)
            if count > 0 {
                Text(verbatim: "\(count)")
                    .nudgeFont(.columnTitleAccessory)
                    .foregroundStyle(Color.nudgeTextDim)
            }
            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.top, 14)
        .padding(.bottom, 10)
    }

    private func dashboardEmptyState(systemName: String, titleKey: LocalizedStringKey) -> some View {
        VStack(spacing: 10) {
            Image(systemName: systemName)
                .font(.title2)
                .foregroundStyle(Color.nudgeTextDim)
            Text(titleKey, bundle: .module)
                .nudgeFont(.emptyStateBody)
                .foregroundStyle(Color.nudgeTextDim)
                .multilineTextAlignment(.center)
        }
        .padding(20)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
    }

    private func dashboardCardRow(_ card: CardDTO) -> some View {
        Button { dashboardCardDetailCard = card } label: {
            VStack(alignment: .leading, spacing: 4) {
                cardTitleText(card)
                let preview = card.description.strippedHTML(maxLength: 90)
                if !preview.isEmpty {
                    Text(verbatim: preview)
                        .nudgeFont(.rowBody)
                        .foregroundStyle(Color.nudgeTextDim)
                        .lineLimit(2)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(Color.nudgeForeground.opacity(0.04))
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private func cardTitleText(_ card: CardDTO) -> some View {
        if card.title.isEmpty {
            Text("cards.untitled", bundle: .module)
                .nudgeFont(.rowTitleEmphasized)
                .italic()
                .foregroundStyle(Color.nudgeTextDim)
                .lineLimit(1)
        } else {
            Text(verbatim: card.title)
                .nudgeFont(.rowTitleEmphasized)
                .foregroundStyle(Color.nudgeForeground)
                .lineLimit(1)
        }
    }

    private func reloadDashboardCards() async {
        do {
            let result = try await cardRepo.list(query: "", cursor: nil)
            // 取前 12 張，避免右欄過長吃掉視覺重點。
            dashboardRecentCards = Array(result.cards.prefix(12))
        } catch {
            if !APIError.isCancellation(error) {
                print("[DailyHostView] dashboard cards load failed: \(error)")
            }
        }
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

    /// True when the user is viewing today's date — drives the "Move to
    /// today" entry visibility in TaskRowMenu (hidden when already today).
    private var isViewingToday: Bool {
        selectedDate == DateFormatters.isoDate(Date())
    }

    /// Locale-aware "month + year" eyebrow above the "任務" page title.
    /// Was hardcoded "04, 2026" which doesn't read like any locale's
    /// natural date. Now: "April 2026" / "2026年4月" / "2026 年 4 月".
    private var formattedSelectedDate: String {
        guard let date = DateFormatters.parseISODate(selectedDate) else {
            return selectedDate
        }
        return date.formatted(
            .dateTime.month(.wide).year().locale(locale)
        )
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
                // 樂觀更新只翻 isCompleted，row 還留在 overdueTasks 陣列裡。
                // 「前幾天」勾掉真正消失要靠 server side filter（overdueTasks
                // query 排除 isCompleted=true）—— 跑一次 silent reload 把
                // dailyData 跟 server 對齊。用 ETag conditional GET：304 就
                // no-op、200 才 swap。沒有 loadState 重設，避免重畫閃爍。
                await reloadSilently()
            } catch {
                // Revert on server failure — the row snaps back to its
                // original state instead of lying about persistence.
                applyAssignmentIsCompletedLocally(id: assignment.id, value: !newValue)
                print("[DailyHostView] toggleComplete failed: \(error)")
            }
        }
    }

    /// Like `reload()` but without `loadState = .loading` / `dailyData = nil`,
    /// so a fresh server payload silently swaps in without flashing the
    /// loading state. Used after PATCHes where we already did an optimistic
    /// flip — purpose is to reconcile with server side-effects (e.g. overdue
    /// rollup row dropping out after isCompleted flips to true). 304 →
    /// no-op (optimistic state matches server).
    private func reloadSilently() async {
        let requestedDate = selectedDate
        do {
            let data = try await taskRepo.dailyData(date: requestedDate)
            guard requestedDate == selectedDate else { return }
            dailyData = data
            lastUpdated = Self.currentTimeString()
        } catch APIError.notModified {
            // server confirms optimistic state — keep current dailyData
        } catch {
            if !APIError.isCancellation(error) {
                print("[DailyHostView] reloadSilently failed: \(error)")
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
            // Preserve `isSkipped` and `isRecurring` — the previous rewrap
            // dropped them to default `false` because the DTO init has
            // them as defaulted positional params, which silently broke
            // recurring rows after toggling complete (lost the "is
            // recurring" flag → row no longer shows the "Skip this
            // occurrence" menu entry).
            return DailyAssignmentDTO(
                id: a.id,
                taskId: a.taskId,
                date: a.date,
                isCompleted: value,
                isSkipped: a.isSkipped,
                sortOrder: a.sortOrder,
                isRecurring: a.isRecurring,
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

#if os(macOS)
/// 卡片欄內 detail — 自帶 back chevron + 編輯式標題 + EditorToolbar +
/// RichTextEditor，限縮在當下欄而不彈出全寬。重命名 / 排程 / tag 管理
/// 等進階動作不在這裡開放（避免 column 太擠）；使用者要全部功能可
/// 切到主 Cards tab。
private struct DashboardColumnCardDetail: View {
    let card: CardDTO
    let onUpdateTitle: (String) -> Void
    let onUpdateDescription: (String) -> Void
    let onBack: () -> Void

    @Environment(\.locale) private var locale
    @State private var title: String
    @State private var descriptionHTML: String
    @State private var titleSaveWorkItem: DispatchWorkItem?
    @State private var descSaveWorkItem: DispatchWorkItem?
    @State private var activeMarks = ActiveMarks()
    private let commandBus = EditorCommandBus()

    init(
        card: CardDTO,
        onUpdateTitle: @escaping (String) -> Void,
        onUpdateDescription: @escaping (String) -> Void,
        onBack: @escaping () -> Void
    ) {
        self.card = card
        self.onUpdateTitle = onUpdateTitle
        self.onUpdateDescription = onUpdateDescription
        self.onBack = onBack
        _title = State(initialValue: card.title)
        _descriptionHTML = State(initialValue: card.description)
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 8) {
                Button(action: onBack) {
                    Image(systemName: "chevron.left")
                        .font(.callout.weight(.medium))
                        .foregroundStyle(Color.nudgePrimary)
                        .frame(width: 28, height: 28)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .help(Text("common.back", bundle: .module))

                TextField(
                    "",
                    text: $title,
                    prompt: Text("cardDetail.untitled", bundle: .module)
                )
                .textFieldStyle(.plain)
                .nudgeFont(.columnDetailTitle)
                .foregroundStyle(Color.nudgeForeground)
                .onChange(of: title) { _, new in debouncedSaveTitle(new) }

                Spacer(minLength: 0)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Color.nudgeBackground)

            Divider()
                .background(Color.nudgeBorderLight)

            // 標準格式工具列 — 與 Notes / 全 Cards detail 共用 EditorToolbar
            // 元件，輸入體驗一致。
            EditorToolbar(
                activeMarks: activeMarks,
                commandBus: commandBus,
                onDismissKeyboard: nil
            )

            RichTextEditor(
                html: $descriptionHTML,
                placeholder: nudgeLocalized("cardDetail.editorPlaceholder", locale: locale),
                activeMarks: $activeMarks,
                commandBus: commandBus
            )
            .id(card.id)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .onChange(of: descriptionHTML) { _, new in debouncedSaveDescription(new) }
        }
        .background(Color.nudgeBackground)
    }

    private func debouncedSaveTitle(_ v: String) {
        titleSaveWorkItem?.cancel()
        let work = DispatchWorkItem { onUpdateTitle(v) }
        titleSaveWorkItem = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5, execute: work)
    }

    private func debouncedSaveDescription(_ v: String) {
        descSaveWorkItem?.cancel()
        let work = DispatchWorkItem { onUpdateDescription(v) }
        descSaveWorkItem = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5, execute: work)
    }
}
#endif

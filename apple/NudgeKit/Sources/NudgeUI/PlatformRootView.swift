import SwiftUI
import NudgeCore

/// 根 view：iOS 用 TabView + 5 個 tab；macOS 用 2 欄 NavigationSplitView
/// (sidebar | content)。Settings 在 macOS 改走 Settings { } scene
/// (⌘,)，不再佔 sidebar 一格；之前的 3 欄 detail 是空的「選擇項目」
/// placeholder，徒然佔螢幕——拿掉後 content 欄全寬呈現功能 view。
public struct PlatformRootView: View {
    @Bindable var auth: AuthRepository

    public init(auth: AuthRepository) {
        self.auth = auth
    }

    public var body: some View {
        #if os(iOS)
        IOSTabRoot(auth: auth)
            .tint(Color.nudgePrimary)
        #else
        MacSidebarRoot(auth: auth)
        #endif
    }
}

#if os(iOS)
/// Tab identity for the iOS tab bar. Used as `Tab(value:)` selection so
/// deep-link handlers (NotificationRouter) can switch tabs declaratively
/// instead of fighting `TabView` internal selection state.
public enum RootTab: Hashable {
    case tasks, calendar, cards, notes, search
}

struct IOSTabRoot: View {
    @Bindable var auth: AuthRepository
    @Environment(NotificationRouter.self) private var notificationRouter
    @State private var selectedTab: RootTab = .tasks

    // iOS 26 `Tab` API with a dedicated `.search` role — iOS renders
    // the search tab as the separated glass pill on the right of the
    // main tab bar (matches Apple Store / Photos / Reminders). The four
    // primary tabs keep their legacy order.
    var body: some View {
        TabView(selection: $selectedTab) {
            Tab(value: RootTab.tasks, role: nil) {
                DailyHostView(auth: auth)
            } label: {
                Label {
                    Text("nav.tasks", bundle: .module)
                } icon: {
                    Image(systemName: "checkmark.circle")
                }
            }

            Tab(value: RootTab.calendar, role: nil) {
                CalendarHostView()
            } label: {
                Label {
                    Text("nav.calendar", bundle: .module)
                } icon: {
                    Image(systemName: "calendar")
                }
            }

            Tab(value: RootTab.cards, role: nil) {
                CardsHostView()
            } label: {
                Label {
                    Text("nav.cards", bundle: .module)
                } icon: {
                    Image(systemName: "square.stack")
                }
            }

            Tab(value: RootTab.notes, role: nil) {
                NotesHostView()
            } label: {
                Label {
                    Text("nav.notes", bundle: .module)
                } icon: {
                    Image(systemName: "book")
                }
            }

            // Dedicated search tab — scope: cards-only for now (user
            // decision `A:(c)`). When widened to tasks/notes, the
            // search view routes internally over those repos.
            Tab(value: RootTab.search, role: .search) {
                CardSearchView()
            } label: {
                Label {
                    Text("common.search", bundle: .module)
                } icon: {
                    Image(systemName: "magnifyingglass")
                }
            }
        }
        .tint(Color.nudgePrimary)
        // Deep-link → tab switch only. The destination view (DailyHostView /
        // CardsHostView) keeps observing the same router flag and is the
        // one that calls `notificationRouter.clear()` after consuming the
        // intent — matches the existing `pendingNewTask` contract.
        .onChange(of: notificationRouter.pendingNewCard) { _, isPending in
            if isPending { selectedTab = .cards }
        }
        .onChange(of: notificationRouter.pendingNewTask) { _, isPending in
            if isPending { selectedTab = .tasks }
        }
        .onChange(of: notificationRouter.pendingTaskId) { _, taskId in
            if taskId != nil { selectedTab = .tasks }
        }
    }
}
#else
public enum SidebarItem: String, Hashable, CaseIterable {
    case today, calendar, cards, notes, settings
}

struct MacSidebarRoot: View {
    @Bindable var auth: AuthRepository
    // Ideally this lives in @SceneStorage so the sidebar selection
    // persists across window restores; @State is fine for now since
    // restoring to "Today" is a sensible default anyway.
    @State private var selection: SidebarItem = .today

    /// Sidebar 顯示狀態 — 綁 NavigationSplitView。視窗變窄時自動收成
    /// .detailOnly（見 body 的 GeometryReader），避免 sidebar 進 overlay
    /// 蓋住內容。
    @State private var columnVisibility: NavigationSplitViewVisibility = .all
    /// 目前是否處於窄視窗區間 — 用來偵測「寬↔窄交界」，只在跨界時自動
    /// 切 columnVisibility，同一區間內手動展開/收合 sidebar 不被覆蓋。
    @State private var sidebarIsNarrow = false

    /// Cards 是否在全頁編輯 — 全頁時 root toolbar 的「+」換成返回鈕。
    /// 由 CardsHostView 的 onFullPageChange 回報。
    @State private var cardsFullPageActive = false

    // Toolbar state lifted from individual hosts. Previously each host
    // declared its own `.toolbar { }` on the active branch, which let
    // toolbar items bubble up into NavigationSplitView's shared
    // NSToolbar. When the user switched sidebar selection, host A's
    // items "detached" and host B's "attached" — NSToolbar's identity
    // cache got confused and snapped `.primaryAction` items back to
    // their default leading position (the `.principal Spacer` push-to-
    // trailing hack stopped applying). Symptom: after one tab switch,
    // Daily toolbar items jumped from trailing to leading.
    //
    // Fix D: declare a single `.toolbar { }` at the root level and
    // switch its contents on `selection`. The toolbar itself is never
    // remounted — only its items swap — so NSToolbar can't lose the
    // push-to-trailing layout. Per-host shared state arrives via
    // matching @AppStorage keys (UserDefaults syncs both sides) or
    // NotificationCenter (existing menu-command pattern).
    @AppStorage("daily.mac.rightPanelOpen") private var dashboardRightPanelOpen: Bool = false
    @AppStorage("daily.mac.rightPanelKind") private var dashboardRightPanelKindRaw: String = "calendar"
    @AppStorage(CalendarPreferenceKey.viewMode) private var calendarModeRaw: String = CalendarViewMode.day.rawValue

    // 排程 modal — 在 root 層級用 overlay 渲染（而非 DailyHostView `.sheet`），
    // 這樣 dim backdrop 蓋得到整個 window、「點 modal 外取消」才有「外面」
    // 可點。macOS `.sheet` size-to-content、撐不開、沒有可點的外部區域。
    @Environment(CardRepository.self) private var cardRepo
    @State private var scheduleRequest: ScheduleSheetRequest?
    @State private var scheduleRemindAt: String?
    @State private var taskPopoverAssignment: DailyAssignmentDTO?
    @State private var quickAddVisible = false
    @State private var quickAddText = ""
    @State private var moveToDateAssignment: DailyAssignmentDTO?

    var body: some View {
        // 2 欄 NavigationSplitView。content view 自己負責 NavigationStack
        // 與 push detail (Cards/Daily 在 detail 內 push 卡片頁)。
        // 之前是 3 欄但 detail 永遠顯示「選擇項目」placeholder，被
        // 拿掉。
        NavigationSplitView(columnVisibility: $columnVisibility) {
            // 自畫 row（Button + listRowBackground）—— 不用 List(selection:)
            // 的系統選中：macOS sidebar 系統選中色吃「系統 accent」，使用者把
            // 系統 accent 設成藍色時連 app AccentColor 都會被蓋掉。改自畫才能
            // 不管系統設定都用主色。detail 切換仍靠 `selection` state（ZStack）。
            List {
                Section {
                    sidebarRow(.today, "nav.tasks", "checkmark.circle")
                    sidebarRow(.calendar, "nav.calendar", "calendar")
                    sidebarRow(.cards, "nav.cards", "square.stack")
                    sidebarRow(.notes, "nav.notes", "book")
                }
                // Settings 同時保留在 ⌘, Settings scene 與 sidebar。
                Section {
                    sidebarRow(.settings, "nav.settings", "gearshape")
                }
            }
            .listStyle(.sidebar)
            .navigationTitle(Text(verbatim: "Nudge"))
            .navigationSplitViewColumnWidth(min: 180, ideal: 220, max: 280)
        } detail: {
            // ZStack + opacity 讓 5 個 detail view 永遠 mounted，
            // @State / HSplitView drag 位置 / NavigationStack path 等
            // 切換 sidebar 時不會被 destroy。代價：所有 view 在 app
            // 啟動時就 mount、各自 .task 各跑一次（fetch 五份資料）。
            // 對使用者而言，「切回行動頁版位還在」遠比啟動快幾百
            // 毫秒重要。
            // 參考：Apple Dev Forums "Preserving navigation state in
            // NavigationSplitView detail" + Hacking with Swift forums。
            // 每個 host 傳 embedded: !isActive — Mac sidebar ZStack 同時
            // mount 全部 5 個 host（保留 navigation state），但 inactive
            // host 的 .toolbar items 會 bubble 上來污染外層 NavigationSplitView
            // 共用 toolbar。embedded=true 讓 inactive host 跳過自己的
            // chrome (toolbar / navigationTitle)，只留 active 那個貢獻
            // toolbar items。SettingsView 沒 toolbar items 不需要這個。
            ZStack {
                detailHost(.today, isActive: selection == .today) {
                    DailyHostView(auth: auth, embedded: selection != .today)
                }
                detailHost(.calendar, isActive: selection == .calendar) {
                    CalendarHostView(embedded: selection != .calendar)
                }
                detailHost(.cards, isActive: selection == .cards) {
                    CardsHostView(
                        embedded: selection != .cards,
                        onFullPageChange: { cardsFullPageActive = $0 }
                    )
                }
                detailHost(.notes, isActive: selection == .notes) {
                    NotesHostView(embedded: selection != .notes)
                }
                detailHost(.settings, isActive: selection == .settings) {
                    SettingsView(auth: auth)
                }
            }
            .toolbar { rootToolbar }
        }
        // 視窗變窄時自動收合 sidebar。只在「寬↔窄」交界時動作（用
        // sidebarIsNarrow 記住目前區間），所以在同一寬度區間內手動展開
        // / 收合 sidebar 不會被覆蓋。門檻 1000：視窗 min 寬 900，900~1000
        // 自動收起、≥1000 才並排，避免 sidebar 進 overlay 蓋住內容。
        // 用 onGeometryChange（macOS 15+，專門偵測尺寸、可靠）量視窗寬度。
        // 先前用 .background(GeometryReader{ onChange }) 不穩：resize 後
        // onChange 不一定 fire（debug 版剛好因每次多寫一個 state 才一直
        // 觸發）。onGeometryChange 是正解。
        .onGeometryChange(for: CGFloat.self) { proxy in
            proxy.size.width
        } action: { width in
            let narrow = width < 1000
            if narrow != sidebarIsNarrow {
                sidebarIsNarrow = narrow
                columnVisibility = narrow ? .detailOnly : .all
            }
        }
        // Mac sidebar selection should track the user's system accent
        // (Appearance preferences). The previous version forced
        // .nudgePrimary (orange), overriding the user's accent.
        .onReceive(NotificationCenter.default.publisher(for: NudgeCommands.switchTabNotification)) { note in
            if let raw = note.object as? String, let item = SidebarItem(rawValue: raw) {
                selection = item
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: NudgeCommands.openScheduleNotification)) { note in
            if let req = note.object as? ScheduleSheetRequest {
                scheduleRemindAt = req.remindAt
                scheduleRequest = req
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: NudgeCommands.openTaskPopoverNotification)) { note in
            if let assignment = note.object as? DailyAssignmentDTO {
                taskPopoverAssignment = assignment
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: NudgeCommands.openQuickAddNotification)) { _ in
            quickAddText = ""
            quickAddVisible = true
        }
        .onReceive(NotificationCenter.default.publisher(for: NudgeCommands.openMoveToDateNotification)) { note in
            if let assignment = note.object as? DailyAssignmentDTO {
                moveToDateAssignment = assignment
            }
        }
        // Modal 用 custom `.overlay` 呈現（不是 `.sheet`）— 因為 mac `.sheet`
        // 撐不到全視窗、沒有可點的「外面」。代價：overlay 是 SwiftUI content
        // 層、蓋不到 NSToolbar（titlebar 層）→ 用 rootToolbar 的 modalShowing
        // 把 toolbar 清空來補。`.animation` 掛在 Group 內部、不掛
        // NavigationSplitView（掛外層會跟 navigation push 轉場打架、跑版）。
        .overlay {
            Group {
                if let req = scheduleRequest {
                    NudgeModalOverlay(onDismiss: { closeScheduleModal() }) {
                        ScheduleEditSheet(
                            taskId: req.taskId,
                            taskTitle: req.taskTitle,
                            initialAbsoluteRemindAt: $scheduleRemindAt,
                            onChangeAbsoluteRemindAt: { newValue in
                                Task {
                                    do {
                                        try await cardRepo.updateRemindAt(cardId: req.taskId, remindAt: newValue)
                                    } catch {
                                        print("[MacSidebarRoot] updateRemindAt failed: \(error)")
                                    }
                                }
                            },
                            onRecurrenceChanged: { _ in
                                NotificationCenter.default.post(
                                    name: NudgeCommands.scheduleClosedNotification, object: nil
                                )
                            },
                            onDone: { closeScheduleModal() }
                        )
                        .frame(width: 480, height: 560)
                    }
                } else if let assignment = taskPopoverAssignment {
                    NudgeModalOverlay(onDismiss: { taskPopoverAssignment = nil }) {
                        TaskPopoverView(
                            assignment: assignment,
                            onExpand: {
                                taskPopoverAssignment = nil
                                NotificationCenter.default.post(
                                    name: NudgeCommands.expandTaskNotification, object: assignment
                                )
                            }
                        )
                        .frame(width: 680, height: 640)
                    }
                } else if quickAddVisible {
                    NudgeModalOverlay(onDismiss: { quickAddVisible = false }) {
                        QuickAddTaskSheet(
                            text: $quickAddText,
                            onSubmit: {
                                let title = quickAddText.trimmingCharacters(in: .whitespaces)
                                guard !title.isEmpty else { return }
                                NotificationCenter.default.post(
                                    name: NudgeCommands.submitQuickAddNotification, object: title
                                )
                                quickAddVisible = false
                            },
                            onCancel: { quickAddVisible = false }
                        )
                        .frame(width: 460, height: QuickAddTaskSheet.fittedHeight)
                    }
                } else if let assignment = moveToDateAssignment {
                    NudgeModalOverlay(onDismiss: { moveToDateAssignment = nil }) {
                        MoveToDatePickerView(
                            initialDate: assignment.date,
                            onPick: { newDate in
                                NotificationCenter.default.post(
                                    name: NudgeCommands.moveToDateNotification,
                                    object: MoveToDateResult(assignment: assignment, date: newDate)
                                )
                                moveToDateAssignment = nil
                            },
                            onCancel: { moveToDateAssignment = nil }
                        )
                        .frame(width: 400, height: 480)
                    }
                }
            }
            .animation(.easeOut(duration: 0.18), value: scheduleRequest != nil)
            .animation(.easeOut(duration: 0.18), value: taskPopoverAssignment != nil)
            .animation(.easeOut(duration: 0.18), value: quickAddVisible)
            .animation(.easeOut(duration: 0.18), value: moveToDateAssignment != nil)
        }
    }

    private func closeScheduleModal() {
        scheduleRequest = nil
        // DailyHostView 收到後 reload daily（recurrence / reminder 變動校正）。
        NotificationCenter.default.post(
            name: NudgeCommands.scheduleClosedNotification, object: nil
        )
    }

    /// 任何 custom-overlay modal 開啟中。
    private var modalShowing: Bool {
        scheduleRequest != nil
            || taskPopoverAssignment != nil
            || quickAddVisible
            || moveToDateAssignment != nil
    }

    /// 自畫 sidebar row：Button 設 selection + listRowBackground 主色選中底。
    @ViewBuilder
    private func sidebarRow(
        _ item: SidebarItem,
        _ titleKey: LocalizedStringKey,
        _ icon: String
    ) -> some View {
        let isSel = selection == item
        Button {
            selection = item
        } label: {
            Label {
                Text(titleKey, bundle: .module)
            } icon: {
                Image(systemName: icon)
            }
            .foregroundStyle(Color.nudgeForeground) // 選中字維持原色，只靠淡底表示選中
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, 2)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .listRowBackground(
            Group {
                if isSel {
                    // 左右內縮 + 圓角 pill，對齊原生 sidebar 選中外觀（不貼邊）。
                    RoundedRectangle(cornerRadius: 6, style: .continuous)
                        .fill(Color.nudgePrimary.opacity(0.18)) // 淡底，不搶主畫面
                        .padding(.horizontal, 8)
                        .padding(.vertical, 1)
                } else {
                    Color.clear
                }
            }
        )
    }

    @ToolbarContentBuilder
    private var rootToolbar: some ToolbarContent {
        // Modal (custom overlay) 開啟時清空 toolbar — NSToolbar 在 AppKit
        // titlebar 層、SwiftUI overlay 蓋不到它，不清空會「浮」在 modal 上。
        // 清空後 modal 視覺上才在最上層；關閉後 items 回來。
        if modalShowing {
            settingsToolbar // 空 placeholder
        } else {
            // switch over selection — @ToolbarContentBuilder turns this
            // into a single discriminator, avoiding the deeply-nested
            // EitherToolbarContent the type-checker times out on for long
            // if/else-if chains. .settings emits no items.
            switch selection {
            case .today: dailyToolbar
            case .calendar: calendarToolbar
            case .cards: cardsToolbar
            case .notes: notesToolbar
            case .settings: settingsToolbar
            }
        }
    }

    /// SettingsView 沒 toolbar items；ToolbarContentBuilder switch 需要
    /// 每個 case 都 emit ToolbarContent，所以塞一個空的 placeholder
    /// (`Spacer()` 在 `.principal` 不會佔位也不渲染按鈕)。
    @ToolbarContentBuilder
    private var settingsToolbar: some ToolbarContent {
        ToolbarItem(placement: .principal) { EmptyView() }
    }

    @ToolbarContentBuilder
    private var dailyToolbar: some ToolbarContent {
        ToolbarItemGroup(placement: .navigation) {
            Button { NotificationCenter.default.post(name: NudgeCommands.prevWeekNotification, object: nil) } label: {
                Image(systemName: "chevron.left")
            }
            .help(Text("daily.prevWeekAria", bundle: .module))

            Button { NotificationCenter.default.post(name: NudgeCommands.todayNotification, object: nil) } label: {
                Text("daily.todayButton", bundle: .module)
            }
            .help(Text("daily.todayAria", bundle: .module))

            Button { NotificationCenter.default.post(name: NudgeCommands.nextWeekNotification, object: nil) } label: {
                Image(systemName: "chevron.right")
            }
            .help(Text("daily.nextWeekAria", bundle: .module))
        }
        // 推 primaryAction 到 trailing — 同 DailyHostView 原本的 hack。
        // 因為這個 .toolbar { } 掛在 NavigationSplitView、不會被 host
        // 切換 unmount，NSToolbar 不會錯用 cache、Spacer push 持續生效。
        if #available(macOS 26.0, *) {
            ToolbarSpacer(.flexible, placement: .primaryAction)
        } else {
            ToolbarItem(placement: .principal) {
                Spacer()
            }
        }
        ToolbarItem(placement: .primaryAction) {
            Toggle(isOn: $dashboardRightPanelOpen) {
                // 13pt（picker 的 calendar/cards 是 16pt）— sidebar.right
                // glyph 視覺重量比較重，縮小才跟隔壁 icon 看起來一樣大。
                Image(systemName: "sidebar.right")
                    .font(.system(size: 13, weight: .regular))
                    .symbolRenderingMode(.monochrome)
            }
            .toggleStyle(.button)
            .tint(Color.nudgePrimary)
            .help(Text("daily.toggleRightPanel", bundle: .module))
        }
        if dashboardRightPanelOpen {
            if #available(macOS 26.0, *) {
                ToolbarSpacer(.fixed, placement: .primaryAction)
            }
            ToolbarItem(placement: .primaryAction) {
                // 三個 toolbar icon (sidebar toggle / calendar / cards) 統一
                // `.font(.system(size: 16, weight: .regular))` +
                // `.symbolRenderingMode(.monochrome)` 強制等大、等粗、單色
                // 渲染。SF symbol 內在密度差異 (calendar 有格線 + 日期數字、
                // square.stack 是實心堆疊) 無法完全抹平，但鎖住 point size
                // / weight 後不會再因 toolbar 預設行為各自漂移。
                Picker(selection: $dashboardRightPanelKindRaw) {
                    Image(systemName: "calendar")
                        .font(.system(size: 16, weight: .regular))
                        .symbolRenderingMode(.monochrome)
                        .accessibilityLabel(Text("nav.calendar", bundle: .module))
                        .tag("calendar")
                    Image(systemName: "square.stack")
                        .font(.system(size: 16, weight: .regular))
                        .symbolRenderingMode(.monochrome)
                        .accessibilityLabel(Text("nav.cards", bundle: .module))
                        .tag("cards")
                } label: {
                    EmptyView()
                }
                .pickerStyle(.palette)
                .tint(Color.nudgePrimary)
                .animation(.spring(response: 0.32, dampingFraction: 0.78), value: dashboardRightPanelKindRaw)
            }
        }
    }

    @ToolbarContentBuilder
    private var calendarToolbar: some ToolbarContent {
        ToolbarItem(placement: .primaryAction) {
            // 日｜週｜月 segmented — 直接點擊切換，取代原本的下拉 Menu。
            // palette style + nudgePrimary 對齊 dailyToolbar 的 calendar/
            // cards picker。綁 @AppStorage(viewMode)，CalendarHostView 讀
            // 同一個 key 即時跟著切。
            Picker(selection: $calendarModeRaw) {
                ForEach(CalendarViewMode.allCases) { m in
                    Text(m.labelKey, bundle: .module).tag(m.rawValue)
                }
            } label: {
                EmptyView()
            }
            .pickerStyle(.palette)
            .tint(Color.nudgePrimary)
            .help(Text("calendar.modePickerAria", bundle: .module))
        }
    }

    @ToolbarContentBuilder
    private var cardsToolbar: some ToolbarContent {
        if cardsFullPageActive {
            // 全頁編輯時：「+」換成返回鈕（leading）；同排（trailing）放
            // 「標籤 / 重複」功能鈕，點了 post notification → CardDetailView 開 sheet。
            ToolbarItem(placement: .navigation) {
                Button {
                    NotificationCenter.default.post(name: NudgeCommands.cardsBackNotification, object: nil)
                } label: {
                    Image(systemName: "chevron.left")
                }
                .help(Text("common.back", bundle: .module))
            }
            ToolbarItem(placement: .primaryAction) {
                Button {
                    NotificationCenter.default.post(name: NudgeCommands.cardsManageTagsNotification, object: nil)
                } label: {
                    Image(systemName: "tag")
                }
                .help(Text("cardDetail.manageTags", bundle: .module))
            }
            ToolbarItem(placement: .primaryAction) {
                Button {
                    NotificationCenter.default.post(name: NudgeCommands.cardsScheduleNotification, object: nil)
                } label: {
                    Image(systemName: "repeat")
                }
                .help(Text("cardDetail.schedule", bundle: .module))
            }
        } else {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    NotificationCenter.default.post(name: NudgeCommands.createCardNotification, object: nil)
                } label: {
                    Image(systemName: "plus")
                }
                .help(Text("cards.createAria", bundle: .module))
            }
        }
    }

    /// Notes Mac 版改成永久 split layout (list 左 + canvas 右)，feed/canvas
    /// 切換按鈕拿掉；ToolbarContentBuilder switch 每個 case 都得 emit 一個
    /// ToolbarContent，給空 placeholder 走形式。
    @ToolbarContentBuilder
    private var notesToolbar: some ToolbarContent {
        ToolbarItem(placement: .principal) { EmptyView() }
    }

    /// 把 detail host 包成 opacity 切換 + 禁掉非 active view 的 hit test
    /// 與 voice over，避免使用者隔山打牛點到背後 view 或 a11y 讀到非
    /// 顯示內容。`zIndex(isActive ? 1 : 0)` 確保 active view 永遠在最
    /// 上、shadow / popover 不被遮。
    @ViewBuilder
    private func detailHost<Content: View>(
        _ item: SidebarItem,
        isActive: Bool,
        @ViewBuilder content: () -> Content
    ) -> some View {
        content()
            .opacity(isActive ? 1 : 0)
            .allowsHitTesting(isActive)
            .accessibilityHidden(!isActive)
            .zIndex(isActive ? 1 : 0)
    }
}
#endif

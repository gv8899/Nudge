import SwiftUI
import NudgeCore

/// Root of the Calendar tab. Owns selectedDate, view mode, loaded events,
/// and the event detail sheet. Delegates rendering to Day/Week/Month
/// sub-views.
public struct CalendarHostView: View {
    @Environment(CalendarRepository.self) private var calendarRepo
    @Environment(\.scenePhase) private var scenePhase
    @AppStorage(CalendarPreferenceKey.viewMode) private var modeRaw: String = CalendarViewMode.day.rawValue

    @State private var selectedDate: String = DateFormatters.isoDate(Date())
    @State private var events: [CalendarEventDTO] = []
    @State private var weekDates: Set<String> = []
    @State private var isLoading = false
    @State private var selectedEvent: CalendarEventDTO?

    private let calendar: Calendar = {
        var c = Calendar(identifier: .gregorian)
        c.firstWeekday = 2
        return c
    }()

    /// 嵌入到 DailyHostView 右側面板用。為 true 時跳過 .toolbar /
    /// .navigationTitle，避免 modePicker bubble up 到 Daily 視窗 toolbar。
    private let embedded: Bool

    /// 從外層（DailyHostView）注入的日期。傳 value 而非 Binding 因為
    /// SwiftUI 對 Binding 沒有結構性 equality，子 view 不會因為 source
    /// state 變動而重新 render → .onChange 不會觸發。傳 String 才會讓
    /// CalendarHostView 在外層日期變更時 propagate update。
    /// 設了之後 calendar 隱藏內建的 WeekStripView（避免雙日期條）。
    /// Daily mac dashboard 用。
    private let externalSelectedDate: String?

    /// Event tap callback — 嵌入 Daily 右欄時，event detail 改由外層
    /// DailyHostView 顯示置中 overlay（blur backdrop + 大卡片）。傳此
    /// closure → CalendarHostView 不再 own 自己的 selectedEvent / popover。
    /// nil 時走內建 popover (mac) / sheet (iOS)，給 standalone Calendar tab 用。
    private let onEventTap: ((CalendarEventDTO) -> Void)?

    public init(
        embedded: Bool = false,
        externalSelectedDate: String? = nil,
        onEventTap: ((CalendarEventDTO) -> Void)? = nil
    ) {
        self.embedded = embedded
        self.externalSelectedDate = externalSelectedDate
        self.onEventTap = onEventTap
    }

    private var mode: CalendarViewMode {
        // 嵌入 Daily 右欄（externalSelectedDate 有值）時強制走 .day —
        // 這個位置是「今日行程」面板、永遠顯示選定日的事件列表。
        // 不能跟 standalone Calendar tab 共用 @AppStorage(viewMode)，
        // 否則 user 在 standalone 切到 month / week 後，右欄會變月曆 / 週曆。
        if externalSelectedDate != nil {
            return .day
        }
        return CalendarViewMode(rawValue: modeRaw) ?? .day
    }

    private var selectedDateObj: Date {
        DateFormatters.parseISODate(selectedDate) ?? Date()
    }

    private var rangeKey: String {
        let (s, e) = currentRange()
        return "\(mode.rawValue)|\(s)|\(e)"
    }

    public var body: some View {
        // embedded 時跳過 NavigationStack — macOS 上 NavigationStack 會
        // reserve invisible toolbar 區 + 透過 safe area inset propagate
        // up，把外層 VStack 的所有 sibling 往下推（包括 dashboardCalendarHeader），
        // 跟 cards column header 對不齊。embedded 沒 toolbar item 不需要
        // NavigationStack 容器；standalone 才需要它掛 modePicker / title。
        Group {
            if embedded {
                content
            } else {
                NavigationStack {
                    content
                }
            }
        }
        .task(id: rangeKey) { await reload() }
        .onAppear {
            if let ext = externalSelectedDate {
                selectedDate = ext
            }
        }
        .onChange(of: externalSelectedDate) { _, new in
            if let new { selectedDate = new }
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active {
                Task { await reload() }
            }
        }
        // Event detail presentation — embedded with onEventTap callback
        // 時，detail 改由外層 DailyHostView 畫 centered overlay；
        // standalone Calendar tab 仍用內建 popover (mac) / sheet (iOS)。
        // 條件包在 modeContent 的 onEventTap 處理 (見下方)；這裡的
        // popover/sheet 只在 callback nil 時才實際 present
        // (selectedEvent 永遠不會被 set 當 callback 存在)。
        #if os(macOS)
        .popover(item: $selectedEvent, arrowEdge: .top) { event in
            CalendarEventDetailSheet(event: event)
                .frame(width: 480, height: 380)
        }
        #else
        .sheet(item: $selectedEvent) { event in
            CalendarEventDetailSheet(event: event)
        }
        #endif
        #if os(macOS)
        .onReceive(NotificationCenter.default.publisher(for: NudgeCommands.switchCalendarModeNotification)) { note in
            if let raw = note.object as? String, CalendarViewMode(rawValue: raw) != nil {
                modeRaw = raw
            }
        }
        #endif
    }

    /// 把 chrome（toolbar / navigationTitle）跟 core content 拆出來，
    /// 才能用 embedded flag 條件套用。embedded = true 時不掛 toolbar /
    /// navigationTitle，避免 modePicker bubble 到外層 NavigationStack。
    @ViewBuilder
    private var content: some View {
        // Standalone calendar tab：自己鋪 nudgeBackground 確保整頁滿底色。
        // Embedded（嵌入 Daily 右欄）：底色由外層 dashboardRightPanel 的
        // `Color.nudgeForeground.opacity(0.025)` tint 提供，這裡不要再蓋
        // 一層 nudgeBackground、否則 tint 只會在 hidden header 那塊露出來。
        let core = Group {
            if !calendarRepo.isConnected {
                CalendarConnectPrompt(embedded: embedded)
            } else {
                modeContent
            }
        }
        .background(embedded ? Color.clear : Color.nudgeBackground)

        if embedded {
            // 嵌入 Daily 右欄時，dashboard header spacer 由外層
            // DailyHostView 用 `.hidden()` 真實 dashboardDateHeader 處理
            // （pixel-perfect 對齊），這裡不再自己估高度。
            core
        } else {
            // Mac mode picker 上提到 MacSidebarRoot 的 root toolbar；
            // iOS toolbar 行為不變（NavigationSplitView 沒這個 cache bug）。
            let titled = core
                .navigationTitle(Text("nav.calendar", bundle: .module))
                #if os(iOS)
                .navigationBarTitleDisplayMode(.inline)
                #endif

            #if os(iOS)
            titled
                .toolbar {
                    ToolbarItem(placement: .primaryAction) {
                        modePicker
                    }
                }
            #else
            titled
            #endif
        }
    }

    /// 統一處理 event 點擊：有外部 callback (embedded mode 由 DailyHostView
    /// 處理 centered overlay) 就轉給外部、否則 fall back 到內建 popover
    /// (selectedEvent state)。
    private func handleEventTap(_ event: CalendarEventDTO) {
        if let onEventTap {
            onEventTap(event)
        } else {
            selectedEvent = event
        }
    }

    @ViewBuilder
    private var modeContent: some View {
        switch mode {
        case .day:
            CalendarDayView(
                selectedDate: $selectedDate,
                weekDates: $weekDates,
                events: events,
                isLoading: isLoading,
                onWeekOffset: offsetWeek,
                onEventTap: handleEventTap,
                hideWeekStrip: externalSelectedDate != nil
            )
        case .week:
            let start = weekStart(selectedDateObj)
            let end = calendar.date(byAdding: .day, value: 6, to: start) ?? start
            CalendarWeekView(
                weekStart: start,
                weekEnd: end,
                events: events,
                isLoading: isLoading,
                onPrevWeek: { offsetWeek(-1) },
                onNextWeek: { offsetWeek(1) },
                onThisWeek: { selectedDate = DateFormatters.isoDate(Date()) },
                onEventTap: handleEventTap
            )
        case .month:
            CalendarMonthView(
                selectedDate: $selectedDate,
                monthAnchor: selectedDateObj,
                events: events,
                isLoading: isLoading,
                onPrevMonth: { offsetMonth(-1) },
                onNextMonth: { offsetMonth(1) },
                onThisMonth: { selectedDate = DateFormatters.isoDate(Date()) },
                onEventTap: handleEventTap,
                onDayDoubleTap: { _ in
                    modeRaw = CalendarViewMode.day.rawValue
                }
            )
        }
    }

    private var modePicker: some View {
        Menu {
            ForEach(CalendarViewMode.allCases) { m in
                Button {
                    modeRaw = m.rawValue
                } label: {
                    HStack {
                        if mode == m { Image(systemName: "checkmark") }
                        Text(m.labelKey, bundle: .module)
                    }
                }
            }
        } label: {
            // Explicit foregroundStyle overrides the
            // .tint(Color.nudgePrimary) inherited from PlatformRootView
            // — without this the glyph still picks up the orange tab
            // accent and outweighs the gear / pencil sibling toolbar
            // icons in other tabs.
            Image(systemName: "square.grid.2x2")
                .foregroundStyle(Color.nudgeForeground)
        }
        .help(Text("calendar.modePickerAria", bundle: .module))
    }

    private func currentRange() -> (String, String) {
        switch mode {
        case .day:
            // Fetch the whole week even for Day mode so the WeekStripView
            // can show event-indicator dots under every day with an event.
            let start = weekStart(selectedDateObj)
            let end = calendar.date(byAdding: .day, value: 6, to: start) ?? start
            return (DateFormatters.isoDate(start), DateFormatters.isoDate(end))
        case .week:
            let start = weekStart(selectedDateObj)
            let end = calendar.date(byAdding: .day, value: 6, to: start) ?? start
            return (DateFormatters.isoDate(start), DateFormatters.isoDate(end))
        case .month:
            let rows = CalendarMonthGrid.dates(forMonthContaining: selectedDateObj, calendar: calendar)
            let first = rows.first?.first ?? selectedDateObj
            let last = rows.last?.last ?? selectedDateObj
            return (DateFormatters.isoDate(first), DateFormatters.isoDate(last))
        }
    }

    private func weekStart(_ date: Date) -> Date {
        var c = calendar.dateComponents([.yearForWeekOfYear, .weekOfYear], from: date)
        c.weekday = calendar.firstWeekday
        return calendar.date(from: c) ?? date
    }

    private func offsetWeek(_ by: Int) {
        if let d = calendar.date(byAdding: .day, value: by * 7, to: selectedDateObj) {
            selectedDate = DateFormatters.isoDate(d)
        }
    }

    private func offsetMonth(_ by: Int) {
        if let d = calendar.date(byAdding: .month, value: by, to: selectedDateObj) {
            selectedDate = DateFormatters.isoDate(d)
        }
    }

    private func reload() async {
        let (start, end) = currentRange()
        isLoading = true
        defer { isLoading = false }
        do {
            events = try await calendarRepo.events(start: start, end: end)
            weekDates = Set(events.compactMap { event -> String? in
                guard let t = event.start.firstIndex(of: "T") else { return event.start }
                return String(event.start[..<t])
            })
        } catch {
            if APIError.isCancellation(error) { return }
            print("[CalendarHost] reload failed: \(error)")
            events = []
        }
    }
}

extension CalendarEventDTO: Identifiable {}

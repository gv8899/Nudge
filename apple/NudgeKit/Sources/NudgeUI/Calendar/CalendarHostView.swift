import SwiftUI
import NudgeCore

/// Root of the Calendar tab. Owns selectedDate, view mode, loaded events,
/// and the event detail sheet. Delegates rendering to Day/Week/Month
/// sub-views.
public struct CalendarHostView: View {
    @Environment(CalendarRepository.self) private var calendarRepo
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

    public init() {}

    private var mode: CalendarViewMode {
        CalendarViewMode(rawValue: modeRaw) ?? .day
    }

    private var selectedDateObj: Date {
        DateFormatters.parseISODate(selectedDate) ?? Date()
    }

    private var rangeKey: String {
        let (s, e) = currentRange()
        return "\(mode.rawValue)|\(s)|\(e)"
    }

    public var body: some View {
        NavigationStack {
            Group {
                if !calendarRepo.isConnected {
                    CalendarConnectPrompt()
                } else {
                    modeContent
                }
            }
            .background(Color.nudgeBackground)
            .navigationTitle(Text("nav.calendar", bundle: .module))
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    modePicker
                }
            }
        }
        .task(id: rangeKey) { await reload() }
        .sheet(item: $selectedEvent) { event in
            CalendarEventDetailSheet(event: event)
                #if os(macOS)
                // mac 端原本是裸 .sheet — 沒尺寸、無背景 token，
                // 視窗大小變不可預測。給最小尺寸 + token 背景。
                .frame(minWidth: 480, minHeight: 360)
                .background(Color.nudgeBackground)
                #endif
        }
        #if os(macOS)
        .onReceive(NotificationCenter.default.publisher(for: NudgeCommands.switchCalendarModeNotification)) { note in
            if let raw = note.object as? String, CalendarViewMode(rawValue: raw) != nil {
                modeRaw = raw
            }
        }
        #endif
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
                onEventTap: { selectedEvent = $0 }
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
                onEventTap: { selectedEvent = $0 }
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
                onEventTap: { selectedEvent = $0 },
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

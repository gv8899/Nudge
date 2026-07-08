import SwiftUI
import NudgeCore

/// Month grid (6 weeks × 7 days) + bottom event list for the selected
/// day. Padding days (prev/next month) are dimmed. Each cell shows up
/// to 3 event dots.
public struct CalendarMonthView: View {
    @Binding var selectedDate: String
    @Environment(\.locale) private var locale
    let monthAnchor: Date
    let events: [CalendarEventDTO]
    let isLoading: Bool
    let onPrevMonth: () -> Void
    let onNextMonth: () -> Void
    let onThisMonth: () -> Void
    let onEventTap: (CalendarEventDTO) -> Void
    let onDayDoubleTap: (String) -> Void

    private let calendar: Calendar = {
        var c = Calendar(identifier: .gregorian)
        c.firstWeekday = 2
        return c
    }()

    public init(
        selectedDate: Binding<String>,
        monthAnchor: Date,
        events: [CalendarEventDTO],
        isLoading: Bool,
        onPrevMonth: @escaping () -> Void,
        onNextMonth: @escaping () -> Void,
        onThisMonth: @escaping () -> Void,
        onEventTap: @escaping (CalendarEventDTO) -> Void,
        onDayDoubleTap: @escaping (String) -> Void
    ) {
        _selectedDate = selectedDate
        self.monthAnchor = monthAnchor
        self.events = events
        self.isLoading = isLoading
        self.onPrevMonth = onPrevMonth
        self.onNextMonth = onNextMonth
        self.onThisMonth = onThisMonth
        self.onEventTap = onEventTap
        self.onDayDoubleTap = onDayDoubleTap
    }

    private var grid: [[Date]] {
        CalendarMonthGrid.dates(forMonthContaining: monthAnchor, calendar: calendar)
    }

    private var todayIso: String { DateFormatters.isoDate(Date()) }
    private var monthComponent: Int { calendar.component(.month, from: monthAnchor) }

    /// Pre-compute events grouped by ISO date so each of the 42 cells
    /// does an O(1) dict lookup instead of an O(N) linear scan. Without
    /// this, a month with 30 events meant ~1260 string-prefix checks
    /// per render, which spiked CPU on month flip.
    private var eventsByDate: [String: [CalendarEventDTO]] {
        Dictionary(grouping: events, by: { String($0.start.prefix(10)) })
    }

    public var body: some View {
        VStack(spacing: 0) {
            header
            weekdayHeader
            gridView
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }

    private var header: some View {
        HStack {
            IconButton(
                systemName: "chevron.left",
                accessibilityLabel: "calendar.prevMonth",
                action: onPrevMonth
            )
            Spacer()
            Text(verbatim: monthTitle)
                .nudgeFont(.columnTitle)
                .foregroundStyle(Color.nudgeForeground)
            Spacer()
            Button(action: onThisMonth) {
                Text("calendar.today", bundle: .module)
                    .nudgeFont(.inlineButtonLabel)
                    // Match SettingsView / WeekView "本週" — text buttons
                    // use foreground colour, not the brand accent, so the
                    // page only spends primary on selection markers.
                    .foregroundStyle(Color.nudgeForeground)
                    .frame(minHeight: 44)
                    .padding(.horizontal, 8)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            IconButton(
                systemName: "chevron.right",
                accessibilityLabel: "calendar.nextMonth",
                action: onNextMonth
            )
        }
        .padding(.horizontal, 8)
    }

    private var monthTitle: String {
        let fmt = DateFormatter()
        fmt.dateFormat = "yyyy 年 M 月"
        return fmt.string(from: monthAnchor)
    }

    private var weekdayHeader: some View {
        let keys: [LocalizedStringKey] = [
            "weekday.mon", "weekday.tue", "weekday.wed",
            "weekday.thu", "weekday.fri", "weekday.sat", "weekday.sun"
        ]
        return HStack(spacing: 0) {
            ForEach(0..<7, id: \.self) { i in
                Text(keys[i], bundle: .module)
                    .nudgeFont(.weekdayLabel)
                    .foregroundStyle(Color.nudgeTextDim)
                    .frame(maxWidth: .infinity)
            }
        }
        .padding(.vertical, 4)
    }

    private var gridView: some View {
        VStack(spacing: 0) {
            ForEach(0..<grid.count, id: \.self) { row in
                HStack(spacing: 0) {
                    ForEach(0..<grid[row].count, id: \.self) { col in
                        cell(date: grid[row][col])
                    }
                }
                // 每週列等高分配剩餘高度 — 格子才夠高放事件 bar
                // （TimeTree 月檢視風格）。
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .padding(.horizontal, 4)
        .frame(maxHeight: .infinity)
    }

    /// 一格最多顯示幾條事件 bar，超過用「+N」收尾（TimeTree 月檢視風格）。
    private let maxBarsPerCell = 3

    private func cell(date: Date) -> some View {
        let iso = DateFormatters.isoDate(date)
        let day = calendar.component(.day, from: date)
        let isSelected = iso == selectedDate
        let isToday = iso == todayIso
        let isPad = calendar.component(.month, from: date) != monthComponent
        let dayEvents = eventsByDate[iso] ?? []

        return VStack(spacing: 3) {
            ZStack {
                if isToday {
                    Circle().fill(Color.nudgePrimary)
                        .frame(width: 24, height: 24)
                } else if isSelected {
                    Circle().stroke(Color.nudgeForeground, lineWidth: 2)
                        .frame(width: 24, height: 24)
                }
                Text(verbatim: "\(day)")
                    .nudgeFont(isToday ? .rowTitleEmphasized : .rowTitle)
                    .foregroundStyle(dayColor(isToday: isToday, isPad: isPad))
            }
            .frame(height: 26)

            // 事件直接列在當天格子內（標題 bar）。超過上限顯示「+N」。
            VStack(spacing: 2) {
                ForEach(Array(dayEvents.prefix(maxBarsPerCell))) { event in
                    eventBar(event)
                }
                if dayEvents.count > maxBarsPerCell {
                    Text(verbatim: "+\(dayEvents.count - maxBarsPerCell)")
                        .nudgeFont(.chipLabel)
                        .foregroundStyle(Color.nudgeTextDim)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.leading, 4)
                }
            }

            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .padding(.horizontal, 3)
        .padding(.top, 4)
        // 選中日整格淡底，跟日期圈一起讓選取狀態更明顯。
        .background(isSelected ? Color.nudgeForeground.opacity(0.04) : Color.clear)
        .clipped()
        .contentShape(Rectangle())
        // 點格子空白處：選日；再點同一天 → 切到日檢視。事件 bar 是獨立
        // Button，會優先吃掉點擊、不觸發這裡的選日。
        .onTapGesture {
            if isSelected {
                onDayDoubleTap(iso)
            } else {
                selectedDate = iso
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel(Text(date, format: .dateTime.year().month().day()))
        .accessibilityValue(a11yValue(count: dayEvents.count, isToday: isToday))
    }

    /// 格子內單一事件 bar — 點擊開事件 detail。過去事件以半透明
    /// primary 呈現（淡化但仍可讀），對齊 day/week 的 past 處理。
    private func eventBar(_ event: CalendarEventDTO) -> some View {
        let past = isPast(event.end)
        return Button { onEventTap(event) } label: {
            Text(verbatim: event.title)
                .nudgeFont(.rowMeta)
                .foregroundStyle(past ? Color.nudgeTextDim : Color.nudgePrimaryForeground)
                .lineLimit(1)
                .truncationMode(.tail)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 4)
                .padding(.vertical, 2)
                .background(
                    RoundedRectangle(cornerRadius: 4, style: .continuous)
                        .fill(past ? Color.nudgePrimary.opacity(0.3) : Color.nudgePrimary)
                )
        }
        .buttonStyle(.plain)
    }

    private func a11yValue(count: Int, isToday: Bool) -> Text {
        // Compose VoiceOver value: "today, 3 events" / "3 events" / "today" / ""
        var parts: [String] = []
        if isToday { parts.append(nudgeLocalized("calendar.today", locale: locale)) }
        if count > 0 {
            let template = nudgeLocalized("calendar.eventCount %lld", locale: locale)
            parts.append(String(format: template, count))
        }
        return Text(verbatim: parts.joined(separator: "・"))
    }

    private func dayColor(isToday: Bool, isPad: Bool) -> Color {
        if isToday { return .nudgePrimaryForeground }
        // Padding days: single-stage dim (was .nudgeTextDim.opacity(0.5)
        // — two stages of dim stacked failed WCAG AA contrast).
        if isPad { return .nudgeTextDim }
        return .nudgeForeground
    }

    /// 跟 CalendarDayView / WeekView 共用的判斷邏輯。
    private func isPast(_ endIso: String) -> Bool {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = f.date(from: endIso) { return d < Date() }
        f.formatOptions = [.withInternetDateTime]
        return f.date(from: endIso).map { $0 < Date() } ?? false
    }
}

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

    private var selectedDayEvents: [CalendarEventDTO] {
        eventsByDate[selectedDate] ?? []
    }

    public var body: some View {
        VStack(spacing: 0) {
            header
            weekdayHeader
            gridView
            Divider().background(Color.nudgeBorderLight)
            bottomList
            Spacer(minLength: 0)
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
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Color.nudgeForeground)
            Spacer()
            Button(action: onThisMonth) {
                Text("calendar.today", bundle: .module)
                    .font(.footnote)
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
                    .font(.caption2)
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
            }
        }
        .padding(.horizontal, 4)
    }

    private func cell(date: Date) -> some View {
        let iso = DateFormatters.isoDate(date)
        let day = calendar.component(.day, from: date)
        let isSelected = iso == selectedDate
        let isToday = iso == todayIso
        let isPad = calendar.component(.month, from: date) != monthComponent
        let count = eventsByDate[iso]?.count ?? 0

        return Button {
            if isSelected {
                onDayDoubleTap(iso)
            } else {
                selectedDate = iso
            }
        } label: {
            VStack(spacing: 2) {
                ZStack {
                    if isToday {
                        // Today reads as a filled accent disc — strongest
                        // visual marker of the page.
                        Circle().fill(Color.nudgePrimary)
                            .frame(width: 28, height: 28)
                    } else if isSelected {
                        // Selected (but not today) gets a 2pt foreground
                        // stroke — was 1pt borderLight, which on dark
                        // mode was indistinguishable from background and
                        // left the user with no confirmation of selection.
                        Circle().stroke(Color.nudgeForeground, lineWidth: 2)
                            .frame(width: 28, height: 28)
                    }
                    // Day digit upgraded from .footnote (~13pt) to
                    // .subheadline (~15pt): a calendar's primary visual
                    // info is the date number, the previous size made
                    // it the weakest text on the page.
                    Text(verbatim: "\(day)")
                        .font(.subheadline.weight(isToday ? .semibold : .regular))
                        .foregroundStyle(dayColor(isToday: isToday, isPad: isPad))
                }
                dots(count: count)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 48)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(Text(date, format: .dateTime.year().month().day()))
        .accessibilityValue(a11yValue(count: count, isToday: isToday))
        .accessibilityAddTraits(isSelected ? .isSelected : [])
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

    private func dots(count: Int) -> some View {
        HStack(spacing: 2) {
            if count == 0 {
                Color.clear.frame(width: 4, height: 4)
            } else if count <= 3 {
                ForEach(0..<count, id: \.self) { _ in
                    Circle().fill(Color.nudgePrimary).frame(width: 4, height: 4)
                }
            } else {
                // Token-aligned font (was hard-coded .system(size: 8))
                // — now respects Dynamic Type and matches the rest of
                // the calendar's caption hierarchy.
                Text(verbatim: "···")
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(Color.nudgePrimary)
            }
        }
        .frame(height: 6)
    }

    @ViewBuilder
    private var bottomList: some View {
        if isLoading {
            ProgressView().padding(20)
        } else if selectedDayEvents.isEmpty {
            Text("calendar.panelEmpty", bundle: .module)
                .font(.caption)
                .foregroundStyle(Color.nudgeTextDim)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(16)
        } else {
            ScrollView {
                VStack(spacing: 8) {
                    ForEach(selectedDayEvents, id: \.id) { event in
                        let past = isPast(event.end)
                        let textColor: Color = past ? Color.nudgeTextDim : Color.nudgeForeground
                        Button { onEventTap(event) } label: {
                            HStack(alignment: .firstTextBaseline, spacing: 12) {
                                Text(event.allDay ? nudgeLocalized("calendar.eventAllDay", locale: locale) : shortTime(event.start))
                                    .font(.body.weight(.semibold))
                                    .monospacedDigit()
                                    .foregroundStyle(textColor)
                                    .lineLimit(1)
                                    .minimumScaleFactor(0.85)
                                    .fixedSize(horizontal: true, vertical: false)
                                    .frame(minWidth: 60, alignment: .leading)
                                Text(verbatim: event.title)
                                    .font(.body)
                                    .foregroundStyle(textColor)
                                    .lineLimit(1)
                                Spacer()
                            }
                            .padding(.horizontal, 14)
                            .padding(.vertical, 12)
                            .background(
                                RoundedRectangle(cornerRadius: 12, style: .continuous)
                                    .fill(Color.nudgeForeground.opacity(past ? 0.02 : 0.04))
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(16)
            }
        }
    }

    private func shortTime(_ iso: String) -> String {
        guard let tIndex = iso.firstIndex(of: "T") else { return iso }
        let afterT = iso.index(after: tIndex)
        return String(iso[afterT...].prefix(5))
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

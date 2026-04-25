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

    private func events(on date: Date) -> [CalendarEventDTO] {
        let iso = DateFormatters.isoDate(date)
        return events.filter { $0.start.hasPrefix(iso) }
    }

    private var selectedDayEvents: [CalendarEventDTO] {
        events.filter { $0.start.hasPrefix(selectedDate) }
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
            Button(action: onPrevMonth) {
                Image(systemName: "chevron.left")
                    .foregroundStyle(Color.nudgeTextDim)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            Spacer()
            Text(verbatim: monthTitle)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Color.nudgeForeground)
            Spacer()
            Button(action: onThisMonth) {
                Text("calendar.today", bundle: .module)
                    .font(.footnote)
                    .foregroundStyle(Color.nudgePrimary)
            }
            .buttonStyle(.plain)
            Button(action: onNextMonth) {
                Image(systemName: "chevron.right")
                    .foregroundStyle(Color.nudgeTextDim)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
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
        let count = events(on: date).count

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
                        Circle().fill(Color.nudgePrimary)
                            .frame(width: 26, height: 26)
                    } else if isSelected {
                        Circle().stroke(Color.nudgeBorderLight, lineWidth: 1)
                            .frame(width: 26, height: 26)
                    }
                    Text(verbatim: "\(day)")
                        .font(.footnote.weight(isToday ? .semibold : .regular))
                        .foregroundStyle(dayColor(isToday: isToday, isPad: isPad))
                }
                dots(count: count)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 48)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func dayColor(isToday: Bool, isPad: Bool) -> Color {
        if isToday { return .nudgePrimaryForeground }
        if isPad { return .nudgeTextDim.opacity(0.5) }
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
                Text(verbatim: "···")
                    .font(.system(size: 8, weight: .bold))
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
                VStack(spacing: 10) {
                    ForEach(selectedDayEvents, id: \.id) { event in
                        Button { onEventTap(event) } label: {
                            HStack(alignment: .firstTextBaseline, spacing: 10) {
                                Text(event.allDay ? nudgeLocalized("calendar.eventAllDay", locale: locale) : shortTime(event.start))
                                    .font(.footnote.weight(.semibold))
                                    .monospacedDigit()
                                    .foregroundStyle(Color.nudgeForeground)
                                    .frame(width: 54, alignment: .leading)
                                Text(verbatim: event.title)
                                    .font(.subheadline)
                                    .foregroundStyle(Color.nudgeForeground)
                                    .lineLimit(1)
                                Spacer()
                            }
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
}

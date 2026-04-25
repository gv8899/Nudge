import SwiftUI
import NudgeCore

/// Agenda-style week list: events grouped by day. Days with no events
/// show an empty placeholder row. Range labelled in the header bar.
public struct CalendarWeekView: View {
    @Environment(\.locale) private var locale
    let weekStart: Date
    let weekEnd: Date
    let events: [CalendarEventDTO]
    let isLoading: Bool
    let onPrevWeek: () -> Void
    let onNextWeek: () -> Void
    let onThisWeek: () -> Void
    let onEventTap: (CalendarEventDTO) -> Void

    public init(
        weekStart: Date,
        weekEnd: Date,
        events: [CalendarEventDTO],
        isLoading: Bool,
        onPrevWeek: @escaping () -> Void,
        onNextWeek: @escaping () -> Void,
        onThisWeek: @escaping () -> Void,
        onEventTap: @escaping (CalendarEventDTO) -> Void
    ) {
        self.weekStart = weekStart
        self.weekEnd = weekEnd
        self.events = events
        self.isLoading = isLoading
        self.onPrevWeek = onPrevWeek
        self.onNextWeek = onNextWeek
        self.onThisWeek = onThisWeek
        self.onEventTap = onEventTap
    }

    private var days: [(date: Date, label: String)] {
        var result: [(Date, String)] = []
        var calendar = Calendar(identifier: .gregorian)
        calendar.firstWeekday = 2
        let weekdayFmt = DateFormatter()
        weekdayFmt.dateFormat = "EEEE M/d"
        for i in 0..<7 {
            if let d = calendar.date(byAdding: .day, value: i, to: weekStart) {
                result.append((d, weekdayFmt.string(from: d)))
            }
        }
        return result
    }

    public var body: some View {
        VStack(spacing: 0) {
            header

            if isLoading && events.isEmpty {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if events.isEmpty {
                Text("calendar.weekEmpty", bundle: .module)
                    .font(.subheadline)
                    .foregroundStyle(Color.nudgeTextDim)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        ForEach(days, id: \.date) { day in
                            dayBlock(date: day.date, label: day.label)
                        }
                    }
                    .padding(16)
                }
            }
        }
    }

    private var header: some View {
        HStack {
            Button(action: onPrevWeek) {
                Image(systemName: "chevron.left")
                    .foregroundStyle(Color.nudgeTextDim)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            Spacer()
            Text(verbatim: headerRangeLabel)
                .font(.subheadline.weight(.medium))
                .foregroundStyle(Color.nudgeForeground)
            Spacer()
            Button(action: onThisWeek) {
                Text("calendar.thisWeek", bundle: .module)
                    .font(.footnote)
                    .foregroundStyle(Color.nudgePrimary)
            }
            .buttonStyle(.plain)
            Button(action: onNextWeek) {
                Image(systemName: "chevron.right")
                    .foregroundStyle(Color.nudgeTextDim)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 8)
    }

    private var headerRangeLabel: String {
        let fmt = DateFormatter()
        fmt.dateFormat = "M/d"
        return "\(fmt.string(from: weekStart)) – \(fmt.string(from: weekEnd))"
    }

    private func dayBlock(date: Date, label: String) -> some View {
        let iso = DateFormatters.isoDate(date)
        let dayEvents = events.filter { $0.start.hasPrefix(iso) }
        return VStack(alignment: .leading, spacing: 8) {
            Text(verbatim: label)
                .font(.caption.weight(.semibold))
                .foregroundStyle(Color.nudgeTextDim)
                .textCase(.uppercase)
            if dayEvents.isEmpty {
                Text("calendar.panelEmpty", bundle: .module)
                    .font(.caption)
                    .foregroundStyle(Color.nudgeTextDim)
            } else {
                ForEach(dayEvents, id: \.id) { event in
                    Button { onEventTap(event) } label: {
                        HStack(alignment: .firstTextBaseline, spacing: 10) {
                            Text(event.allDay ? nudgeLocalized("calendar.eventAllDay", locale: locale) : shortTime(event.start))
                                .font(.footnote.weight(.semibold))
                                .monospacedDigit()
                                .foregroundStyle(Color.nudgeForeground)
                                .lineLimit(1)
                                .minimumScaleFactor(0.85)
                                .fixedSize(horizontal: true, vertical: false)
                                .frame(minWidth: 54, alignment: .leading)
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
            Rectangle()
                .fill(Color.nudgeBorderLight)
                .frame(height: 1)
        }
    }

    private func shortTime(_ iso: String) -> String {
        guard let tIndex = iso.firstIndex(of: "T") else { return iso }
        let afterT = iso.index(after: tIndex)
        return String(iso[afterT...].prefix(5))
    }
}

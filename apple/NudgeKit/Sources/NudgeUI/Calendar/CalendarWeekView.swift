import SwiftUI
import NudgeCore

/// Agenda-style week list: events grouped by day. Days with no events
/// show a thin divider only (no placeholder text), so the eye can scan
/// straight to days with content. Range labelled in the header bar.
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

    /// Pre-grouped events by ISO date — same optimisation pattern as
    /// CalendarMonthView. Avoids 7× O(N) filter scans per render.
    private var eventsByDate: [String: [CalendarEventDTO]] {
        Dictionary(grouping: events, by: { String($0.start.prefix(10)) })
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
                        let dayList = days
                        ForEach(Array(dayList.enumerated()), id: \.element.date) { index, day in
                            dayBlock(
                                date: day.date,
                                label: day.label,
                                isLast: index == dayList.count - 1
                            )
                        }
                    }
                    .padding(16)
                }
            }
        }
    }

    private var header: some View {
        HStack {
            IconButton(
                systemName: "chevron.left",
                accessibilityLabel: "calendar.prevWeek",
                action: onPrevWeek
            )
            Spacer()
            Text(verbatim: headerRangeLabel)
                .font(.subheadline.weight(.medium))
                .foregroundStyle(Color.nudgeForeground)
            Spacer()
            Button(action: onThisWeek) {
                Text("calendar.thisWeek", bundle: .module)
                    .font(.footnote)
                    // Match Settings / MonthView "今天" — text buttons
                    // use foreground colour, not the brand accent.
                    .foregroundStyle(Color.nudgeForeground)
                    .frame(minHeight: 44)
                    .padding(.horizontal, 8)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            IconButton(
                systemName: "chevron.right",
                accessibilityLabel: "calendar.nextWeek",
                action: onNextWeek
            )
        }
        .padding(.horizontal, 8)
    }

    private var headerRangeLabel: String {
        let fmt = DateFormatter()
        fmt.dateFormat = "M/d"
        return "\(fmt.string(from: weekStart)) – \(fmt.string(from: weekEnd))"
    }

    private func dayBlock(date: Date, label: String, isLast: Bool) -> some View {
        let iso = DateFormatters.isoDate(date)
        let dayEvents = eventsByDate[iso] ?? []
        return VStack(alignment: .leading, spacing: 8) {
            Text(verbatim: label)
                .font(.caption.weight(.semibold))
                // Empty days dim the label too, so the eye skips them
                // when scanning for content. Was: same colour for empty
                // and filled days, which made all 7 day blocks read at
                // the same weight regardless of whether they had events.
                .foregroundStyle(dayEvents.isEmpty ? Color.nudgeTextDim.opacity(0.7) : Color.nudgeTextDim)
                .textCase(.uppercase)
            if !dayEvents.isEmpty {
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
            // Skip the divider after the last day — was unconditional
            // Rectangle() per dayBlock which left a trailing line below
            // the last day with nothing to separate.
            if !isLast {
                Divider().background(Color.nudgeBorderLight)
            }
        }
    }

    private func shortTime(_ iso: String) -> String {
        guard let tIndex = iso.firstIndex(of: "T") else { return iso }
        let afterT = iso.index(after: tIndex)
        return String(iso[afterT...].prefix(5))
    }
}

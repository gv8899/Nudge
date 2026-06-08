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
            IconButton(
                systemName: "chevron.left",
                accessibilityLabel: "calendar.prevWeek",
                action: onPrevWeek
            )
            Spacer()
            Text(verbatim: headerRangeLabel)
                .font(.title3.weight(.semibold))
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

    private func dayBlock(date: Date, label: String) -> some View {
        let iso = DateFormatters.isoDate(date)
        let dayEvents = eventsByDate[iso] ?? []
        return VStack(alignment: .leading, spacing: 8) {
            Text(verbatim: label)
                // 星期分組標題放大到 headline，凸顯它是日期分組的主標題
                // （事件 row 是其下的內文層級）。
                .font(.headline)
                // 有事件 → nudgeForeground 深色強調；空白日 → 淡色，
                // 掃視時自然跳過。
                .foregroundStyle(dayEvents.isEmpty ? Color.nudgeTextDim : Color.nudgeForeground)
            if !dayEvents.isEmpty {
                ForEach(dayEvents, id: \.id) { event in
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
            // 區塊化 cards 已自帶視覺分界，不再需要日與日之間的 Divider。
            // VStack 的 spacing 20 提供足夠呼吸感。
        }
    }

    private func shortTime(_ iso: String) -> String {
        guard let tIndex = iso.firstIndex(of: "T") else { return iso }
        let afterT = iso.index(after: tIndex)
        return String(iso[afterT...].prefix(5))
    }

    /// 跟 CalendarDayView 共用的判斷邏輯 — 只小到不值得抽 file。
    /// 若日後 Day / Week / Month 共用更多 helper 再抽到 CalendarDateUtils。
    private func isPast(_ endIso: String) -> Bool {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = f.date(from: endIso) { return d < Date() }
        f.formatOptions = [.withInternetDateTime]
        return f.date(from: endIso).map { $0 < Date() } ?? false
    }
}

// HANDOFF B: 「上午 / 下午 / 晚上」分段卡片版
//
// 跟目前 main 的 CalendarDayView 同樣 init signature，要試貼回
// apple/NudgeKit/Sources/NudgeUI/Calendar/CalendarDayView.swift 即可。
//
// 主要改動 vs main：
// 1. 事件依 start 時間分到 上午 (0-11) / 下午 (12-17) / 晚上 (18+) 三段，
//    每段一個 caption-level header，沒有事件的段不顯示。
// 2. 每個事件變獨立 card：subtle bg fill + 圓角 12pt，HStack 配
//    [時間欄 56pt | 標題+地點 VStack]。
// 3. 過去事件：card bg 透明度降一半、標題 / 時間都降到 nudgeTextDim，
//    地點仍維持 dim（避免整體看起來糊掉）。
// 4. 視覺主次：標題 .body.semibold（最亮）、時間 .subheadline.semibold
//    monospaced（次亮）、地點 .caption（最暗）。

import SwiftUI
import NudgeCore

public struct CalendarDayView: View {
    @Binding var selectedDate: String
    @Binding var weekDates: Set<String>
    let events: [CalendarEventDTO]
    let isLoading: Bool
    let onWeekOffset: (Int) -> Void
    let onEventTap: (CalendarEventDTO) -> Void

    public init(
        selectedDate: Binding<String>,
        weekDates: Binding<Set<String>>,
        events: [CalendarEventDTO],
        isLoading: Bool,
        onWeekOffset: @escaping (Int) -> Void,
        onEventTap: @escaping (CalendarEventDTO) -> Void
    ) {
        _selectedDate = selectedDate
        _weekDates = weekDates
        self.events = events
        self.isLoading = isLoading
        self.onWeekOffset = onWeekOffset
        self.onEventTap = onEventTap
    }

    private var dayEvents: [CalendarEventDTO] {
        events.filter { $0.start.hasPrefix(selectedDate) }
    }

    public var body: some View {
        VStack(spacing: 0) {
            WeekStripView(
                selectedDate: selectedDate,
                datesWithTasks: weekDates,
                onSelectDate: { selectedDate = $0 },
                onWeekOffset: onWeekOffset
            )

            if isLoading && dayEvents.isEmpty {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if dayEvents.isEmpty {
                Text("calendar.panelEmpty", bundle: .module)
                    .font(.subheadline)
                    .foregroundStyle(Color.nudgeTextDim)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 18) {
                        ForEach(periodSections, id: \.id) { section in
                            sectionView(section)
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                }
            }
        }
    }

    // MARK: - Section / event rendering

    @ViewBuilder
    private func sectionView(_ section: PeriodSection) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(section.label, bundle: .module)
                .font(.caption.weight(.medium))
                .foregroundStyle(Color.nudgeTextDim)
                .padding(.horizontal, 4)

            VStack(spacing: 8) {
                ForEach(section.events, id: \.id) { event in
                    Button { onEventTap(event) } label: {
                        eventCard(event)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    @ViewBuilder
    private func eventCard(_ event: CalendarEventDTO) -> some View {
        let past = isPast(event.end)
        let titleColor: Color = past ? Color.nudgeTextDim : Color.nudgeForeground
        let timeColor: Color = past ? Color.nudgeTextDim.opacity(0.7) : Color.nudgeForeground

        HStack(alignment: .top, spacing: 14) {
            Group {
                if event.allDay {
                    Text("calendar.eventAllDay", bundle: .module)
                        .font(.subheadline.weight(.semibold))
                } else {
                    Text(shortTime(event.start))
                        .font(.subheadline.weight(.semibold))
                        .monospacedDigit()
                }
            }
            .foregroundStyle(timeColor)
            .lineLimit(1)
            .minimumScaleFactor(0.85)
            .fixedSize(horizontal: true, vertical: false)
            .frame(minWidth: 56, alignment: .leading)

            VStack(alignment: .leading, spacing: 4) {
                Text(verbatim: event.title)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(titleColor)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)

                if let location = event.location, !location.isEmpty {
                    HStack(spacing: 4) {
                        Image(systemName: "mappin.and.ellipse")
                            .font(.caption2)
                        Text(verbatim: location)
                            .font(.caption)
                            .lineLimit(1)
                    }
                    .foregroundStyle(Color.nudgeTextDim)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Color.nudgeForeground.opacity(past ? 0.03 : 0.06))
        )
    }

    // MARK: - Period grouping

    private struct PeriodSection: Identifiable {
        enum Kind { case morning, afternoon, evening }
        let kind: Kind
        let events: [CalendarEventDTO]
        var id: String { String(describing: kind) }
        var label: LocalizedStringKey {
            switch kind {
            case .morning: return "calendar.period.morning"
            case .afternoon: return "calendar.period.afternoon"
            case .evening: return "calendar.period.evening"
            }
        }
    }

    private var periodSections: [PeriodSection] {
        var morning: [CalendarEventDTO] = []
        var afternoon: [CalendarEventDTO] = []
        var evening: [CalendarEventDTO] = []
        for e in dayEvents {
            let h = startHour(e.start)
            if h < 12 { morning.append(e) }
            else if h < 18 { afternoon.append(e) }
            else { evening.append(e) }
        }
        var result: [PeriodSection] = []
        if !morning.isEmpty { result.append(.init(kind: .morning, events: morning)) }
        if !afternoon.isEmpty { result.append(.init(kind: .afternoon, events: afternoon)) }
        if !evening.isEmpty { result.append(.init(kind: .evening, events: evening)) }
        return result
    }

    // MARK: - Helpers

    private func startHour(_ iso: String) -> Int {
        // iso 形如 "2026-04-24T13:00:00.000Z" — 直接擷取 'T' 後的 hour 部分。
        // 不轉時區：iOS 顯示時間都跟 server 給的 ISO local hour 一致。
        guard let tIndex = iso.firstIndex(of: "T") else { return 0 }
        let after = iso.index(after: tIndex)
        let hourStr = String(iso[after...].prefix(2))
        return Int(hourStr) ?? 0
    }

    private func shortTime(_ iso: String) -> String {
        guard let tIndex = iso.firstIndex(of: "T") else { return iso }
        let afterT = iso.index(after: tIndex)
        return String(iso[afterT...].prefix(5))
    }

    private func isPast(_ endIso: String) -> Bool {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = f.date(from: endIso) { return d < Date() }
        f.formatOptions = [.withInternetDateTime]
        return f.date(from: endIso).map { $0 < Date() } ?? false
    }
}

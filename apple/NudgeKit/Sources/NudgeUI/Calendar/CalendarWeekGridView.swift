import SwiftUI
import NudgeCore

/// Google Calendar 式時間軸週網格 — macOS 專用（iOS 週檢視仍用
/// CalendarWeekView agenda 列表）。事件依 start/end 換算 offset/height，
/// 重疊用 CalendarWeekLayout 貪婪分欄避讓。唯讀：點事件開詳情。
/// 時間一律取 ISO 字串的 "HH:MM"（事件自身時區），與 CalendarWeekView
/// shortTime 同語意，不過 Date() 轉裝置時區。
struct CalendarWeekGridView: View {
    @Environment(\.locale) private var locale
    let weekStart: Date
    let weekEnd: Date
    let events: [CalendarEventDTO]
    let isLoading: Bool
    let onPrevWeek: () -> Void
    let onNextWeek: () -> Void
    let onThisWeek: () -> Void
    let onEventTap: (CalendarEventDTO) -> Void

    private let hourHeight: CGFloat = 48
    private let axisWidth: CGFloat = 56

    @State private var scrollPosition = ScrollPosition(edge: .top)

    private var calendar: Calendar {
        var c = Calendar(identifier: .gregorian)
        c.firstWeekday = 2
        return c
    }

    private var days: [Date] {
        (0..<7).compactMap { calendar.date(byAdding: .day, value: $0, to: weekStart) }
    }

    private var eventsByDate: [String: [CalendarEventDTO]] {
        Dictionary(grouping: events, by: { String($0.start.prefix(10)) })
    }

    private var todayISO: String { DateFormatters.isoDate(Date()) }

    var body: some View {
        VStack(spacing: 0) {
            header
            if isLoading && events.isEmpty {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                gridFrame
            }
        }
    }

    // MARK: - Header（同 CalendarWeekView）

    private var header: some View {
        HStack {
            IconButton(
                systemName: "chevron.left",
                accessibilityLabel: "calendar.prevWeek",
                action: onPrevWeek
            )
            Spacer()
            Text(verbatim: headerRangeLabel)
                .nudgeFont(.columnTitle)
                .foregroundStyle(Color.nudgeForeground)
            Spacer()
            Button(action: onThisWeek) {
                Text("calendar.thisWeek", bundle: .module)
                    .nudgeFont(.inlineButtonLabel)
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

    // MARK: - Grid

    private var gridFrame: some View {
        // 不畫最外圈框線 — 只留內部的欄位線與小時格線。
        VStack(spacing: 0) {
            dayHeaderRow
            // 全天列只在本週有全天事件時出現，平常不佔空帶。
            if events.contains(where: \.allDay) {
                allDayRow
            }
            timeGrid
        }
        .padding(.horizontal, 8)
        .padding(.bottom, 8)
    }

    private var dayHeaderRow: some View {
        HStack(spacing: 0) {
            Color.clear.frame(width: axisWidth, height: 1)
            ForEach(days, id: \.self) { day in
                let iso = DateFormatters.isoDate(day)
                let isToday = iso == todayISO
                VStack(spacing: 4) {
                    Text(verbatim: weekdayLabel(day))
                        .nudgeFont(.weekdayLabel)
                        .foregroundStyle(isToday ? Color.nudgePrimary : Color.nudgeTextDim)
                        .fontWeight(isToday ? .semibold : .regular)
                    Text(verbatim: "\(calendar.component(.day, from: day))")
                        .nudgeFont(.weekdayNumber)
                        .monospacedDigit()
                        .foregroundStyle(isToday ? Color.nudgePrimaryForeground : Color.nudgeForeground)
                        .frame(width: 30, height: 30)
                        .background(
                            Circle().fill(isToday ? Color.nudgePrimary : Color.clear)
                        )
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
                .overlay(alignment: .leading) {
                    Rectangle().fill(Color.nudgeBorder).frame(width: 1)
                }
            }
        }
        .overlay(alignment: .bottom) {
            Rectangle().fill(Color.nudgeBorder).frame(height: 1)
        }
    }

    private func weekdayLabel(_ day: Date) -> String {
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: locale.identifier)
        fmt.dateFormat = "EEE"
        return fmt.string(from: day)
    }

    private var allDayRow: some View {
        HStack(alignment: .top, spacing: 0) {
            Text(verbatim: nudgeLocalized("calendar.eventAllDay", locale: locale))
                .nudgeFont(.rowMeta)
                .foregroundStyle(Color.nudgeTextDim)
                .padding(.trailing, 8)
                // padding 要包在 frame 內，總寬才是 axisWidth —
                // 否則整日列的分隔線會比上下的欄位線右移 8pt。
                .frame(width: axisWidth, alignment: .trailing)
                .padding(.top, 8)
            ForEach(days, id: \.self) { day in
                let iso = DateFormatters.isoDate(day)
                let allDayEvents = (eventsByDate[iso] ?? []).filter(\.allDay)
                VStack(spacing: 3) {
                    ForEach(allDayEvents, id: \.id) { event in
                        Button { onEventTap(event) } label: {
                            Text(verbatim: event.title)
                                .nudgeFont(.rowMeta)
                                .foregroundStyle(Color.nudgePrimaryForeground)
                                .lineLimit(1)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 3)
                                .background(alignment: .leading) {
                                    allDayChipBackground
                                }
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(3)
                .frame(maxWidth: .infinity, minHeight: 30, alignment: .top)
                .overlay(alignment: .leading) {
                    Rectangle().fill(Color.nudgeBorder).frame(width: 1)
                }
            }
        }
        .overlay(alignment: .bottom) {
            Rectangle().fill(Color.nudgeBorder).frame(height: 1)
        }
    }

    private var allDayChipBackground: some View {
        // 主色實心 — 與時間軸上的未過期事件塊一致。
        RoundedRectangle(cornerRadius: 6, style: .continuous)
            .fill(Color.nudgePrimary)
    }

    private var timeGrid: some View {
        // 注意：不能用 ScrollViewReader + `.id()` 捲動 — 時間軸 label 是用
        // `.offset` 視覺位移的，layout frame 全部在容器頂端，scrollTo(id)
        // 只會捲到 y=0（實際踩過：怎麼捲都停在最上面）。改用 ScrollPosition
        // 直接捲到 y 座標。
        ScrollView {
            HStack(alignment: .top, spacing: 0) {
                axisColumn
                GeometryReader { geo in
                    HStack(spacing: 0) {
                        ForEach(days, id: \.self) { day in
                            dayColumn(day: day, width: geo.size.width / 7)
                        }
                    }
                }
                .frame(height: hourHeight * 24)
            }
            .frame(height: hourHeight * 24)
        }
        .scrollPosition($scrollPosition)
        .onAppear {
            scrollToInitialHour()
        }
        // onAppear 時 events 常常還沒載回來（async reload）→ 先落在
        // fallback；資料到位或切週後（events 內容改變才會觸發，DTO 是
        // Equatable）重新對齊當週最早事件。
        .onChange(of: events) { _, _ in
            scrollToInitialHour()
        }
        .onChange(of: weekStart) { _, _ in
            scrollToInitialHour()
        }
    }

    private func scrollToInitialHour() {
        // 上移一個小時：頂端剛好蓋住最早事件的前一小時（-12pt 讓該刻度
        // label 完整可見）。
        scrollPosition.scrollTo(y: max(CGFloat(initialScrollHour - 1) * hourHeight - 12, 0))
    }

    /// 起始定位在「當週最早的非全天事件」那個小時（如最早 9:30 → 定位
    /// 9:00）；整週沒事件 → 09:00。與 web 一致。
    private var initialScrollHour: Int {
        let earliest = events
            .filter { !$0.allDay }
            .map { minutesOfDay($0.start) }
            .min()
        guard let earliest else { return 9 }
        return min(max(Int(earliest) / 60, 0), 23)
    }

    private var axisColumn: some View {
        ZStack(alignment: .topTrailing) {
            Color.clear
            ForEach(1..<24, id: \.self) { h in
                Text(verbatim: String(format: "%02d:00", h))
                    .nudgeFont(.rowMeta)
                    .monospacedDigit()
                    .foregroundStyle(Color.nudgeTextDim)
                    .padding(.trailing, 8)
                    .offset(y: CGFloat(h) * hourHeight - 8)
            }
        }
        .frame(width: axisWidth, height: hourHeight * 24)
    }

    /// ISO 字串 → 當日分鐘數（事件自身時區的 "HH:MM"）。
    private func minutesOfDay(_ iso: String) -> Double {
        guard let tIndex = iso.firstIndex(of: "T") else { return 0 }
        let hhmm = iso[iso.index(after: tIndex)...].prefix(5)
        let parts = hhmm.split(separator: ":")
        guard parts.count == 2,
              let h = Double(parts[0]), let m = Double(parts[1]) else { return 0 }
        return h * 60 + m
    }

    /// 事件在該日欄的分鐘區間 — 跨午夜夾到 24:00。
    private func dayInterval(_ event: CalendarEventDTO, dayISO: String) -> CalendarWeekLayout.Interval {
        let startMin = minutesOfDay(event.start)
        let endsSameDay = String(event.end.prefix(10)) == dayISO
        let endMin = endsSameDay ? minutesOfDay(event.end) : 24 * 60
        return CalendarWeekLayout.Interval(startMin: startMin, endMin: max(endMin, startMin))
    }

    private func dayColumn(day: Date, width: CGFloat) -> some View {
        let iso = DateFormatters.isoDate(day)
        let timed = (eventsByDate[iso] ?? []).filter { !$0.allDay }
        let intervals = timed.map { dayInterval($0, dayISO: iso) }
        let placements = CalendarWeekLayout.layoutDayEvents(intervals)

        return ZStack(alignment: .topLeading) {
            // 小時格線
            ForEach(1..<24, id: \.self) { h in
                Rectangle()
                    .fill(Color.nudgeBorder.opacity(0.55))
                    .frame(height: 1)
                    .offset(y: CGFloat(h) * hourHeight)
            }
            // 事件塊
            ForEach(Array(timed.enumerated()), id: \.element.id) { idx, event in
                eventBlock(
                    event: event,
                    interval: intervals[idx],
                    placement: placements[idx],
                    columnWidth: width
                )
            }
        }
        .frame(width: width, height: hourHeight * 24, alignment: .topLeading)
        .overlay(alignment: .leading) {
            Rectangle().fill(Color.nudgeBorder).frame(width: 1)
        }
    }

    private func eventBlock(
        event: CalendarEventDTO,
        interval: CalendarWeekLayout.Interval,
        placement: CalendarWeekLayout.Placement,
        columnWidth: CGFloat
    ) -> some View {
        let durMin = interval.endMin - interval.startMin
        let isShort = durMin <= 30
        let past = isPast(event.end)
        let subWidth = columnWidth / CGFloat(placement.columnCount)
        let blockWidth = max(subWidth - (placement.columnCount > 1 ? 4 : 6), 10)
        let blockHeight = max(CGFloat(durMin) / 60 * hourHeight - 3, 14)
        let x = CGFloat(placement.column) * subWidth + 2
        let y = CGFloat(interval.startMin) / 60 * hourHeight + 1

        return Button { onEventTap(event) } label: {
            VStack(alignment: .leading, spacing: 1) {
                Text(verbatim: event.title)
                    .nudgeFont(past ? .rowTitle : .rowTitleEmphasized)
                    .foregroundStyle(past ? Color.nudgeTextDim : Color.nudgePrimaryForeground)
                    .lineLimit(isShort ? 1 : 2)
                if !isShort {
                    Text(verbatim: "\(shortTime(event.start)) – \(shortTime(event.end))")
                        .nudgeFont(.rowMeta)
                        .monospacedDigit()
                        .foregroundStyle(past ? Color.nudgeTextDim : Color.nudgePrimaryForeground.opacity(0.78))
                        .lineLimit(1)
                }
            }
            .padding(.horizontal, 5)
            .padding(.vertical, isShort ? 1 : 3)
            .frame(width: blockWidth, height: blockHeight, alignment: .topLeading)
            .background {
                // 還沒發生的事件 → 主色實心（同事件詳情「加入線上會議」鈕），
                // 深淺色模式都吃 token；過去事件 → 淡灰不透明。底層一律先鋪
                // nudgeBackground 確保蓋得住格線。
                ZStack {
                    RoundedRectangle(cornerRadius: 7, style: .continuous)
                        .fill(Color.nudgeBackground)
                    RoundedRectangle(cornerRadius: 7, style: .continuous)
                        .fill(past ? Color.nudgeForeground.opacity(0.07) : Color.nudgePrimary)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .offset(x: x, y: y)
        .zIndex(Double(10 + placement.column))
        .help(Text(verbatim: "\(event.title)  \(shortTime(event.start)) – \(shortTime(event.end))"))
    }

    private func shortTime(_ iso: String) -> String {
        guard let tIndex = iso.firstIndex(of: "T") else { return iso }
        let afterT = iso.index(after: tIndex)
        return String(iso[afterT...].prefix(5))
    }

    /// 同 CalendarWeekView.isPast。
    private func isPast(_ endIso: String) -> Bool {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = f.date(from: endIso) { return d < Date() }
        f.formatOptions = [.withInternetDateTime]
        return f.date(from: endIso).map { $0 < Date() } ?? false
    }
}

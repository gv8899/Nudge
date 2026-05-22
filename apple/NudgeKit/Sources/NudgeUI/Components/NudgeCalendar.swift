import SwiftUI

/// 自刻月曆 grid — 7 欄 LazyVGrid + 6 週日期格 + 月份標頭 + 上/下月 chevron。
/// 不用 SwiftUI `DatePicker(.graphical)`：mac 上是 NSDatePicker wrap、size
/// 寫死、tint 是系統藍、整個吃 design system。自刻完全可控。
///
/// - 選中日 = `nudgePrimary` 填充圓 + `nudgePrimaryForeground` 文字
/// - 今日 = `nudgePrimary` 文字（不填充）
/// - 非本月補位日 = `nudgeTextDim` 半透明、點下去 navigate 到那個月
/// - locale-aware weekday header（依 system firstWeekday rotate）
struct NudgeCalendar: View {
    @Binding var selectedDate: Date
    @Environment(\.locale) private var locale
    @State private var displayedMonth: Date

    private let calendar = Calendar(identifier: .gregorian)
    private let cellHeight: CGFloat = 36

    init(selectedDate: Binding<Date>) {
        self._selectedDate = selectedDate
        self._displayedMonth = State(initialValue: selectedDate.wrappedValue)
    }

    var body: some View {
        VStack(spacing: 12) {
            header
            weekdayRow
            dateGrid
        }
    }

    private var header: some View {
        HStack(spacing: 8) {
            Text(monthLabel)
                .nudgeFont(.columnDetailTitle)
                .foregroundStyle(Color.nudgeForeground)
            Spacer()
            navButton(systemName: "chevron.left") { offsetMonth(-1) }
            navButton(systemName: "chevron.right") { offsetMonth(1) }
        }
    }

    private func navButton(systemName: String, action: @escaping () -> Void) -> some View {
        Image(systemName: systemName)
            .font(.body.weight(.medium))
            .foregroundStyle(Color.nudgeTextDim)
            .frame(width: 32, height: 32)
            .contentShape(Rectangle())
            .onTapGesture(perform: action)
            .accessibilityAddTraits(.isButton)
    }

    private var weekdayRow: some View {
        HStack(spacing: 0) {
            ForEach(Array(weekdaySymbols.enumerated()), id: \.offset) { _, day in
                Text(day)
                    .font(.caption.weight(.medium))
                    .foregroundStyle(Color.nudgeTextDim)
                    .frame(maxWidth: .infinity)
            }
        }
    }

    private var dateGrid: some View {
        LazyVGrid(
            columns: Array(repeating: GridItem(.flexible(), spacing: 4), count: 7),
            spacing: 4
        ) {
            ForEach(gridDates, id: \.self) { date in
                cell(for: date)
            }
        }
    }

    private func cell(for date: Date) -> some View {
        let isSelected = calendar.isDate(date, inSameDayAs: selectedDate)
        let isInMonth = calendar.isDate(date, equalTo: displayedMonth, toGranularity: .month)
        let isToday = calendar.isDateInToday(date)
        let day = calendar.component(.day, from: date)
        return Text("\(day)")
            .font(.body.weight(isSelected || isToday ? .semibold : .regular))
            .foregroundStyle(textColor(isSelected: isSelected, isInMonth: isInMonth, isToday: isToday))
            .frame(maxWidth: .infinity, minHeight: cellHeight)
            .background(
                Circle()
                    .fill(isSelected ? Color.nudgePrimary : Color.clear)
                    .frame(width: cellHeight, height: cellHeight)
            )
            .contentShape(Rectangle())
            .onTapGesture {
                selectedDate = date
                if !isInMonth {
                    displayedMonth = date
                }
            }
    }

    private func textColor(isSelected: Bool, isInMonth: Bool, isToday: Bool) -> Color {
        if isSelected { return Color.nudgePrimaryForeground }
        if !isInMonth { return Color.nudgeTextDim.opacity(0.5) }
        if isToday { return Color.nudgePrimary }
        return Color.nudgeForeground
    }

    private var monthLabel: String {
        displayedMonth.formatted(.dateTime.year().month(.wide).locale(locale))
    }

    private var weekdaySymbols: [String] {
        let formatter = DateFormatter()
        formatter.locale = locale
        let symbols = formatter.veryShortWeekdaySymbols ?? []
        let first = calendar.firstWeekday
        let offset = first - 1
        return Array(symbols[offset...] + symbols[..<offset])
    }

    private var gridDates: [Date] {
        guard let monthInterval = calendar.dateInterval(of: .month, for: displayedMonth) else { return [] }
        let firstOfMonth = monthInterval.start
        let weekdayOfFirst = calendar.component(.weekday, from: firstOfMonth)
        let firstWeekday = calendar.firstWeekday
        let leadingDays = (weekdayOfFirst - firstWeekday + 7) % 7
        guard let start = calendar.date(byAdding: .day, value: -leadingDays, to: firstOfMonth) else { return [] }
        return (0..<42).compactMap { calendar.date(byAdding: .day, value: $0, to: start) }
    }

    private func offsetMonth(_ delta: Int) {
        if let next = calendar.date(byAdding: .month, value: delta, to: displayedMonth) {
            displayedMonth = next
        }
    }
}

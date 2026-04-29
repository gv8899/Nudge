import SwiftUI
import NudgeCore

public struct WeekStripView: View {
    public let selectedDate: String
    public let datesWithTasks: Set<String>
    public let onSelectDate: (String) -> Void
    public let onWeekOffset: (Int) -> Void

    public init(
        selectedDate: String,
        datesWithTasks: Set<String>,
        onSelectDate: @escaping (String) -> Void,
        onWeekOffset: @escaping (Int) -> Void
    ) {
        self.selectedDate = selectedDate
        self.datesWithTasks = datesWithTasks
        self.onSelectDate = onSelectDate
        self.onWeekOffset = onWeekOffset
    }

    public var body: some View {
        // 上方原本 macOS 有大日期 + chevron header；現已移到 DailyHostView
        // 的視窗 toolbar（subtitle 顯示日期、leading 三顆按鈕做週導覽），
        // 視 strip 只保留 7 顆日期 cell，避免上下兩列重複的日期資訊。
        VStack(spacing: 8) {
            HStack(spacing: 4) {
                ForEach(currentWeekDates(), id: \.self) { dateString in
                    dayCell(dateString)
                }
            }
            .padding(.horizontal, 8)
            #if os(iOS)
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 30)
                    .onEnded { value in
                        if value.translation.width > 50 {
                            onWeekOffset(-1)
                        } else if value.translation.width < -50 {
                            onWeekOffset(1)
                        }
                    }
            )
            #endif
        }
        .padding(.vertical, 12)
        .animation(.easeOut(duration: 0.2), value: selectedDate)
    }

    private func currentWeekDates() -> [String] {
        guard let date = DateFormatters.parseISODate(selectedDate) else { return [] }
        let startOfWeek = DateFormatters.startOfWeek(date)
        let calendar = Calendar(identifier: .gregorian)
        return (0..<7).compactMap { offset in
            calendar.date(byAdding: .day, value: offset, to: startOfWeek).map { DateFormatters.isoDate($0) }
        }
    }

    @ViewBuilder
    private func dayCell(_ date: String) -> some View {
        let isSelected = date == selectedDate
        let hasTasks = datesWithTasks.contains(date)
        let dayNumber = date.split(separator: "-").last.map(String.init) ?? ""

        Button(action: { onSelectDate(date) }) {
            VStack(spacing: 4) {
                // Weekday label stays neutral — was nudgePrimary on
                // selected, which combined with the filled circle and
                // the dot to put three primary-color elements in one
                // cell. The fill alone is enough selection signal.
                Text(weekdayKey(date), bundle: .module)
                    .nudgeFont(.weekdayLabel)
                    .foregroundStyle(Color.nudgeTextDim)

                Text(dayNumber)
                    .nudgeFont(.weekdayNumber)
                    .foregroundStyle(isSelected ? Color.nudgePrimaryForeground : Color.nudgeForeground)
                    .frame(width: 36, height: 36)
                    .background(
                        Circle()
                            .fill(isSelected ? Color.nudgePrimary : Color.clear)
                    )

                // Hide the hasTasks dot on the selected day — it's
                // information redundant with the filled circle. Keeps
                // the cell from carrying three concurrent primary-color
                // accents.
                Circle()
                    .fill(hasTasks && !isSelected ? Color.nudgePrimary : Color.clear)
                    .frame(width: 4, height: 4)
            }
            // mac 用滑鼠不需要 56pt 觸控目標；iOS 觸控維持 56pt。
            .frame(maxWidth: .infinity, minHeight: dayCellMinHeight)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(Text(verbatim: dayNumber))
        .accessibilityValue(Text(weekdayKey(date), bundle: .module))
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    private var dayCellMinHeight: CGFloat {
        #if os(macOS)
        return 44
        #else
        return 56
        #endif
    }

    private func weekdayKey(_ dateString: String) -> LocalizedStringKey {
        guard let date = DateFormatters.parseISODate(dateString) else { return "weekday.mon" }
        let calendar = Calendar(identifier: .gregorian)
        let weekday = calendar.component(.weekday, from: date)
        let keys: [LocalizedStringKey] = [
            "weekday.sun", "weekday.mon", "weekday.tue", "weekday.wed",
            "weekday.thu", "weekday.fri", "weekday.sat"
        ]
        return keys[weekday - 1]
    }
}

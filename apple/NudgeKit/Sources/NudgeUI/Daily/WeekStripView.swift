import SwiftUI
import NudgeCore

public struct WeekStripView: View {
    public let selectedDate: String       // "YYYY-MM-DD"
    public let datesWithTasks: Set<String>
    public let onSelectDate: (String) -> Void
    public let onTapToday: () -> Void
    public let onWeekOffset: (Int) -> Void

    public init(
        selectedDate: String,
        datesWithTasks: Set<String>,
        onSelectDate: @escaping (String) -> Void,
        onTapToday: @escaping () -> Void,
        onWeekOffset: @escaping (Int) -> Void
    ) {
        self.selectedDate = selectedDate
        self.datesWithTasks = datesWithTasks
        self.onSelectDate = onSelectDate
        self.onTapToday = onTapToday
        self.onWeekOffset = onWeekOffset
    }

    public var body: some View {
        VStack(spacing: 8) {
            HStack {
                Button(action: { onWeekOffset(-1) }) {
                    Image(systemName: "chevron.left")
                }
                .buttonStyle(.plain)

                Spacer()

                Button(action: onTapToday) {
                    Text("daily.todayButton", bundle: .module)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(Color.nudgePrimary)
                }
                .buttonStyle(.plain)

                Spacer()

                Button(action: { onWeekOffset(1) }) {
                    Image(systemName: "chevron.right")
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 16)

            HStack(spacing: 4) {
                ForEach(currentWeekDates(), id: \.self) { dateString in
                    dayCell(dateString)
                }
            }
            .padding(.horizontal, 8)
        }
        .padding(.vertical, 12)
        .background(Color.nudgeBackground)
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
                Text(weekdayKey(date), bundle: .module)
                    .font(.caption2)
                    .foregroundStyle(Color.nudgeTextDim)
                Text(dayNumber)
                    .font(.headline)
                    .foregroundStyle(isSelected ? Color.nudgePrimaryForeground : Color.nudgeForeground)

                Circle()
                    .fill(hasTasks ? Color.nudgePrimary : Color.clear)
                    .frame(width: 4, height: 4)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
            .background(isSelected ? Color.nudgePrimary : Color.clear)
            .cornerRadius(8)
        }
        .buttonStyle(.plain)
    }

    private func weekdayKey(_ dateString: String) -> LocalizedStringKey {
        guard let date = DateFormatters.parseISODate(dateString) else { return "weekday.mon" }
        let calendar = Calendar(identifier: .gregorian)
        let weekday = calendar.component(.weekday, from: date)
        // 1 = Sun, 2 = Mon, ..., 7 = Sat
        let keys: [LocalizedStringKey] = [
            "weekday.sun", "weekday.mon", "weekday.tue", "weekday.wed",
            "weekday.thu", "weekday.fri", "weekday.sat"
        ]
        return keys[weekday - 1]
    }
}

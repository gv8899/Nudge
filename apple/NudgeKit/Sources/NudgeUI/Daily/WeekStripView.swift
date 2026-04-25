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
        VStack(spacing: 8) {
            #if os(macOS)
            // macOS still shows the big date + prev/next chevrons inside
            // this view. iOS has moved the date to a smaller eyebrow
            // above the page title (see DailyHostView.iOSLayout), so the
            // header is suppressed here on iOS to avoid duplication.
            header
                .padding(.horizontal, 16)
            #endif

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

    @ViewBuilder
    private var header: some View {
        #if os(iOS)
        Text(formattedSelectedDate())
            .font(.title2.weight(.semibold))
            .foregroundStyle(Color.nudgeForeground)
            .frame(maxWidth: .infinity, alignment: .center)
        #else
        HStack {
            IconButton(
                systemName: "chevron.left",
                accessibilityLabel: "daily.prevWeekAria",
                action: { onWeekOffset(-1) }
            )

            Spacer()

            Text(formattedSelectedDate())
                .font(.title2.weight(.semibold))
                .foregroundStyle(Color.nudgeForeground)

            Spacer()

            IconButton(
                systemName: "chevron.right",
                accessibilityLabel: "daily.nextWeekAria",
                action: { onWeekOffset(1) }
            )
        }
        #endif
    }

    private func formattedSelectedDate() -> String {
        guard let date = DateFormatters.parseISODate(selectedDate) else { return selectedDate }
        let cal = Calendar(identifier: .gregorian)
        let m = cal.component(.month, from: date)
        let d = cal.component(.day, from: date)
        let y = cal.component(.year, from: date)
        return "\(m)/\(d), \(y)"
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
                    .foregroundStyle(isSelected ? Color.nudgePrimary : Color.nudgeTextDim)

                Text(dayNumber)
                    .font(.headline)
                    .foregroundStyle(isSelected ? Color.nudgePrimaryForeground : Color.nudgeForeground)
                    .frame(width: 32, height: 32)
                    .background(
                        Circle()
                            .fill(isSelected ? Color.nudgePrimary : Color.clear)
                    )

                Circle()
                    .fill(hasTasks ? Color.nudgePrimary : Color.clear)
                    .frame(width: 4, height: 4)
            }
            .frame(maxWidth: .infinity, minHeight: 56)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(Text(verbatim: dayNumber))
        .accessibilityValue(Text(weekdayKey(date), bundle: .module))
        .accessibilityAddTraits(isSelected ? .isSelected : [])
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

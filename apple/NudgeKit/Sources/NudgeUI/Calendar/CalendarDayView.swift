import SwiftUI
import NudgeCore

/// Single-day event list for the Calendar tab. Uses the shared
/// WeekStripView at the top so date navigation stays consistent
/// with the Action page.
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

    /// `events` is the whole week (so `weekDates` dots show for every day
    /// with an event). The Day list itself filters down to selected-day.
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
                    VStack(spacing: 14) {
                        ForEach(dayEvents, id: \.id) { event in
                            Button { onEventTap(event) } label: {
                                eventRow(event)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(16)
                }
            }
        }
    }

    private func eventRow(_ event: CalendarEventDTO) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            Group {
                if event.allDay {
                    Text("calendar.eventAllDay", bundle: .module)
                        .font(.footnote.weight(.heavy))
                } else {
                    Text(shortTime(event.start))
                        .font(.title3.weight(.heavy))
                        .monospacedDigit()
                }
            }
            .foregroundStyle(Color.nudgeForeground)
            .frame(width: 60, alignment: .leading)

            VStack(alignment: .leading, spacing: 4) {
                Text(verbatim: event.title)
                    .font(.callout.weight(.medium))
                    .foregroundStyle(Color.nudgeForeground)
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
    }

    private func shortTime(_ iso: String) -> String {
        guard let tIndex = iso.firstIndex(of: "T") else { return iso }
        let afterT = iso.index(after: tIndex)
        return String(iso[afterT...].prefix(5))
    }
}

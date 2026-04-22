import SwiftUI
import NudgeCore

public struct CalendarSectionView: View {
    public let events: [CalendarEventDTO]
    public let isConnected: Bool
    public let onConnectTapped: () -> Void

    @SceneStorage("calendar.panel.expanded") private var isExpanded: Bool = false

    public init(events: [CalendarEventDTO], isConnected: Bool, onConnectTapped: @escaping () -> Void) {
        self.events = events
        self.isConnected = isConnected
        self.onConnectTapped = onConnectTapped
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if isConnected {
                HStack(spacing: 6) {
                    Text("calendar.panelTitle", bundle: .module)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(Color.nudgeTextDim)
                    if !events.isEmpty {
                        Text(verbatim: "· \(events.count)")
                            .font(.subheadline)
                            .foregroundStyle(Color.nudgeTextDim)
                    }
                    Spacer()
                    if !events.isEmpty {
                        Button(action: { isExpanded.toggle() }) {
                            Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                                .foregroundStyle(Color.nudgeTextDim)
                                .frame(minWidth: 44, minHeight: 44)
                                .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(Text("calendar.panelTitle", bundle: .module))
                        .accessibilityValue(Text(isExpanded ? "expanded" : "collapsed"))
                    }
                }

                if events.isEmpty {
                    Text("calendar.panelEmpty", bundle: .module)
                        .font(.footnote)
                        .foregroundStyle(Color.nudgeTextDim)
                } else if isExpanded {
                    VStack(spacing: 0) {
                        ForEach(Array(events.enumerated()), id: \.element.id) { index, event in
                            eventRow(event, isLast: index == events.count - 1)
                        }
                    }
                    .padding(.top, 4)
                }
            } else {
                Button(action: onConnectTapped) {
                    HStack {
                        Image(systemName: "calendar.badge.plus")
                        Text("calendar.connectTitle", bundle: .module)
                    }
                    .padding()
                    .frame(maxWidth: .infinity)
                    .background(Color.nudgePrimary.opacity(0.1))
                    .cornerRadius(8)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .animation(.easeOut(duration: 0.2), value: isExpanded)
    }

    @ViewBuilder
    private func eventRow(_ event: CalendarEventDTO, isLast: Bool) -> some View {
        let accent = calendarAccent(for: event.calendarId)

        HStack(alignment: .top, spacing: 14) {
            // Timeline column — mirrors web note-entry.tsx:
            // short line above, dot, then a flexible line that connects
            // to the next event's dot (omitted on last row).
            VStack(spacing: 0) {
                Rectangle()
                    .fill(Color.nudgeBorder)
                    .frame(width: 1, height: 10)
                Circle()
                    .fill(accent)
                    .frame(width: 10, height: 10)
                if !isLast {
                    Rectangle()
                        .fill(Color.nudgeBorder)
                        .frame(width: 1)
                        .frame(maxHeight: .infinity)
                } else {
                    Spacer(minLength: 0)
                }
            }
            .frame(width: 12)

            // Content row — time and title align on first text baseline
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
                    Text(event.title)
                        .font(.callout.weight(.medium))
                        .foregroundStyle(Color.nudgeForeground)
                        .lineLimit(2)

                    if let location = event.location, !location.isEmpty {
                        HStack(spacing: 4) {
                            Image(systemName: "mappin.and.ellipse")
                                .font(.caption2)
                            Text(location)
                                .font(.caption)
                                .lineLimit(1)
                        }
                        .foregroundStyle(Color.nudgeTextDim)
                    }
                }
                Spacer(minLength: 0)
            }
            .padding(.bottom, isLast ? 0 : 18)
        }
    }

    /// Deterministic color per calendar — uses nudgeChart1..5 tokens
    /// so events from the same calendar always get the same accent.
    private func calendarAccent(for calendarId: String) -> Color {
        let palette: [Color] = [
            .nudgeChart2, .nudgeChart5, .nudgeChart3, .nudgeChart4, .nudgeChart1
        ]
        let hash = abs(calendarId.hashValue)
        return palette[hash % palette.count]
    }

    /// Extracts HH:mm from an ISO-8601 string like `2026-04-21T11:30:00+08:00`.
    /// Uses the event's own timezone; avoids conversion through `Date`
    /// which would re-anchor to the phone's timezone.
    private func shortTime(_ iso: String) -> String {
        guard let tIndex = iso.firstIndex(of: "T") else { return iso }
        let afterT = iso.index(after: tIndex)
        let rest = iso[afterT...]
        return String(rest.prefix(5))
    }
}

import SwiftUI
import NudgeCore
#if canImport(UIKit)
import UIKit
#elseif canImport(AppKit)
import AppKit
#endif

/// Read-only event details presented as a bottom sheet.
/// Sections render only when their underlying field is non-empty.
public struct CalendarEventDetailSheet: View {
    public let event: CalendarEventDTO
    @Environment(\.locale) private var locale

    public init(event: CalendarEventDTO) {
        self.event = event
    }

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    timeAndTitle

                    if !event.hangoutLink.isEmpty, let url = URL(string: event.hangoutLink) {
                        joinMeetingButton(url: url)
                    }

                    if let loc = event.location, !loc.isEmpty {
                        infoRow(systemImage: "mappin.and.ellipse", text: loc)
                    }

                    infoRow(systemImage: "calendar", text: event.calendarName)

                    if let desc = event.description, !desc.isEmpty {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("calendar.description", bundle: .module)
                                .font(.caption.weight(.medium))
                                .foregroundStyle(Color.nudgeTextDim)
                            Text(verbatim: desc)
                                .font(.subheadline)
                                .foregroundStyle(Color.nudgeForeground)
                        }
                    }

                    if !event.attendees.isEmpty {
                        VStack(alignment: .leading, spacing: 6) {
                            Text(verbatim: "\(nudgeLocalized("calendar.attendees", locale: locale)) (\(event.attendees.count))")
                                .font(.caption.weight(.medium))
                                .foregroundStyle(Color.nudgeTextDim)
                            ForEach(event.attendees, id: \.self) { a in
                                Text(verbatim: "• \(a)")
                                    .font(.subheadline)
                                    .foregroundStyle(Color.nudgeForeground)
                            }
                        }
                    }
                }
                .padding(20)
            }
            .background(Color.nudgeBackground)
        }
        #if os(iOS)
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        #endif
    }

    private var timeAndTitle: some View {
        VStack(alignment: .leading, spacing: 6) {
            if event.allDay {
                Text("calendar.eventAllDay", bundle: .module)
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Color.nudgeTextDim)
            } else {
                Text(verbatim: "\(shortTime(event.start)) – \(shortTime(event.end))")
                    .font(.footnote.weight(.semibold))
                    .monospacedDigit()
                    .foregroundStyle(Color.nudgeTextDim)
            }
            Text(verbatim: event.title)
                .font(.title3.weight(.semibold))
                .foregroundStyle(Color.nudgeForeground)
        }
    }

    private func joinMeetingButton(url: URL) -> some View {
        Button {
            #if os(iOS)
            UIApplication.shared.open(url)
            #elseif os(macOS)
            NSWorkspace.shared.open(url)
            #endif
        } label: {
            Label {
                Text("calendar.joinMeeting", bundle: .module)
            } icon: {
                Image(systemName: "video.fill")
            }
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(Color.nudgePrimaryForeground)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(RoundedRectangle(cornerRadius: 10).fill(Color.nudgePrimary))
        }
        .buttonStyle(.plain)
    }

    private func infoRow(systemImage: String, text: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: systemImage)
                .foregroundStyle(Color.nudgeTextDim)
            Text(verbatim: text)
                .font(.subheadline)
                .foregroundStyle(Color.nudgeForeground)
        }
    }

    private func shortTime(_ iso: String) -> String {
        guard let tIndex = iso.firstIndex(of: "T") else { return iso }
        let afterT = iso.index(after: tIndex)
        return String(iso[afterT...].prefix(5))
    }
}

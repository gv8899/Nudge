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
    @Environment(\.dismiss) private var dismiss

    public init(event: CalendarEventDTO) {
        self.event = event
    }

    public var body: some View {
        // mac 跟 iOS chrome 不同 — iOS 走 NavigationStack 利用 sheet
        // drag indicator + .topBarTrailing 「完成」；mac 沒 drag indicator，
        // 而 NavigationStack 的 .confirmationAction toolbar 在 mac sheet 會
        // 渲染成底部白色 material 條，跟 sheet 的 cream bg 撞色。改成 mac
        // 直接 inline 「完成」按鈕、不掛 NavigationStack。
        #if os(macOS)
        VStack(spacing: 0) {
            content
            macFooter
        }
        .background(Color.nudgeBackground)
        #else
        NavigationStack {
            content
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .presentationBackground(Color.nudgeBackground)
        #endif
    }

    @ViewBuilder
    private var content: some View {
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
                            .font(.footnote.weight(.medium))
                            .foregroundStyle(Color.nudgeTextDim)
                        Text(verbatim: desc)
                            .font(.body)
                            .foregroundStyle(Color.nudgeForeground)
                    }
                }

                if !event.attendees.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(verbatim: "\(nudgeLocalized("calendar.attendees", locale: locale)) (\(event.attendees.count))")
                            .font(.footnote.weight(.medium))
                            .foregroundStyle(Color.nudgeTextDim)
                        VStack(alignment: .leading, spacing: 6) {
                            ForEach(event.attendees, id: \.self) { a in
                                attendeeRow(a)
                            }
                        }
                    }
                }
            }
            .padding(20)
        }
    }

    #if os(macOS)
    private var macFooter: some View {
        HStack {
            Spacer()
            Button { dismiss() } label: {
                Text("common.done", bundle: .module)
            }
            .keyboardShortcut(.cancelAction)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
        // 底部 footer 維持 sheet 同色 — 不額外加 material / divider，
        // 視覺上 footer 就是內容區的延伸。
    }
    #endif

    private var timeAndTitle: some View {
        VStack(alignment: .leading, spacing: 8) {
            // 時間 row — 含日期前綴：避免多場會議放一起時對不上是哪天。
            // all-day / timed 都會顯示日期。
            Text(verbatim: timeRowText)
                .font(.subheadline.weight(.semibold))
                .monospacedDigit()
                .foregroundStyle(Color.nudgeTextDim)
            Text(verbatim: event.title)
                .font(.title2.weight(.semibold))
                .foregroundStyle(Color.nudgeForeground)
        }
    }

    private var timeRowText: String {
        let datePrefix = formattedDate(event.start)
        if event.allDay {
            let allDay = nudgeLocalized("calendar.eventAllDay", locale: locale)
            return "\(datePrefix) · \(allDay)"
        }
        return "\(datePrefix) · \(shortTime(event.start)) – \(shortTime(event.end))"
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
            .font(.body.weight(.semibold))
            .foregroundStyle(Color.nudgePrimaryForeground)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(RoundedRectangle(cornerRadius: 8).fill(Color.nudgePrimary))
        }
        .buttonStyle(.plain)
    }

    private func infoRow(systemImage: String, text: String) -> some View {
        HStack(spacing: 10) {
            Image(systemName: systemImage)
                .font(.body)
                .foregroundStyle(Color.nudgeTextDim)
                .frame(width: 20)
            Text(verbatim: text)
                .font(.body)
                .foregroundStyle(Color.nudgeForeground)
        }
    }

    /// Attendee row — 用 token 色小圓點代替原本 `• name` literal bullet。
    /// dot 跟 infoRow icon column 同寬 (20pt) 視覺對齊。
    private func attendeeRow(_ name: String) -> some View {
        HStack(spacing: 10) {
            Circle()
                .fill(Color.nudgeTextDim.opacity(0.5))
                .frame(width: 5, height: 5)
                .frame(width: 20, alignment: .center)
            Text(verbatim: name)
                .font(.body)
                .foregroundStyle(Color.nudgeForeground)
        }
    }

    private func shortTime(_ iso: String) -> String {
        guard let tIndex = iso.firstIndex(of: "T") else { return iso }
        let afterT = iso.index(after: tIndex)
        return String(iso[afterT...].prefix(5))
    }

    private func formattedDate(_ iso: String) -> String {
        // 取 'T' 前的 YYYY-MM-DD parse 成 Date，再用 locale 格式化成
        // 「5月7日 (週四)」(zh) / "May 7 (Thu)" (en)。
        let datePart: String
        if let t = iso.firstIndex(of: "T") {
            datePart = String(iso[..<t])
        } else {
            datePart = iso
        }
        let parser = DateFormatter()
        parser.dateFormat = "yyyy-MM-dd"
        parser.locale = Locale(identifier: "en_US_POSIX")
        guard let date = parser.date(from: datePart) else { return datePart }
        let formatter = DateFormatter()
        formatter.locale = locale
        formatter.setLocalizedDateFormatFromTemplate("MMMd EEE")
        return formatter.string(from: date)
    }
}

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
        // mac: popover 自帶「點外面 / Esc 就關」，不需要「完成」按鈕。
        // iOS: 仍走 sheet + drag indicator（下滑可關）。
        #if os(macOS)
        content
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
            // .frame(maxWidth: .infinity, alignment: .leading) 強制 VStack
            // 撐滿 ScrollView 寬度。沒這條時，短 content（單純事件，無
            // join button / 與會者）的 VStack intrinsic 寬度 < ScrollView，
            // 會被 ScrollView 預設水平置中 → 跟有 join button 那種展開到
            // 滿寬的事件視覺風格不一致。
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
                    VStack(alignment: .leading, spacing: 8) {
                        Text("calendar.description", bundle: .module)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Color.nudgeForeground)
                        Text(verbatim: desc)
                            .font(.body)
                            .foregroundStyle(Color.nudgeForeground)
                    }
                }

                if !event.attendees.isEmpty {
                    // 與會者 section 跟上方 infoRow 之間加細分隔線，建立
                    // chunk 邊界、減少一坨 cream 沒層次的閱讀疲勞。
                    Divider()
                        .background(Color.nudgeBorderLight)
                    VStack(alignment: .leading, spacing: 10) {
                        Text(verbatim: "\(nudgeLocalized("calendar.attendees", locale: locale)) (\(event.attendees.count))")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Color.nudgeForeground)
                        VStack(alignment: .leading, spacing: 6) {
                            ForEach(event.attendees, id: \.self) { a in
                                attendeeRow(a)
                            }
                        }
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(20)
        }
    }

    private var timeAndTitle: some View {
        VStack(alignment: .leading, spacing: 8) {
            // 時間 row — 主要 metadata，從 nudgeTextDim 拉成 nudgeForeground
            // 70% 對比，比原本灰更好讀但仍弱於標題。
            Text(verbatim: timeRowText)
                .font(.subheadline.weight(.semibold))
                .monospacedDigit()
                .foregroundStyle(Color.nudgeForeground.opacity(0.7))
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
                .fill(Color.nudgeTextDim.opacity(0.8))
                .frame(width: 6, height: 6)
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

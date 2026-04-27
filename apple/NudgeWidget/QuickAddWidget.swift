// apple/NudgeWidget/QuickAddWidget.swift
import WidgetKit
import SwiftUI

struct QuickAddProvider: TimelineProvider {
    func placeholder(in context: Context) -> QuickAddEntry {
        QuickAddEntry(date: Date())
    }

    func getSnapshot(in context: Context, completion: @escaping (QuickAddEntry) -> Void) {
        completion(QuickAddEntry(date: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<QuickAddEntry>) -> Void) {
        // Static widget — no data, no refresh needed.
        completion(Timeline(entries: [QuickAddEntry(date: Date())], policy: .never))
    }
}

struct QuickAddEntry: TimelineEntry {
    let date: Date
}

struct QuickAddWidgetEntryView: View {
    let entry: QuickAddEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        switch family {
        case .systemSmall:
            smallView
        case .accessoryRectangular:
            lockRectangularView
        default:
            smallView
        }
    }

    private var smallView: some View {
        VStack(alignment: .leading, spacing: 0) {
            ZStack {
                Circle()
                    .fill(Color(red: 0.66, green: 0.48, blue: 0.27)) // #a87a45 // nudge:allow-color
                Text(verbatim: "＋")
                    .font(.system(size: 32, weight: .light))
                    .foregroundStyle(.white)
            }
            .frame(width: 56, height: 56)
            Spacer()
            // Single label — the subtitle "新增/Add" duplicated the icon's
            // meaning and the "新增任務" headline, so it was removed.
            Text("widget.quickAdd.label", bundle: .main)
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(Color(red: 0.11, green: 0.11, blue: 0.09)) // #1c1b18 // nudge:allow-color
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .containerBackground(Color(red: 0.94, green: 0.91, blue: 0.83), for: .widget) // #efe9d4 // nudge:allow-color
        .widgetURL(URL(string: "nudge://daily/new"))
    }

    private var lockRectangularView: some View {
        HStack(spacing: 10) {
            ZStack {
                Circle()
                    .fill(.primary)
                Text(verbatim: "＋")
                    .font(.system(size: 22, weight: .light))
                    .foregroundStyle(.background)
            }
            .frame(width: 32, height: 32)
            VStack(alignment: .leading, spacing: 2) {
                Text("widget.quickAdd.label", bundle: .main)
                    .font(.system(size: 14, weight: .semibold))
                Text(verbatim: "Nudge")
                    .font(.system(size: 11, weight: .medium))
                    .opacity(0.7)
            }
            Spacer(minLength: 0)
        }
        .containerBackground(.clear, for: .widget)
        .widgetURL(URL(string: "nudge://daily/new"))
    }
}

struct QuickAddWidget: Widget {
    let kind: String = "tw.nudge.app.QuickAddWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: QuickAddProvider()) { entry in
            QuickAddWidgetEntryView(entry: entry)
        }
        .configurationDisplayName(LocalizedStringResource("widget.kind.quickAdd.displayName"))
        .description(LocalizedStringResource("widget.kind.quickAdd.description"))
        .supportedFamilies([.systemSmall, .accessoryRectangular])
    }
}

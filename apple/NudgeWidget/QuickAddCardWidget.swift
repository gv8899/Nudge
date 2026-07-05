// apple/NudgeWidget/QuickAddCardWidget.swift
//
// Sibling of QuickAddWidget — small + lock-rect quick action that deep-links
// into the app, switches to the Cards tab and creates a new empty card.
// Uses the same circle-pill visual language as QuickAddWidget but swaps the
// "+" glyph for an `square.stack` SF Symbol — same icon as the Cards tab in
// PlatformRootView, so the widget → tab connection is obvious at a glance.
import WidgetKit
import SwiftUI

struct QuickAddCardProvider: TimelineProvider {
    func placeholder(in context: Context) -> QuickAddCardEntry {
        QuickAddCardEntry(date: Date())
    }

    func getSnapshot(in context: Context, completion: @escaping (QuickAddCardEntry) -> Void) {
        completion(QuickAddCardEntry(date: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<QuickAddCardEntry>) -> Void) {
        // Static widget — no data, no refresh needed.
        completion(Timeline(entries: [QuickAddCardEntry(date: Date())], policy: .never))
    }
}

struct QuickAddCardEntry: TimelineEntry {
    let date: Date
}

struct QuickAddCardWidgetEntryView: View {
    let entry: QuickAddCardEntry
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

    // Button(intent:) 取代 .widgetURL — 詳細見 QuickAddWidget 同樣 pattern。
    private var smallView: some View {
        Button(intent: QuickAddCardIntent()) {
            VStack(alignment: .leading, spacing: 0) {
                ZStack {
                    Circle()
                        .fill(Color(red: 0.66, green: 0.48, blue: 0.27)) // #a87a45 — same primary tint as Tasks Quick Add for brand consistency; differentiation comes from the glyph below. // nudge:allow-color
                    Image(systemName: "square.stack")
                        .font(.system(size: 28, weight: .regular))
                        .foregroundStyle(.white)
                }
                .frame(width: 56, height: 56)
                Spacer()
                // Single label — no subtitle, mirrors QuickAddWidget shape.
                Text("widget.quickAddCard.label", bundle: .main)
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(Color(red: 0.11, green: 0.11, blue: 0.09)) // #1c1b18 // nudge:allow-color
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
        .buttonStyle(.plain)
        .containerBackground(Color(red: 0.94, green: 0.91, blue: 0.83), for: .widget) // #efe9d4 // nudge:allow-color
    }

    // 鎖定畫面走 `.widgetURL`（`nudge://card/new`）— 理由同 QuickAddWidget：
    // 鎖定畫面的 Button(intent:) 不會把 app 帶到前景，點了像沒反應。
    private var lockRectangularView: some View {
        HStack(spacing: 10) {
            ZStack {
                Circle()
                    .fill(.primary)
                Image(systemName: "square.stack")
                    .font(.system(size: 22, weight: .regular))
                    .foregroundStyle(.background)
            }
            .frame(width: 32, height: 32)
            VStack(alignment: .leading, spacing: 2) {
                Text("widget.quickAddCard.label", bundle: .main)
                    .font(.system(size: 14, weight: .semibold))
                Text(verbatim: "Nudge")
                    .font(.system(size: 11, weight: .medium))
                    .opacity(0.7)
            }
            Spacer(minLength: 0)
        }
        .widgetURL(URL(string: "nudge://card/new"))
        .containerBackground(.clear, for: .widget)
    }
}

struct QuickAddCardWidget: Widget {
    let kind: String = "tw.nudge.app.QuickAddCardWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: QuickAddCardProvider()) { entry in
            QuickAddCardWidgetEntryView(entry: entry)
        }
        .configurationDisplayName(LocalizedStringResource("widget.kind.quickAddCard.displayName"))
        .description(LocalizedStringResource("widget.kind.quickAddCard.description"))
        .supportedFamilies([.systemSmall, .accessoryRectangular])
    }
}

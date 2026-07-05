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

    // 整個 widget 包成 Button(intent:) — 取代 .widgetURL 避免 iOS 偶爾
    // cold-launch replay。user 必須真的點才 fire；點了 iOS 會跑 intent
    // perform() (寫 shared flag)、然後因為 openAppWhenRun=true 把 app 帶到
    // 前景。app 端 scenePhase=.active handler 讀 flag 開 modal。
    // .buttonStyle(.plain) — 不要 system button chrome (邊框 / 高亮)。
    private var smallView: some View {
        Button(intent: QuickAddTaskIntent()) {
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
        }
        .buttonStyle(.plain)
        .containerBackground(Color(red: 0.94, green: 0.91, blue: 0.83), for: .widget) // #efe9d4 // nudge:allow-color
    }

    // 鎖定畫面走 `.widgetURL` 而非 Button(intent:)：鎖定畫面的互動按鈕
    // iOS 只在背景跑 intent、不會把 app 帶到前景（openAppWhenRun 無效），
    // 使用者點了看起來像沒反應。deep link 會在解鎖後開 app，由
    // NotificationRouter.handleWidgetURL 接 `nudge://daily/new` 開快速
    // 新增。主畫面 systemSmall 維持 Button(intent:)（cold-launch replay
    // 的考量只在主畫面那條路徑）。
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
        .widgetURL(URL(string: "nudge://daily/new"))
        .containerBackground(.clear, for: .widget)
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

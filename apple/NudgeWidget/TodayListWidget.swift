// apple/NudgeWidget/TodayListWidget.swift
import AppIntents
import WidgetKit
import SwiftUI
import NudgeCore

struct TodayListProvider: TimelineProvider {
    private let store = WidgetSnapshotStore()

    func placeholder(in context: Context) -> TodayListEntry {
        TodayListEntry(
            date: Date(),
            snapshot: WidgetSnapshot(
                date: isoToday(),
                generatedAt: Date(),
                tasks: [
                    WidgetSnapshotTask(assignmentId: "a", taskId: "t", title: "—", isCompleted: false, isOverdue: false),
                ]
            )
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (TodayListEntry) -> Void) {
        let snap = store.read() ?? WidgetSnapshot(date: isoToday(), generatedAt: Date(), tasks: [])
        completion(TodayListEntry(date: Date(), snapshot: snap))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<TodayListEntry>) -> Void) {
        let now = Date()
        let today = isoToday()
        let raw = store.read()
        // Stale-day guard: if the snapshot was written for a different day,
        // render empty rather than showing yesterday's leftovers as if they
        // were today's plan. The App writes a fresh snapshot on launch and
        // on scenePhase .active, so the next foreground brings it back.
        let snap: WidgetSnapshot = {
            if let s = raw, s.date == today { return s }
            return WidgetSnapshot(date: today, generatedAt: now, tasks: [])
        }()
        let entry = TodayListEntry(date: now, snapshot: snap)
        // Schedule a refresh at midnight so the widget rolls over at day
        // boundary even before the App next opens (will re-evaluate the
        // stale-day guard above).
        let cal = Calendar.current
        let tomorrow = cal.date(byAdding: .day, value: 1, to: cal.startOfDay(for: now)) ?? now
        completion(Timeline(entries: [entry], policy: .after(tomorrow)))
    }

    private func isoToday() -> String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.locale = Locale(identifier: "en_US_POSIX")
        return f.string(from: Date())
    }
}

struct TodayListEntry: TimelineEntry {
    let date: Date
    let snapshot: WidgetSnapshot
}

struct TodayListWidgetEntryView: View {
    let entry: TodayListEntry

    var body: some View {
        Group {
            if entry.snapshot.tasks.isEmpty {
                VStack {
                    Spacer()
                    Text("widget.todayList.empty", bundle: .main)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(Color(red: 0.43, green: 0.41, blue: 0.33)) // nudge:allow-color
                    Spacer()
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(entry.snapshot.tasks.prefix(5)) { task in
                        TodayListRow(task: task, date: entry.snapshot.date)
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            }
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 14)
        .containerBackground(Color(red: 0.94, green: 0.91, blue: 0.83), for: .widget) // nudge:allow-color
    }
}

struct TodayListRow: View {
    let task: WidgetSnapshotTask
    let date: String

    var body: some View {
        HStack(spacing: 9) {
            Button(intent: ToggleTaskCompletionIntent(
                assignmentId: task.assignmentId,
                date: date,
                isCompleted: !task.isCompleted
            )) {
                checkbox
            }
            .buttonStyle(.plain)

            Link(destination: URL(string: "nudge://task/\(task.taskId)")!) {
                // No OVERDUE badge — overdue items naturally roll into
                // today's list (matching Daily tab) and the red label felt
                // like nagging. The data model still flags isOverdue so the
                // snapshot mapper can keep them sorted to the top.
                Text(verbatim: task.title)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(task.isCompleted
                        ? Color(red: 0.43, green: 0.41, blue: 0.33) // nudge:allow-color
                        : Color(red: 0.11, green: 0.11, blue: 0.09)) // nudge:allow-color
                    .strikethrough(task.isCompleted)
                    .opacity(task.isCompleted ? 0.6 : 1.0)
                    .lineLimit(1)
                    .truncationMode(.tail)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .buttonStyle(.plain)
        }
    }

    /// Match the App's `NudgeCheckbox` look (square SF Symbol `square` /
    /// `checkmark.square.fill`) so the widget feels like a piece of the
    /// same product.
    @ViewBuilder
    private var checkbox: some View {
        Image(systemName: task.isCompleted ? "checkmark.square.fill" : "square")
            .font(.title3)
            .foregroundStyle(
                task.isCompleted
                    ? Color(red: 0.66, green: 0.48, blue: 0.27)  // #a87a45 nudgePrimary // nudge:allow-color
                    : Color(red: 0.43, green: 0.41, blue: 0.33)  // #6e6855 nudgeTextDim // nudge:allow-color
            )
    }
}

struct TodayListWidget: Widget {
    let kind: String = "tw.nudge.app.TodayListWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: TodayListProvider()) { entry in
            TodayListWidgetEntryView(entry: entry)
        }
        .configurationDisplayName(LocalizedStringResource("widget.kind.todayList.displayName"))
        .description(LocalizedStringResource("widget.kind.todayList.description"))
        .supportedFamilies([.systemMedium])
    }
}

import SwiftUI
import NudgeCore

/// Modal wrapper around `ScheduleSection` — opened from the card detail
/// view's `…` menu. Auto-saves on every change (no Save button); the
/// trailing toolbar item is "Done" so the user has a clear way out.
public struct ScheduleEditSheet: View {
    public let taskId: String
    public let taskTitle: String
    @Binding var initialAbsoluteRemindAt: String?
    public let onChangeAbsoluteRemindAt: (String?) -> Void
    public let onDone: () -> Void

    public init(
        taskId: String,
        taskTitle: String,
        initialAbsoluteRemindAt: Binding<String?>,
        onChangeAbsoluteRemindAt: @escaping (String?) -> Void,
        onDone: @escaping () -> Void
    ) {
        self.taskId = taskId
        self.taskTitle = taskTitle
        self._initialAbsoluteRemindAt = initialAbsoluteRemindAt
        self.onChangeAbsoluteRemindAt = onChangeAbsoluteRemindAt
        self.onDone = onDone
    }

    public var body: some View {
        NavigationStack {
            ScrollView {
                ScheduleSection(
                    taskId: taskId,
                    taskTitle: taskTitle,
                    initialAbsoluteRemindAt: $initialAbsoluteRemindAt,
                    onChangeAbsoluteRemindAt: onChangeAbsoluteRemindAt
                )
                .padding(16)
            }
            // Background owned by `.presentationBackground` below — see
            // CalendarEventDetailSheet for why a ScrollView .background
            // on top of the system sheet material reads as double-card.
            .navigationTitle(Text("cardDetail.schedule", bundle: .module))
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                #if os(iOS)
                ToolbarItem(placement: .topBarTrailing) {
                    Button(action: onDone) {
                        Text("common.done", bundle: .module)
                            .font(.body.weight(.semibold))
                            .foregroundStyle(Color.nudgePrimary)
                    }
                }
                #else
                ToolbarItem(placement: .confirmationAction) {
                    Button(action: onDone) {
                        Text("common.done", bundle: .module)
                    }
                }
                #endif
            }
        }
    }
}

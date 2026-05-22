import SwiftUI
import NudgeCore

/// Modal wrapper around `ScheduleSection`。拿掉 NavigationStack — title
/// bar + toolbar 雙重 chrome 浪費版面、"完成" 按鈕被系統渲染成藍色不吃
/// nudgePrimary。自畫 chrome：頂端 title、底端 nudgePrimary capsule 完成。
/// Background apply nudgeBackground，消除「白色 sheet 飄在 cream app 上」的
/// 不協調感。Auto-save on each change，"完成" 只是 dismiss。
public struct ScheduleEditSheet: View {
    public let taskId: String
    public let taskTitle: String
    @Binding var initialAbsoluteRemindAt: String?
    public let onChangeAbsoluteRemindAt: (String?) -> Void
    /// Recurrence add/update/delete 完成 (server-confirmed) 時觸發。Parent
    /// 接這條 callback 做 reload — 確保 reload 一定在 server write 完之後、
    /// 不會 race。修「toggle off → reload → 拿到 stale isRecurring=true」bug。
    public let onRecurrenceChanged: (TaskRecurrenceDTO?) -> Void
    public let onDone: () -> Void

    /// 跟 ScheduleSection 共享的 pending save task — 「完成」按下時 await
    /// 這個確認 server write 完才呼叫 onDone (parent 才 reload)。
    @State private var pendingSaveTask: Task<Void, Never>?

    public init(
        taskId: String,
        taskTitle: String,
        initialAbsoluteRemindAt: Binding<String?>,
        onChangeAbsoluteRemindAt: @escaping (String?) -> Void,
        onRecurrenceChanged: @escaping (TaskRecurrenceDTO?) -> Void = { _ in },
        onDone: @escaping () -> Void
    ) {
        self.taskId = taskId
        self.taskTitle = taskTitle
        self._initialAbsoluteRemindAt = initialAbsoluteRemindAt
        self.onChangeAbsoluteRemindAt = onChangeAbsoluteRemindAt
        self.onRecurrenceChanged = onRecurrenceChanged
        self.onDone = onDone
    }

    public var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                ScheduleSection(
                    taskId: taskId,
                    taskTitle: taskTitle,
                    initialAbsoluteRemindAt: $initialAbsoluteRemindAt,
                    onChangeAbsoluteRemindAt: onChangeAbsoluteRemindAt,
                    onRecurrenceChanged: onRecurrenceChanged,
                    pendingSaveTask: $pendingSaveTask
                )
                .padding(.horizontal, 20)
                .padding(.top, 20) // 拿掉 header 後 top padding 補回來
                .padding(.bottom, 16)
            }
            .frame(maxHeight: .infinity)
            footer
        }
        .background(Color.nudgeBackground)
        .overlay(
            // 隱形按鈕承載 ⎋ shortcut → 觸發 onDone (一致於「點空白」「按完成」)
            Button("", action: {
                Task {
                    await pendingSaveTask?.value
                    await MainActor.run { onDone() }
                }
            })
                .keyboardShortcut(.cancelAction)
                .opacity(0)
                .frame(width: 0, height: 0)
                .accessibilityHidden(true)
        )
    }

    private var footer: some View {
        HStack {
            Spacer()
            Button {
                // 「完成」前先 await 任何 pending save — 保證 server write 完
                // 才呼叫 parent's onDone (parent reload 時 server 已 fresh)。
                // 沒 pending 時 await nil immediate return、無延遲。
                Task {
                    await pendingSaveTask?.value
                    await MainActor.run { onDone() }
                }
            } label: {
                Text("common.done", bundle: .module)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Color.nudgePrimaryForeground)
                    .padding(.horizontal, 24)
                    .padding(.vertical, 10)
                    .background(Capsule().fill(Color.nudgePrimary))
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .keyboardShortcut(.defaultAction)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 14)
    }
}

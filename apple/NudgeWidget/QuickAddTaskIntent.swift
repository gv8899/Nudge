// apple/NudgeWidget/QuickAddTaskIntent.swift
import AppIntents
import NudgeCore

/// Widget button → 開 app + 跳「新增任務」modal。
///
/// 取代之前的 `.widgetURL("nudge://daily/new")`：URL deep link 會被 iOS
/// 偶爾 cold-launch replay (user 從 app icon 開也跳 modal)。AppIntent
/// + shared flag 的 IPC 路徑沒有 URL queue 可被系統 replay。
struct QuickAddTaskIntent: AppIntent {
    static let title: LocalizedStringResource = "Quick add task"
    static let description = IntentDescription(
        "Open Nudge to add a new task."
    )

    /// 讓 iOS 在 perform 完成後把 app 帶到前景（widget extension 自己沒
    /// 視覺、只能透過這個叫 host app 起來）。
    static let openAppWhenRun: Bool = true

    init() {}

    func perform() async throws -> some IntentResult {
        // 寫 flag 到 App Group。App 的 scenePhase=.active handler 會 consume
        // 並設 NotificationRouter.pendingNewTask = true → DailyHostView 開
        // QuickAddTaskSheet。
        SharedQuickAddFlagStore().markTaskPending()
        return .result()
    }
}

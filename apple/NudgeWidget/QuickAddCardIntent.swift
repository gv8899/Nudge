// apple/NudgeWidget/QuickAddCardIntent.swift
import AppIntents
import NudgeCore

/// Widget button → 開 app + 跳「新增卡片」modal。詳細見
/// QuickAddTaskIntent 的 doc comment（同一套 IPC 模式，只是 task → card）。
struct QuickAddCardIntent: AppIntent {
    static let title: LocalizedStringResource = "Quick add card"
    static let description = IntentDescription(
        "Open Nudge to add a new card."
    )

    static let openAppWhenRun: Bool = true

    init() {}

    func perform() async throws -> some IntentResult {
        SharedQuickAddFlagStore().markCardPending()
        return .result()
    }
}

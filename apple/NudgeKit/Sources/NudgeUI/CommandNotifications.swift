#if os(macOS)
import Foundation
import SwiftUI
import NudgeCore

/// macOS 選單列命令統一接點：常數 (`Notification.Name`) 與 Commands 視圖
/// (`NudgeCommandsMenu`) 都集中在 NudgeUI，這樣 feature view 可以
/// `onReceive` 同一組事件、app target 只需加上 `.commands { ... }`。
///
/// 之前 Commands+macOS.swift 在 app target、Notification.Name 常數也跟著
/// 在 app target → NudgeUI 內的 view（如 sidebar 想監聽 ⌘1-4 切換 tab）
/// 看不到，循環不通。
public enum NudgeCommands {
    public static let newTaskNotification = Notification.Name("nudge.newTask")
    public static let prevDayNotification = Notification.Name("nudge.prevDay")
    public static let nextDayNotification = Notification.Name("nudge.nextDay")
    public static let todayNotification = Notification.Name("nudge.today")
    /// Tab 切換 — `object` 為 SidebarItem.rawValue ("today" / "calendar" /
    /// "cards" / "notes")。⌘1-4 在 menu bar 觸發。
    public static let switchTabNotification = Notification.Name("nudge.switchTab")
    /// Calendar mode 切換 — `object` 為 CalendarViewMode.rawValue。
    public static let switchCalendarModeNotification = Notification.Name("nudge.switchCalendarMode")
    /// Daily 週導覽。
    public static let prevWeekNotification = Notification.Name("nudge.prevWeek")
    public static let nextWeekNotification = Notification.Name("nudge.nextWeek")
    /// Cards 新增卡片 — root toolbar "+" 按鈕觸發。
    public static let createCardNotification = Notification.Name("nudge.createCard")
    /// Cards 全頁編輯返回列表 — 全頁時 root toolbar 把 "+" 換成返回鈕，
    /// 點了 post 這個，CardsHostView 收到後清掉 fullPageCard 回網格。
    public static let cardsBackNotification = Notification.Name("nudge.cardsBack")
    /// Cards 全頁編輯：window toolbar（返回那排）的「標籤 / 重複」按鈕 —
    /// post 後由 CardDetailView 收到開對應 sheet（tag picker / schedule）。
    public static let cardsManageTagsNotification = Notification.Name("nudge.cardsManageTags")
    public static let cardsScheduleNotification = Notification.Name("nudge.cardsSchedule")
    /// Notes feed / canvas 切換 — root toolbar 按鈕觸發。
    public static let notesToggleFeedNotification = Notification.Name("nudge.notesToggleFeed")
    /// Note 儲存完成 — `object` 為 date (YYYY-MM-DD)。Mac 永久 split 下
    /// 左側 feed list 用這個觸發 refetch，typing 完成後今日 entry 馬上
    /// 出現在 list（不用切分頁再切回來才更新）。
    public static let noteSavedNotification = Notification.Name("nudge.noteSaved")
    /// 開啟排程 modal — `object` 為 `ScheduleSheetRequest`。Mac 上排程 modal
    /// 由 `MacSidebarRoot` 用 overlay 在 window 層級渲染（而非 DailyHostView
    /// 的 `.sheet`），這樣 backdrop 能蓋到整個視窗、支援「點 modal 外取消」。
    /// macOS `.sheet` 是 size-to-content、撐不到全視窗、沒有可點的「外面」。
    public static let openScheduleNotification = Notification.Name("nudge.openSchedule")
    /// 排程 modal 關閉 / recurrence 變動 — DailyHostView 收到後 reload daily。
    public static let scheduleClosedNotification = Notification.Name("nudge.scheduleClosed")
    /// 開啟 task quick-edit popover — `object` 為 `DailyAssignmentDTO`。
    /// 同排程 modal：在 root 用 overlay 渲染、支援點外取消。
    public static let openTaskPopoverNotification = Notification.Name("nudge.openTaskPopover")
    /// Task popover 的「展開」— `object` 為 `DailyAssignmentDTO`，DailyHostView
    /// 收到後 push 到完整 detail 頁。
    public static let expandTaskNotification = Notification.Name("nudge.expandTask")
    /// 開啟快速新增 modal（FAB / ⌘N 觸發）。Mac 在 root overlay 渲染。
    public static let openQuickAddNotification = Notification.Name("nudge.openQuickAdd")
    /// 快速新增送出 — `object` 為 title String，DailyHostView 收到後建 task。
    public static let submitQuickAddNotification = Notification.Name("nudge.submitQuickAdd")
    /// 開啟「移到其他日期」modal — `object` 為 `DailyAssignmentDTO`。
    public static let openMoveToDateNotification = Notification.Name("nudge.openMoveToDate")
    /// 「移到其他日期」選定 — `object` 為 `MoveToDateResult`。
    public static let moveToDateNotification = Notification.Name("nudge.moveToDate")
}

/// 「移到其他日期」選定結果 payload。
public struct MoveToDateResult {
    public let assignment: DailyAssignmentDTO
    public let date: String

    public init(assignment: DailyAssignmentDTO, date: String) {
        self.assignment = assignment
        self.date = date
    }
}

/// 開啟排程 modal 的 payload — 透過 `openScheduleNotification` 的 `object`
/// 從 DailyHostView 傳到 MacSidebarRoot。Identifiable 讓它能餵 `.sheet(item:)`。
public struct ScheduleSheetRequest: Identifiable {
    public let taskId: String
    public let taskTitle: String
    public let remindAt: String?

    public var id: String { taskId }

    public init(taskId: String, taskTitle: String, remindAt: String?) {
        self.taskId = taskId
        self.taskTitle = taskTitle
        self.remindAt = remindAt
    }
}

/// macOS app menu bar — 開放以下命令：
/// - Tasks: New Task (⌘N)、Previous/Next Day (⌘← / ⌘→)、Today (⌘T)、
///   Previous/Next Week (⇧⌘← / ⇧⌘→)
/// - View: Today / Calendar / Cards / Notes (⌘1–4)、Day/Week/Month
///   (⌃⌘1–3，當在 Calendar 時生效)
public struct NudgeCommandsMenu: Commands {
    public init() {}

    public var body: some Commands {
        // File → New Task。CommandGroup(replacing: .newItem) 會把
        // 系統 New (⌘N) 換成我們自己的，避免 menu 出現空的
        // "New Window"。
        CommandGroup(replacing: .newItem) {
            Button("New Task") {
                NotificationCenter.default.post(name: NudgeCommands.newTaskNotification, object: nil)
            }
            .keyboardShortcut("n", modifiers: .command)
        }

        CommandMenu("Tasks") {
            Button("Previous Day") {
                NotificationCenter.default.post(name: NudgeCommands.prevDayNotification, object: nil)
            }
            .keyboardShortcut(.leftArrow, modifiers: .command)

            Button("Next Day") {
                NotificationCenter.default.post(name: NudgeCommands.nextDayNotification, object: nil)
            }
            .keyboardShortcut(.rightArrow, modifiers: .command)

            Button("Today") {
                NotificationCenter.default.post(name: NudgeCommands.todayNotification, object: nil)
            }
            .keyboardShortcut("t", modifiers: .command)

            Divider()

            Button("Previous Week") {
                NotificationCenter.default.post(name: NudgeCommands.prevWeekNotification, object: nil)
            }
            .keyboardShortcut(.leftArrow, modifiers: [.command, .shift])

            Button("Next Week") {
                NotificationCenter.default.post(name: NudgeCommands.nextWeekNotification, object: nil)
            }
            .keyboardShortcut(.rightArrow, modifiers: [.command, .shift])
        }

        CommandGroup(before: .toolbar) {
            // Tab 切換 ⌘1-4 — Apple Mail / Notes 慣例。
            Button("Today") {
                NotificationCenter.default.post(name: NudgeCommands.switchTabNotification, object: "today")
            }
            .keyboardShortcut("1", modifiers: .command)

            Button("Calendar") {
                NotificationCenter.default.post(name: NudgeCommands.switchTabNotification, object: "calendar")
            }
            .keyboardShortcut("2", modifiers: .command)

            Button("Cards") {
                NotificationCenter.default.post(name: NudgeCommands.switchTabNotification, object: "cards")
            }
            .keyboardShortcut("3", modifiers: .command)

            Button("Notes") {
                NotificationCenter.default.post(name: NudgeCommands.switchTabNotification, object: "notes")
            }
            .keyboardShortcut("4", modifiers: .command)

            Divider()

            // Calendar 模式切換 (⌃⌘1-3)，只在 Calendar tab 有意義；
            // 其他 tab 收到 notification 不影響。
            Button("Day View") {
                NotificationCenter.default.post(name: NudgeCommands.switchCalendarModeNotification, object: "day")
            }
            .keyboardShortcut("1", modifiers: [.command, .control])

            Button("Week View") {
                NotificationCenter.default.post(name: NudgeCommands.switchCalendarModeNotification, object: "week")
            }
            .keyboardShortcut("2", modifiers: [.command, .control])

            Button("Month View") {
                NotificationCenter.default.post(name: NudgeCommands.switchCalendarModeNotification, object: "month")
            }
            .keyboardShortcut("3", modifiers: [.command, .control])

            Divider()

            // 字級縮放 — Safari / Mail / Notes 慣例。`=` 跟 `+` 同
            // 鍵（不用按 shift），所以 ⌘= 就等於 ⌘+。⌘0 回原始。
            Button("Zoom In") {
                NotificationCenter.default.post(name: NudgeCommands.zoomInNotification, object: nil)
            }
            .keyboardShortcut("=", modifiers: .command)

            Button("Zoom Out") {
                NotificationCenter.default.post(name: NudgeCommands.zoomOutNotification, object: nil)
            }
            .keyboardShortcut("-", modifiers: .command)

            Button("Actual Size") {
                NotificationCenter.default.post(name: NudgeCommands.zoomResetNotification, object: nil)
            }
            .keyboardShortcut("0", modifiers: .command)
        }
    }
}
#endif

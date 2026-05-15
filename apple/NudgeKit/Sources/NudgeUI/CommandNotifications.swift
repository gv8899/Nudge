#if os(macOS)
import Foundation
import SwiftUI

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
    /// Notes feed / canvas 切換 — root toolbar 按鈕觸發。
    public static let notesToggleFeedNotification = Notification.Name("nudge.notesToggleFeed")
    /// Note 儲存完成 — `object` 為 date (YYYY-MM-DD)。Mac 永久 split 下
    /// 左側 feed list 用這個觸發 refetch，typing 完成後今日 entry 馬上
    /// 出現在 list（不用切分頁再切回來才更新）。
    public static let noteSavedNotification = Notification.Name("nudge.noteSaved")
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

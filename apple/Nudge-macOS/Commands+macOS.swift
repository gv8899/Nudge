#if os(macOS)
import SwiftUI

public struct NudgeCommands: Commands {
    public static let newTaskNotification = Notification.Name("nudge.newTask")
    public static let prevDayNotification = Notification.Name("nudge.prevDay")
    public static let nextDayNotification = Notification.Name("nudge.nextDay")
    public static let todayNotification = Notification.Name("nudge.today")

    public init() {}

    public var body: some Commands {
        CommandMenu("Tasks") {
            Button("New Task") {
                NotificationCenter.default.post(name: Self.newTaskNotification, object: nil)
            }
            .keyboardShortcut("n", modifiers: .command)

            Divider()

            Button("Previous Day") {
                NotificationCenter.default.post(name: Self.prevDayNotification, object: nil)
            }
            .keyboardShortcut(.leftArrow, modifiers: .command)

            Button("Next Day") {
                NotificationCenter.default.post(name: Self.nextDayNotification, object: nil)
            }
            .keyboardShortcut(.rightArrow, modifiers: .command)

            Button("Today") {
                NotificationCenter.default.post(name: Self.todayNotification, object: nil)
            }
            .keyboardShortcut("t", modifiers: .command)
        }
    }
}
#endif

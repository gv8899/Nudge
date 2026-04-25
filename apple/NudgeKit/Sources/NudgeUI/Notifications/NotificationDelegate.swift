#if os(iOS)
import Foundation
import UserNotifications

/// UNUserNotificationCenter delegate that:
/// - lets local notifications surface as a banner + sound even while the
///   app is in the foreground (iOS sim default would otherwise stay
///   silent and the user thinks the notification "didn't fire");
/// - routes taps on per-task notifications by writing the target task id
///   to the shared `NotificationRouter` so DailyHostView can push the
///   detail view.
public final class NudgeNotificationDelegate: NSObject, UNUserNotificationCenterDelegate, Sendable {
    public static let shared = NudgeNotificationDelegate()

    /// Set during app init so notification taps can drive navigation
    /// without coupling this delegate to the view layer.
    @MainActor public static var router: NotificationRouter?

    public func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        return [.banner, .list, .sound, .badge]
    }

    /// Use the completion-handler form (not the async-only variant). On
    /// iOS 26 the async variant crashes with
    /// `_performBlockAfterCATransactionCommitSynchronizes` when invoked
    /// during state restoration (cold launch from a notification tap),
    /// because UIKit assumes the delegate returns synchronously before
    /// snapshot/state-restoration finishes its CATransaction.
    public func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let taskId = response.notification.request.content.userInfo["task_id"] as? String
        if let taskId {
            Task { @MainActor in
                Self.router?.pendingTaskId = taskId
            }
        }
        completionHandler()
    }
}
#endif

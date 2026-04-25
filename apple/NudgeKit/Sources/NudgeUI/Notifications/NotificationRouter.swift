#if os(iOS)
import Foundation
import Observation

/// Shared sink for notification taps. The notification delegate writes
/// the target task id here; views (DailyHostView) observe it and push
/// the relevant detail page when it changes.
@Observable
@MainActor
public final class NotificationRouter {
    public var pendingTaskId: String?

    public init() {}

    /// Called by views once they've consumed the routing intent so a
    /// subsequent tap on the same notification can be routed again.
    public func clear() { pendingTaskId = nil }
}
#endif

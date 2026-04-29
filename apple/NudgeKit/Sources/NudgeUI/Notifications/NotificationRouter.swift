#if os(iOS)
import Foundation
import Observation

/// Shared sink for notification taps and widget URL deep links. The
/// notification delegate writes the target task id here; views
/// (DailyHostView, CardsHostView) observe it and push the relevant detail
/// page when it changes. Widget URL handling reuses the same pattern:
/// `nudge://task/<id>` sets `pendingTaskId`, `nudge://daily/new` sets
/// `pendingNewTask`, `nudge://card/new` sets `pendingNewCard`.
@Observable
@MainActor
public final class NotificationRouter {
    public var pendingTaskId: String?
    public var pendingNewTask: Bool = false
    public var pendingNewCard: Bool = false

    public init() {}

    /// Called by views once they've consumed the routing intent so a
    /// subsequent tap on the same notification / widget can be routed again.
    public func clear() {
        pendingTaskId = nil
        pendingNewTask = false
        pendingNewCard = false
    }

    /// Parse a `nudge://` URL from a widget tap. Returns true if handled.
    /// - `nudge://daily/new` → `pendingNewTask = true`
    /// - `nudge://card/new`  → `pendingNewCard = true`
    /// - `nudge://task/<id>` → `pendingTaskId = <id>`
    /// Other schemes/paths are ignored (caller may pass through to other handlers).
    @discardableResult
    public func handleWidgetURL(_ url: URL) -> Bool {
        guard url.scheme == "nudge" else { return false }
        let host = url.host
        let pathParts = url.pathComponents.filter { $0 != "/" }
        if host == "daily", pathParts.contains("new") {
            pendingNewTask = true
            return true
        }
        if host == "card", pathParts.contains("new") {
            pendingNewCard = true
            return true
        }
        if host == "task", let id = pathParts.last, !id.isEmpty {
            pendingTaskId = id
            return true
        }
        return false
    }
}
#endif

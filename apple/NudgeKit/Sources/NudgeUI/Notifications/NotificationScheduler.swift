#if os(iOS) || os(macOS)
import Foundation
import UserNotifications
import os
import NudgeCore

private let log = Logger(subsystem: "tw.nudge.app", category: "Notifications")

/// Schedules local notifications for the daily morning / evening summary
/// (repeating UNCalendarNotificationTrigger) and per-task reminders
/// (one-shot per occurrence within a sliding window).
///
/// All identifiers prefixed so we can scope-clear without disturbing
/// notifications scheduled by other features.
@MainActor
public final class NotificationScheduler {
    public static let shared = NotificationScheduler()
    private init() {}

    private let prefix = "task-reminder-"
    private let morningId = "daily-batch-morning"
    private let eveningId = "daily-batch-evening"

    /// Asks the system for notification authorization once. Returns true
    /// when the user has authorized (including provisional). Idempotent —
    /// safe to call on every app launch.
    public func requestAuthIfNeeded() async -> Bool {
        let center = UNUserNotificationCenter.current()
        let settings = await center.notificationSettings()
        if settings.authorizationStatus == .notDetermined {
            return (try? await center.requestAuthorization(options: [.alert, .sound, .badge])) ?? false
        }
        return settings.authorizationStatus == .authorized
            || settings.authorizationStatus == .provisional
    }

    // MARK: - Daily batch

    /// Replaces the morning/evening batch reminders to match the latest
    /// preferences. Call after launch and after the user changes prefs.
    /// Resolves all localized strings against NudgeUI's xcstrings bundle
    /// so the app target doesn't need its own Bundle.module.
    public func rescheduleDailyBatches(prefs: NotificationPreferencesDTO) async {
        let granted = await requestAuthIfNeeded()
        guard granted else {
            log.error("batches: auth not granted, skipping")
            return
        }
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: [morningId, eveningId])

        if prefs.morningEnabled {
            let (h, m) = parseHM(prefs.morningTime)
            let req = makeRepeatingRequest(
                id: morningId,
                hour: h, minute: m,
                title: NSLocalizedString("notifications.morning.title", bundle: .module, comment: ""),
                body: NSLocalizedString("notifications.morning.bodyTemplate", bundle: .module, comment: "")
            )
            await addLogged(center, req, label: "morning \(prefs.morningTime)")
        }
        if prefs.eveningEnabled {
            let (h, m) = parseHM(prefs.eveningTime)
            let req = makeRepeatingRequest(
                id: eveningId,
                hour: h, minute: m,
                title: NSLocalizedString("notifications.evening.title", bundle: .module, comment: ""),
                body: NSLocalizedString("notifications.evening.bodyTemplate", bundle: .module, comment: "")
            )
            await addLogged(center, req, label: "evening \(prefs.eveningTime)")
        }
    }

    // MARK: - Per-task

    /// Replaces all pending reminders for a single task. Pass either
    /// `absoluteRemindAt` (one-shot, non-recurring) or `recurrence` (with
    /// `remindAtTimeOfDay`); both nil clears the task's reminders.
    public func rescheduleTaskReminder(
        taskId: String,
        title: String,
        absoluteRemindAt: Date?,
        recurrence: TaskRecurrenceDTO?,
        windowDays: Int = 30
    ) async {
        let granted = await requestAuthIfNeeded()
        guard granted else {
            log.error("task \(taskId, privacy: .public): auth not granted, skipping")
            return
        }
        let center = UNUserNotificationCenter.current()
        await cancelTaskReminder(taskId: taskId)

        // 1) Absolute one-shot — used for non-recurring tasks.
        if let absolute = absoluteRemindAt, absolute > Date() {
            let comps = Calendar.current.dateComponents(
                [.year, .month, .day, .hour, .minute],
                from: absolute
            )
            let trigger = UNCalendarNotificationTrigger(dateMatching: comps, repeats: false)
            let content = UNMutableNotificationContent()
            content.title = title
            content.body = NSLocalizedString("notifications.task.reminderBody", bundle: .module, comment: "")
            content.sound = .default
            content.userInfo = ["task_id": taskId, "kind": "absolute"]
            let req = UNNotificationRequest(identifier: "\(prefix)\(taskId)", content: content, trigger: trigger)
            await addLogged(center, req, label: "task \(taskId) absolute \(absolute)")
        } else if let absolute = absoluteRemindAt {
            log.warning("task \(taskId, privacy: .public) absolute \(absolute, privacy: .public) is in the past, skipping")
        }

        // 2) Recurrence-driven per-occurrence reminders inside the window.
        guard let rec = recurrence, let timeOfDay = rec.remindAtTimeOfDay else { return }
        let (hour, minute) = parseHM(timeOfDay)
        let today = isoDate(Date())
        let until = isoDate(Date().addingTimeInterval(TimeInterval(windowDays) * 86400))
        let dates = RecurrenceCalculator.occurrences(rule: rec, from: today, to: until)
        var scheduled = 0
        for d in dates {
            guard let day = parseISODate(d) else { continue }
            var comps = Calendar.current.dateComponents([.year, .month, .day], from: day)
            comps.hour = hour
            comps.minute = minute
            // Skip past triggers (today's time-of-day already passed).
            if let fireDate = Calendar.current.date(from: comps), fireDate < Date() { continue }
            let trigger = UNCalendarNotificationTrigger(dateMatching: comps, repeats: false)
            let content = UNMutableNotificationContent()
            content.title = title
            content.body = NSLocalizedString("notifications.task.reminderBody", bundle: .module, comment: "")
            content.sound = .default
            content.userInfo = ["task_id": taskId, "kind": "occurrence", "date": d]
            let id = "\(prefix)\(taskId)-\(d.replacingOccurrences(of: "-", with: ""))"
            let req = UNNotificationRequest(identifier: id, content: content, trigger: trigger)
            do {
                try await center.add(req)
                scheduled += 1
            } catch {
                log.error("add failed for \(id, privacy: .public): \(error.localizedDescription, privacy: .public)")
            }
        }
        log.info("task \(taskId, privacy: .public) recurrence: \(scheduled) occurrences scheduled at \(timeOfDay, privacy: .public)")
    }

    /// Rebuilds the entire per-task reminder schedule from server state.
    /// Call on launch / foreground so reminders set on another device
    /// (local notifications are per-device) get armed here too — and so
    /// that reminders survive an app reinstall / cache clear.
    ///
    /// Clears every `task-reminder-*` pending request first, then re-arms
    /// each task in `reminders`. Tasks no longer in the list (reminder
    /// removed, task archived/completed) simply don't get re-added.
    public func rescheduleAllTaskReminders(_ reminders: [TaskReminderDTO]) async {
        let granted = await requestAuthIfNeeded()
        guard granted else {
            log.error("rescheduleAll: auth not granted, skipping")
            return
        }
        let center = UNUserNotificationCenter.current()
        let pending = await center.pendingNotificationRequests()
        let stale = pending
            .filter { $0.identifier.hasPrefix(prefix) }
            .map(\.identifier)
        center.removePendingNotificationRequests(withIdentifiers: stale)

        for reminder in reminders {
            await rescheduleTaskReminder(
                taskId: reminder.taskId,
                title: reminder.title,
                absoluteRemindAt: reminder.remindAt.flatMap(Self.parseISODateTime),
                recurrence: reminder.recurrence
            )
        }
        log.info("rescheduleAll: cleared \(stale.count), re-armed \(reminders.count) task(s)")
    }

    /// Removes every pending reminder belonging to `taskId`.
    public func cancelTaskReminder(taskId: String) async {
        let center = UNUserNotificationCenter.current()
        let pending = await center.pendingNotificationRequests()
        let mine = pending
            .filter { $0.identifier.hasPrefix("\(prefix)\(taskId)") }
            .map(\.identifier)
        center.removePendingNotificationRequests(withIdentifiers: mine)
    }

    // MARK: - Helpers

    private func makeRepeatingRequest(
        id: String,
        hour: Int,
        minute: Int,
        title: String,
        body: String
    ) -> UNNotificationRequest {
        var comps = DateComponents()
        comps.hour = hour
        comps.minute = minute
        let trigger = UNCalendarNotificationTrigger(dateMatching: comps, repeats: true)
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        return UNNotificationRequest(identifier: id, content: content, trigger: trigger)
    }

    private func addLogged(
        _ center: UNUserNotificationCenter,
        _ req: UNNotificationRequest,
        label: String
    ) async {
        do {
            try await center.add(req)
            log.info("scheduled \(req.identifier, privacy: .public) (\(label, privacy: .public))")
        } catch {
            log.error("add failed \(req.identifier, privacy: .public): \(error.localizedDescription, privacy: .public)")
        }
    }

    /// Diagnostic — log all pending requests this scheduler manages.
    public func dumpPending() async {
        let center = UNUserNotificationCenter.current()
        let pending = await center.pendingNotificationRequests()
        let mine = pending.filter {
            $0.identifier == morningId
                || $0.identifier == eveningId
                || $0.identifier.hasPrefix(prefix)
        }
        log.info("pending (\(mine.count)):")
        for req in mine {
            let trig = req.trigger as? UNCalendarNotificationTrigger
            let next = trig?.nextTriggerDate().map(String.init(describing:)) ?? "nil"
            log.info("  - \(req.identifier, privacy: .public) → next=\(next, privacy: .public), repeats=\(trig?.repeats ?? false)")
        }
    }

    /// Parses an ISO-8601 datetime string (with or without fractional
    /// seconds) into a Date. Used to turn the server's `remindAt` text
    /// back into the `absoluteRemindAt` Date the scheduler expects.
    static func parseISODateTime(_ s: String) -> Date? {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = f.date(from: s) { return d }
        f.formatOptions = [.withInternetDateTime]
        return f.date(from: s)
    }

    private func parseHM(_ s: String) -> (Int, Int) {
        let parts = s.split(separator: ":").compactMap { Int($0) }
        return (parts.first ?? 9, parts.count > 1 ? parts[1] : 0)
    }

    private func parseISODate(_ s: String) -> Date? {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = TimeZone.current
        f.locale = Locale(identifier: "en_US_POSIX")
        return f.date(from: s)
    }

    private func isoDate(_ d: Date) -> String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = TimeZone.current
        f.locale = Locale(identifier: "en_US_POSIX")
        return f.string(from: d)
    }
}
#endif

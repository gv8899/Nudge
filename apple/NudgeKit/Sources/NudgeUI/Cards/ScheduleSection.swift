import SwiftUI
import NudgeCore

/// Card-detail "schedule" block: recurrence rule + reminder time.
/// Auto-saves via the Recurrence and Card repositories with a 500 ms
/// debounce so rapid picker / stepper changes collapse into one PUT.
public struct ScheduleSection: View {
    public let taskId: String
    public let taskTitle: String
    @Binding var initialAbsoluteRemindAt: String?  // tasks.remindAt (ISO-8601)
    public let onChangeAbsoluteRemindAt: (String?) -> Void
    public let onRecurrenceChanged: (TaskRecurrenceDTO?) -> Void

    @Environment(RecurrenceRepository.self) private var recurrenceRepo
    @Environment(\.locale) private var locale

    @State private var isLoaded = false

    @State private var preset: RecurrencePreset? = nil   // nil = no recurrence
    @State private var weekdays: Set<Int> = []
    @State private var monthDay: Int = 1
    @State private var monthNth: Int = 1
    @State private var monthNthWeekday: Int = 1
    @State private var startDate: Date = Date()
    @State private var endDate: Date? = nil
    @State private var hasEndDate: Bool = false
    @State private var remindTimeOfDay: Date? = nil
    @State private var hasReminder: Bool = false
    @State private var absoluteRemindAt: Date? = nil

    /// Single shared debounce timer for both save paths — saveRecurrence
    /// and saveReminder both schedule into it; only the latest intent
    /// fires after 500 ms idle, preventing rapid-toggle race conditions.
    @State private var saveDebounce: DispatchWorkItem?

    public init(
        taskId: String,
        taskTitle: String,
        initialAbsoluteRemindAt: Binding<String?>,
        onChangeAbsoluteRemindAt: @escaping (String?) -> Void,
        onRecurrenceChanged: @escaping (TaskRecurrenceDTO?) -> Void = { _ in }
    ) {
        self.taskId = taskId
        self.taskTitle = taskTitle
        self._initialAbsoluteRemindAt = initialAbsoluteRemindAt
        self.onChangeAbsoluteRemindAt = onChangeAbsoluteRemindAt
        self.onRecurrenceChanged = onRecurrenceChanged
    }

    public var body: some View {
        Group {
            if isLoaded {
                // No outer card: the sheet (.presentationBackground) is
                // already the surface; an inner RoundedRectangle filled
                // with the same nudgeBackground produced the invisible
                // "card-within-card" stroke and added a layer of nothing.
                VStack(alignment: .leading, spacing: 20) {
                    recurrenceBlock
                    Divider().background(Color.nudgeBorderLight)
                    reminderBlock
                }
                .padding(16)
            } else {
                ProgressView()
                    .frame(maxWidth: .infinity)
                    .padding(20)
            }
        }
        .task(id: taskId) { await load() }
    }

    // MARK: - Recurrence block

    @ViewBuilder
    private var recurrenceBlock: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("schedule.recurrenceTitle", bundle: .module)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Color.nudgeForeground)
                Spacer()
                Picker(selection: presetBinding) {
                    Text("schedule.recurrence.off", bundle: .module).tag(Optional<RecurrencePreset>.none)
                    ForEach(RecurrencePreset.allCases) { p in
                        Text(p.localizedKey, bundle: .module).tag(Optional(p))
                    }
                } label: { EmptyView() }
                .pickerStyle(.menu)
                // Match SettingsView pickers: tint is the label colour
                // so selected value reads as continuation, not a tinted
                // CTA. (Was nudgePrimary, fought the rest of the page.)
                .tint(Color.nudgeForeground)
                .onChange(of: preset) { _, _ in saveRecurrence() }
            }
            .frame(minHeight: 44)

            if preset == .weekly || preset == .biweekly {
                weekdaysPicker
            }
            if preset == .monthly_day {
                Stepper(value: $monthDay, in: 1...31, step: 1) {
                    Text("schedule.recurrence.monthDayN \(monthDay)", bundle: .module)
                        .foregroundStyle(Color.nudgeForeground)
                }
                .frame(minHeight: 44)
                .onChange(of: monthDay) { _, _ in saveRecurrence() }
            }
            if preset == .monthly_nth_weekday {
                monthlyNthPickers
            }
            if preset != nil {
                DatePicker(selection: $startDate, displayedComponents: .date) {
                    Text("schedule.recurrence.startDate", bundle: .module)
                        .foregroundStyle(Color.nudgeForeground)
                }
                .frame(minHeight: 44)
                .tint(Color.nudgeForeground)
                .onChange(of: startDate) { _, _ in saveRecurrence() }

                Toggle(isOn: $hasEndDate) {
                    Text("schedule.recurrence.hasEndDate", bundle: .module)
                        .foregroundStyle(Color.nudgeForeground)
                }
                .tint(Color.nudgeForeground)
                .frame(minHeight: 44)
                .onChange(of: hasEndDate) { _, on in
                    if on, endDate == nil { endDate = startDate }
                    saveRecurrence()
                }
                if hasEndDate {
                    DatePicker(selection: Binding(
                        get: { endDate ?? startDate },
                        set: { endDate = $0 }
                    ), displayedComponents: .date) {
                        // Visually subordinate — the toggle above is the
                        // decision; this row is the consequence.
                        Text("schedule.recurrence.endDate", bundle: .module)
                            .font(.subheadline)
                            .foregroundStyle(Color.nudgeTextDim)
                    }
                    .frame(minHeight: 44)
                    .tint(Color.nudgeForeground)
                    .padding(.leading, 16)
                    .onChange(of: endDate) { _, _ in saveRecurrence() }
                }
            }
        }
    }

    @ViewBuilder
    private var weekdaysPicker: some View {
        // Each button cell expands to fill row width evenly; the visual
        // circle stays 32 pt while the tap target spans the full cell
        // height (44 pt) — fixes the iOS HIG 44 pt touch-target violation
        // without crowding the visible glyphs.
        HStack(spacing: 6) {
            ForEach(1...7, id: \.self) { day in
                let active = weekdays.contains(day)
                Button {
                    if active { weekdays.remove(day) } else { weekdays.insert(day) }
                    saveRecurrence()
                } label: {
                    Text(weekdayShort(day))
                        .font(.caption.weight(.medium))
                        .foregroundStyle(active ? Color.nudgePrimaryForeground : Color.nudgeForeground)
                        .frame(width: 32, height: 32)
                        .background(
                            Circle().fill(active ? Color.nudgePrimary : Color.clear)
                        )
                        .overlay(Circle().stroke(Color.nudgeBorder, lineWidth: 1))
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(Text(weekdayShort(day)))
                .accessibilityAddTraits(active ? .isSelected : [])
            }
        }
    }

    @ViewBuilder
    private var monthlyNthPickers: some View {
        HStack(spacing: 8) {
            Picker(selection: $monthNth) {
                ForEach(1...4, id: \.self) {
                    Text("schedule.recurrence.nthN \($0)", bundle: .module).tag($0)
                }
                Text("schedule.recurrence.last", bundle: .module).tag(5)
            } label: { Text("schedule.recurrence.nthLabel", bundle: .module) }
            .pickerStyle(.menu)
            .tint(Color.nudgeForeground)
            .onChange(of: monthNth) { _, _ in saveRecurrence() }

            Picker(selection: $monthNthWeekday) {
                ForEach(1...7, id: \.self) { Text(weekdayShort($0)).tag($0) }
            } label: { Text("schedule.recurrence.weekday", bundle: .module) }
            .pickerStyle(.menu)
            .tint(Color.nudgeForeground)
            .onChange(of: monthNthWeekday) { _, _ in saveRecurrence() }
        }
        .frame(minHeight: 44)
    }

    // MARK: - Reminder block

    @ViewBuilder
    private var reminderBlock: some View {
        VStack(alignment: .leading, spacing: 12) {
            Toggle(isOn: $hasReminder) {
                Text("schedule.reminder.enabled", bundle: .module)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Color.nudgeForeground)
            }
            .tint(Color.nudgeForeground)
            .frame(minHeight: 44)
            .onChange(of: hasReminder) { _, on in
                if !on {
                    remindTimeOfDay = nil
                    absoluteRemindAt = nil
                }
                saveReminder()
            }

            if hasReminder {
                if preset != nil {
                    DatePicker(
                        selection: Binding(
                            get: { remindTimeOfDay ?? defaultReminderTime() },
                            set: { remindTimeOfDay = $0 }
                        ),
                        displayedComponents: .hourAndMinute
                    ) {
                        Text("schedule.reminder.timeOfDay", bundle: .module)
                            .foregroundStyle(Color.nudgeForeground)
                    }
                    .frame(minHeight: 44)
                    .tint(Color.nudgeForeground)
                    .onChange(of: remindTimeOfDay) { _, _ in saveReminder() }
                } else {
                    DatePicker(
                        selection: Binding(
                            get: { absoluteRemindAt ?? Date().addingTimeInterval(3600) },
                            set: { absoluteRemindAt = $0 }
                        ),
                        displayedComponents: [.date, .hourAndMinute]
                    ) {
                        Text("schedule.reminder.dateTime", bundle: .module)
                            .foregroundStyle(Color.nudgeForeground)
                    }
                    .frame(minHeight: 44)
                    .tint(Color.nudgeForeground)
                    .onChange(of: absoluteRemindAt) { _, _ in saveReminder() }
                }
            }
        }
    }

    private var presetBinding: Binding<RecurrencePreset?> {
        Binding(get: { preset }, set: { preset = $0 })
    }

    private func weekdayShort(_ d: Int) -> String {
        let keys = [
            "weekday.mon", "weekday.tue", "weekday.wed",
            "weekday.thu", "weekday.fri", "weekday.sat", "weekday.sun"
        ]
        return nudgeLocalized(keys[d - 1], locale: locale)
    }

    private func defaultReminderTime() -> Date {
        let cal = Calendar.current
        return cal.date(bySettingHour: 9, minute: 0, second: 0, of: Date()) ?? Date()
    }

    // MARK: - Load / save

    private func load() async {
        do {
            let r = try await recurrenceRepo.get(taskId: taskId)
            if let r {
                preset = r.preset
                weekdays = Set((r.weekdays ?? "").split(separator: ",").compactMap { Int($0) })
                monthDay = r.monthDay ?? 1
                monthNth = r.monthNth ?? 1
                monthNthWeekday = r.monthNthWeekday ?? 1
                startDate = parseISODate(r.startDate) ?? Date()
                hasEndDate = r.endDate != nil
                endDate = r.endDate.flatMap(parseISODate)
                if let t = r.remindAtTimeOfDay {
                    let (h, m) = parseHM(t)
                    let cal = Calendar.current
                    remindTimeOfDay = cal.date(bySettingHour: h, minute: m, second: 0, of: Date())
                    hasReminder = true
                } else {
                    remindTimeOfDay = nil
                    hasReminder = false
                }
            } else {
                preset = nil
                if let isoStr = initialAbsoluteRemindAt {
                    absoluteRemindAt = parseISODateTime(isoStr)
                    hasReminder = absoluteRemindAt != nil
                } else {
                    absoluteRemindAt = nil
                    hasReminder = false
                }
            }
            isLoaded = true
        } catch {
            print("[ScheduleSection] load failed: \(error)")
            isLoaded = true
        }
    }

    /// Coalesce rapid changes — picker scrolls, weekday taps, stepper
    /// repeats — into a single PUT after 500 ms of idle. Without this
    /// scrolling a DatePicker fires dozens of writes and the last one
    /// wins by network race rather than user intent.
    private func scheduleSave(_ work: @escaping @Sendable () async -> Void) {
        guard isLoaded else { return }
        saveDebounce?.cancel()
        let item = DispatchWorkItem { Task { await work() } }
        saveDebounce = item
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5, execute: item)
    }

    private func saveRecurrence() {
        scheduleSave { await self.performSaveRecurrence() }
    }

    private func performSaveRecurrence() async {
        do {
            if let p = preset {
                let body = RecurrenceRepository.UpsertBody(
                    preset: p.rawValue,
                    weekdays: (p == .weekly || p == .biweekly)
                        ? weekdays.sorted().map(String.init).joined(separator: ",")
                        : nil,
                    monthDay: p == .monthly_day ? monthDay : nil,
                    monthNth: p == .monthly_nth_weekday ? monthNth : nil,
                    monthNthWeekday: p == .monthly_nth_weekday ? monthNthWeekday : nil,
                    startDate: isoDate(startDate),
                    endDate: hasEndDate ? endDate.map(isoDate) : nil,
                    remindAtTimeOfDay: hasReminder ? remindTimeOfDay.map(hmString) : nil
                )
                let saved = try await recurrenceRepo.upsert(taskId: taskId, body: body)
                onRecurrenceChanged(saved)
                #if os(iOS)
                await NotificationScheduler.shared.rescheduleTaskReminder(
                    taskId: taskId,
                    title: taskTitle,
                    absoluteRemindAt: nil,
                    recurrence: saved
                )
                await NotificationScheduler.shared.dumpPending()
                #endif
            } else {
                try await recurrenceRepo.delete(taskId: taskId)
                onRecurrenceChanged(nil)
                #if os(iOS)
                await NotificationScheduler.shared.cancelTaskReminder(taskId: taskId)
                #endif
            }
        } catch {
            print("[ScheduleSection] saveRecurrence failed: \(error)")
        }
    }

    private func saveReminder() {
        guard isLoaded else { return }
        if preset != nil {
            // Recurrence reminder lives in the same upsert.
            saveRecurrence()
        } else {
            scheduleSave { await self.performSaveAbsoluteReminder() }
        }
    }

    private func performSaveAbsoluteReminder() async {
        let value = hasReminder ? absoluteRemindAt.map { isoDateTime($0) } : nil
        await MainActor.run {
            initialAbsoluteRemindAt = value
            onChangeAbsoluteRemindAt(value)
        }
        #if os(iOS)
        let absoluteDate = hasReminder ? absoluteRemindAt : nil
        await NotificationScheduler.shared.rescheduleTaskReminder(
            taskId: taskId,
            title: taskTitle,
            absoluteRemindAt: absoluteDate,
            recurrence: nil
        )
        await NotificationScheduler.shared.dumpPending()
        #endif
    }

    // MARK: - Date helpers

    private func parseISODate(_ s: String) -> Date? {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = TimeZone(secondsFromGMT: 0)
        f.locale = Locale(identifier: "en_US_POSIX")
        return f.date(from: s)
    }
    private func isoDate(_ d: Date) -> String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = TimeZone(secondsFromGMT: 0)
        f.locale = Locale(identifier: "en_US_POSIX")
        return f.string(from: d)
    }
    private func parseHM(_ s: String) -> (Int, Int) {
        let parts = s.split(separator: ":").compactMap { Int($0) }
        return (parts.first ?? 9, parts.count > 1 ? parts[1] : 0)
    }
    private func hmString(_ d: Date) -> String {
        let cal = Calendar.current
        let h = cal.component(.hour, from: d)
        let m = cal.component(.minute, from: d)
        return String(format: "%02d:%02d", h, m)
    }
    private func parseISODateTime(_ s: String) -> Date? {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = f.date(from: s) { return d }
        f.formatOptions = [.withInternetDateTime]
        return f.date(from: s)
    }
    private func isoDateTime(_ d: Date) -> String {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f.string(from: d)
    }
}

extension RecurrencePreset {
    var localizedKey: LocalizedStringKey {
        switch self {
        case .daily: return "schedule.preset.daily"
        case .weekdays: return "schedule.preset.weekdays"
        case .weekly: return "schedule.preset.weekly"
        case .biweekly: return "schedule.preset.biweekly"
        case .monthly_day: return "schedule.preset.monthlyDay"
        case .monthly_nth_weekday: return "schedule.preset.monthlyNthWeekday"
        case .yearly: return "schedule.preset.yearly"
        }
    }
}

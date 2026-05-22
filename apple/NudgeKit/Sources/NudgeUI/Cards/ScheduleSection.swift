import SwiftUI
import NudgeCore

/// Card-detail "schedule" block: recurrence rule + reminder time.
/// Auto-saves via the Recurrence and Card repositories with a 500 ms
/// debounce so rapid picker / stepper changes collapse into one PUT.
///
/// **Design system**: 全部用自刻 SwiftUI primitives (`NudgeDropdown`,
/// `NudgeSwitch`, `NudgeDateField`, `NudgeCalendar`) 替換系統 `Picker(.menu)`,
/// `Toggle`, `DatePicker(.graphical)` — 系統 control 在 macOS 都走 AppKit
/// native renderer、tint/background 被吃掉，整片視覺跟 Nudge 品牌打架。
/// 詳見 [feedback_swiftui_appkit_hybrid_controls]。time picker 例外維持
/// 系統 `.compact` style（時分輸入框，自刻成本過高、視覺干擾較小）。
public struct ScheduleSection: View {
    public let taskId: String
    public let taskTitle: String
    @Binding var initialAbsoluteRemindAt: String?
    public let onChangeAbsoluteRemindAt: (String?) -> Void
    public let onRecurrenceChanged: (TaskRecurrenceDTO?) -> Void

    @Environment(RecurrenceRepository.self) private var recurrenceRepo
    @Environment(\.locale) private var locale

    @State private var isLoaded = false

    @State private var preset: RecurrencePreset? = nil
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

    @State private var saveDebounce: DispatchWorkItem?
    /// Track 最後一次 immediate save 的 Task — parent (ScheduleEditSheet) 在
    /// 「完成」按下時 await 這個 Task 確認 server write 完成、再 dismiss +
    /// trigger reload。沒這個的話 reload 跟 save 會 race (toggle off → 完成
    /// → reload 拿到 stale isRecurring=true)。
    @Binding var pendingSaveTask: Task<Void, Never>?

    public init(
        taskId: String,
        taskTitle: String,
        initialAbsoluteRemindAt: Binding<String?>,
        onChangeAbsoluteRemindAt: @escaping (String?) -> Void,
        onRecurrenceChanged: @escaping (TaskRecurrenceDTO?) -> Void = { _ in },
        pendingSaveTask: Binding<Task<Void, Never>?> = .constant(nil)
    ) {
        self.taskId = taskId
        self.taskTitle = taskTitle
        self._initialAbsoluteRemindAt = initialAbsoluteRemindAt
        self.onChangeAbsoluteRemindAt = onChangeAbsoluteRemindAt
        self.onRecurrenceChanged = onRecurrenceChanged
        self._pendingSaveTask = pendingSaveTask
    }

    public var body: some View {
        Group {
            if isLoaded {
                // Section 之間 18pt 隔開 — 之前 12pt 太擠。
                VStack(alignment: .leading, spacing: 18) {
                    sectionCard { recurrenceBlock }
                    sectionCard { reminderBlock }
                }
            } else {
                ProgressView()
                    .frame(maxWidth: .infinity)
                    .padding(20)
            }
        }
        .task(id: taskId) { await load() }
    }

    /// Section card wrapper — nudgeForeground @ 4% bg + 14pt corner。
    /// Padding 拉大：horizontal 18 / vertical 6（外殼跟內部 row 都呼吸）。
    @ViewBuilder
    private func sectionCard<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            content()
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 6)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(Color.nudgeForeground.opacity(0.04))
        )
    }

    // MARK: - Recurrence

    @ViewBuilder
    private var recurrenceBlock: some View {
        // animation 綁在 preset / hasEndDate — toggle 切換時新出/消失的 rows
        // 平滑展開收合（之前是 view tree 直接砍出/補進去，snap 感很重）。
        VStack(alignment: .leading, spacing: 0) {
            // Row 1: 重複 on/off
            row {
                rowLabel("schedule.recurrenceTitle", emphasized: true)
                Spacer()
                NudgeSwitch(isOn: recurrenceEnabledBinding)
            }

            if preset != nil {
                rowDivider
                // Row 2: 週期
                row {
                    rowLabel("schedule.recurrence.frequency")
                    Spacer()
                    NudgeDropdown(
                        selection: $preset,
                        options: presetOptions,
                        trigger: presetTriggerText
                    )
                    // dropdown 是一槍打中 → 立刻寄。
                    .onChange(of: preset) { _, _ in saveRecurrenceImmediately() }
                }
            }

            if preset == .weekly || preset == .biweekly {
                rowDivider
                weekdaysPicker
                    .padding(.vertical, 10)
            }
            if preset == .monthly_day {
                rowDivider
                row {
                    rowLabel("schedule.recurrence.monthDayLabel")
                    Spacer()
                    Stepper(value: $monthDay, in: 1...31, step: 1) {
                        Text("schedule.recurrence.monthDayN \(monthDay)", bundle: .module)
                            .font(.subheadline)
                            .foregroundStyle(Color.nudgeForeground)
                    }
                    .labelsHidden()
                    .onChange(of: monthDay) { _, _ in saveRecurrence() }
                }
            }
            if preset == .monthly_nth_weekday {
                rowDivider
                row {
                    rowLabel("schedule.recurrence.nthLabel")
                    Spacer()
                    HStack(spacing: 6) {
                        NudgeDropdown(
                            selection: $monthNth,
                            options: nthOptions,
                            trigger: nthTriggerText
                        )
                        .onChange(of: monthNth) { _, _ in saveRecurrenceImmediately() }
                        NudgeDropdown(
                            selection: $monthNthWeekday,
                            options: weekdayOptions,
                            trigger: Text(weekdayShort(monthNthWeekday))
                        )
                        .onChange(of: monthNthWeekday) { _, _ in saveRecurrenceImmediately() }
                    }
                }
            }

            if preset != nil {
                rowDivider
                row {
                    rowLabel("schedule.recurrence.startDate")
                    Spacer()
                    NudgeDateField(date: $startDate)
                        // 單次選日、立刻寄。
                        .onChange(of: startDate) { _, _ in saveRecurrenceImmediately() }
                }

                rowDivider
                row {
                    rowLabel("schedule.recurrence.hasEndDate")
                    Spacer()
                    NudgeSwitch(isOn: $hasEndDate)
                        .onChange(of: hasEndDate) { _, on in
                            if on, endDate == nil { endDate = startDate }
                            // toggle 立刻寄。
                            saveRecurrenceImmediately()
                        }
                }

                if hasEndDate {
                    rowDivider
                    row {
                        rowLabel("schedule.recurrence.endDate")
                        Spacer()
                        NudgeDateField(date: Binding(
                            get: { endDate ?? startDate },
                            set: { endDate = $0 }
                        ))
                        .onChange(of: endDate) { _, _ in saveRecurrenceImmediately() }
                    }
                }
            }
        }
        // value: 是「nil / 非 nil」這個 boolean 變化 — preset 物件本身切換
        // (.daily ↔ .weekly) 時 view tree 結構也會變（weekdaysPicker
        // 出現/消失），所以三條 animation 都監聽。
        .animation(.smooth(duration: 0.25), value: preset)
        .animation(.smooth(duration: 0.25), value: hasEndDate)
    }

    @ViewBuilder
    private var weekdaysPicker: some View {
        HStack(spacing: 6) {
            ForEach(1...7, id: \.self) { day in
                let active = weekdays.contains(day)
                Button {
                    if active { weekdays.remove(day) } else { weekdays.insert(day) }
                    // 星期按鈕 tap = 單次事件、立刻寄。
                    saveRecurrenceImmediately()
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
            NudgeDropdown(
                selection: $monthNth,
                options: nthOptions,
                trigger: nthTriggerText
            )
            .onChange(of: monthNth) { _, _ in saveRecurrenceImmediately() }

            NudgeDropdown(
                selection: $monthNthWeekday,
                options: weekdayOptions,
                trigger: Text(weekdayShort(monthNthWeekday))
            )
            .onChange(of: monthNthWeekday) { _, _ in saveRecurrenceImmediately() }
        }
        .frame(minHeight: 44)
    }

    // MARK: - Reminder

    @ViewBuilder
    private var reminderBlock: some View {
        VStack(alignment: .leading, spacing: 0) {
            row {
                rowLabel("schedule.reminder.enabled", emphasized: true)
                Spacer()
                NudgeSwitch(isOn: $hasReminder)
                    .onChange(of: hasReminder) { _, on in
                        if !on {
                            remindTimeOfDay = nil
                            absoluteRemindAt = nil
                        }
                        // toggle 立刻寄，避免 race-with-reload。
                        saveReminderImmediately()
                    }
            }

            if hasReminder {
                rowDivider
                if preset != nil {
                    row {
                        rowLabel("schedule.reminder.timeOfDay")
                        Spacer()
                        NudgeTimeField(date: Binding(
                            get: { remindTimeOfDay ?? defaultReminderTime() },
                            set: { remindTimeOfDay = $0 }
                        ))
                        .onChange(of: remindTimeOfDay) { _, _ in saveReminder() }
                    }
                } else {
                    row {
                        rowLabel("schedule.reminder.dateTime")
                        Spacer()
                        HStack(spacing: 6) {
                            NudgeDateField(date: Binding(
                                get: { absoluteRemindAt ?? Date().addingTimeInterval(3600) },
                                set: { absoluteRemindAt = $0 }
                            ))
                            NudgeTimeField(date: Binding(
                                get: { absoluteRemindAt ?? Date().addingTimeInterval(3600) },
                                set: { absoluteRemindAt = $0 }
                            ))
                        }
                    }
                    .onChange(of: absoluteRemindAt) { _, _ in saveReminder() }
                }
            }
        }
        // 提醒 toggle 切換時平滑展開 timeOfDay row。
        .animation(.smooth(duration: 0.25), value: hasReminder)
    }

    // MARK: - Row primitives

    /// 標準 row：48pt min height + 8pt vertical padding = 整 row 跨距 ~64pt，
    /// 有明確視覺呼吸（之前 44+4 太擠）。
    @ViewBuilder
    private func row<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        HStack {
            content()
        }
        .frame(minHeight: 48)
        .padding(.vertical, 8)
    }

    private func rowLabel(_ key: LocalizedStringKey, emphasized: Bool = false) -> some View {
        // emphasized rows (重複 / 提醒) 用 design system `.sectionHeader`
        // (14pt semibold)；sub rows (週期 / 起始日 / 結束日) 用 `.primaryRowTitle`
        // (14pt regular)。之前 `.subheadline` 在 mac 是 ~11pt 太小。
        Text(key, bundle: .module)
            .nudgeFont(emphasized ? .sectionHeader : .primaryRowTitle)
            .foregroundStyle(Color.nudgeForeground)
    }

    /// Row 之間的細線分隔 — 1pt nudgeBorderLight，跟 section card bg 形成
    /// 微弱層次（同 iOS Settings 卡片內部 row 分隔）。
    private var rowDivider: some View {
        Rectangle()
            .fill(Color.nudgeBorderLight.opacity(0.6))
            .frame(height: 1)
    }

    // MARK: - Dropdown options

    /// "重複" on/off toggle binding — preset nil ↔ off。Toggle ON 時 default
    /// 到 .daily（最常用），ON → OFF 清掉 preset、其他子設定 (weekdays /
    /// dates) 透過 preset == nil 條件自然消失。
    private var recurrenceEnabledBinding: Binding<Bool> {
        Binding(
            get: { preset != nil },
            set: { on in
                if on, preset == nil {
                    preset = .daily
                } else if !on {
                    preset = nil
                }
                // toggle 是一槍打中事件 → 立刻寄、不 debounce，避免 user 切完
                // 馬上按完成時 reload 拿到 stale 資料。
                saveRecurrenceImmediately()
            }
        )
    }

    /// Dropdown options — toggle 開啟後才出現，所以不含 nil case。
    private var presetOptions: [(RecurrencePreset?, Text)] {
        RecurrencePreset.allCases.map { (Optional($0), Text($0.localizedKey, bundle: .module)) }
    }

    private var presetTriggerText: Text {
        if let p = preset {
            return Text(p.localizedKey, bundle: .module)
        }
        return Text("schedule.recurrence.off", bundle: .module)
    }

    private var nthOptions: [(Int, Text)] {
        var opts: [(Int, Text)] = []
        for i in 1...4 {
            opts.append((i, Text("schedule.recurrence.nthN \(i)", bundle: .module)))
        }
        opts.append((5, Text("schedule.recurrence.last", bundle: .module)))
        return opts
    }

    private var nthTriggerText: Text {
        if monthNth == 5 {
            return Text("schedule.recurrence.last", bundle: .module)
        }
        return Text("schedule.recurrence.nthN \(monthNth)", bundle: .module)
    }

    private var weekdayOptions: [(Int, Text)] {
        (1...7).map { ($0, Text(weekdayShort($0))) }
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

    // MARK: - Load / save (unchanged logic)

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

    /// 用於 toggle / 單次選擇等「一槍打中」的事件 — 取消 debounce 直接觸發
    /// 儲存。修 race-with-reload bug：之前 toggle off → debounce 0.5 秒
    /// 倒數 → user 立刻按「完成」→ reload 拿到 stale 資料、UI 還顯示重複。
    /// 滑動 type (Stepper / TimeScrollWheel) 仍走 debounced 版本。
    private func saveRecurrenceImmediately() {
        guard isLoaded else { return }
        saveDebounce?.cancel()
        saveDebounce = nil
        // Track Task → parent 可 await 確認完成後才 reload。
        pendingSaveTask = Task { await performSaveRecurrence() }
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
                #if os(iOS) || os(macOS)
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
                #if os(iOS) || os(macOS)
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
            saveRecurrence()
        } else {
            scheduleSave { await self.performSaveAbsoluteReminder() }
        }
    }

    private func saveReminderImmediately() {
        guard isLoaded else { return }
        if preset != nil {
            saveRecurrenceImmediately()
        } else {
            saveDebounce?.cancel()
            saveDebounce = nil
            pendingSaveTask = Task { await performSaveAbsoluteReminder() }
        }
    }

    private func performSaveAbsoluteReminder() async {
        let value = hasReminder ? absoluteRemindAt.map { isoDateTime($0) } : nil
        await MainActor.run {
            initialAbsoluteRemindAt = value
            onChangeAbsoluteRemindAt(value)
        }
        #if os(iOS) || os(macOS)
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

    // MARK: - Date helpers (unchanged)

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

import Foundation

/// 按時區快取 `DateFormatter` / `Calendar` 的共用倉庫。
///
/// **為什麼要快取**：`DateFormatter()` 建立成本極高 —— 每次 init 加上設
/// `dateFormat` / `locale` / `timeZone` 都會觸發 `_regenerateFormatter` →
/// `__ResetUDateFormat` → ICU calendar/locale 重新初始化。月曆一次 render
/// 光 `isoDate` 就要呼叫 40+ 次（6×7 格各一次），原本每次都新建。
/// 2026-07-24 的 `cpu_resource` 診斷報告抓到：app 在背景、使用者 idle 的
/// 情況下 90 秒燒滿 100% CPU，記憶體從 27.86 MB 漲到 330.28 MB，最重的
/// 堆疊正是 `CalendarMonthView.cell(date:)` → `isoDate` → `_regenerateFormatter`。
///
/// **為什麼整段包在鎖裡**：`DateFormatter` 非執行緒安全，而這些 API 同時被
/// main actor 的 view body 與背景 task 呼叫。所以「取 formatter」跟「格式化」
/// 必須在同一個臨界區內完成 —— 把 formatter 交出鎖外再用等於沒鎖。
/// `Calendar` 是 value type，取出後複製使用是安全的，但建立一樣走 ICU，
/// 所以一併快取。
///
/// 快取不設上限：key 是時區 identifier，實務上只會有個位數個。
private final class DateFormatterCache: @unchecked Sendable {
    static let shared = DateFormatterCache()

    private let lock = NSLock()
    private var isoFormatters: [String: DateFormatter] = [:]
    private var patternFormatters: [String: DateFormatter] = [:]
    private var gregorianCalendars: [String: Calendar] = [:]
    private var mondayFirstCalendars: [String: Calendar] = [:]

    // MARK: - "yyyy-MM-dd"

    func isoString(from date: Date, timeZone: TimeZone) -> String {
        lock.lock()
        defer { lock.unlock() }
        return isoFormatterLocked(timeZone).string(from: date)
    }

    func isoDate(from string: String, timeZone: TimeZone) -> Date? {
        lock.lock()
        defer { lock.unlock() }
        return isoFormatterLocked(timeZone).date(from: string)
    }

    /// 呼叫端必須已持有 `lock`。
    private func isoFormatterLocked(_ timeZone: TimeZone) -> DateFormatter {
        if let cached = isoFormatters[timeZone.identifier] { return cached }
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = timeZone
        formatter.dateFormat = "yyyy-MM-dd"
        isoFormatters[timeZone.identifier] = formatter
        return formatter
    }

    // MARK: - 自訂 pattern

    /// 任意 `dateFormat` pattern 的格式化。快取 key 帶上 locale / timeZone，
    /// 使用者切換系統語言或時區時會落到新 key、不會拿到過期的 formatter。
    func string(from date: Date, pattern: String, locale: Locale, timeZone: TimeZone) -> String {
        lock.lock()
        defer { lock.unlock() }
        let key = "\(pattern)|\(locale.identifier)|\(timeZone.identifier)"
        if let cached = patternFormatters[key] {
            return cached.string(from: date)
        }
        let formatter = DateFormatter()
        formatter.locale = locale
        formatter.timeZone = timeZone
        formatter.dateFormat = pattern
        patternFormatters[key] = formatter
        return formatter.string(from: date)
    }

    // MARK: - Calendar

    /// 公曆 + 指定時區（`firstWeekday` 維持系統預設）。
    func gregorianCalendar(_ timeZone: TimeZone) -> Calendar {
        lock.lock()
        defer { lock.unlock() }
        if let cached = gregorianCalendars[timeZone.identifier] { return cached }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        gregorianCalendars[timeZone.identifier] = calendar
        return calendar
    }

    /// 公曆 + 指定時區 + 週一為一週之始（週檢視/週起算用）。
    func mondayFirstCalendar(_ timeZone: TimeZone) -> Calendar {
        lock.lock()
        defer { lock.unlock() }
        if let cached = mondayFirstCalendars[timeZone.identifier] { return cached }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        calendar.firstWeekday = 2  // Monday
        mondayFirstCalendars[timeZone.identifier] = calendar
        return calendar
    }
}

public enum DateFormatters {
    /// "YYYY-MM-DD" server date format.
    public static func isoDate(_ date: Date, in timeZone: TimeZone = .current) -> String {
        DateFormatterCache.shared.isoString(from: date, timeZone: timeZone)
    }

    public static func parseISODate(_ string: String, in timeZone: TimeZone = .current) -> Date? {
        DateFormatterCache.shared.isoDate(from: string, timeZone: timeZone)
    }

    /// Returns the Monday at 00:00 for the week containing `date`.
    public static func startOfWeek(_ date: Date, in timeZone: TimeZone = .current) -> Date {
        let calendar = DateFormatterCache.shared.mondayFirstCalendar(timeZone)
        let components = calendar.dateComponents([.yearForWeekOfYear, .weekOfYear], from: date)
        return calendar.date(from: components) ?? date
    }

    /// 自訂 `dateFormat` pattern 的格式化（共用快取 formatter）。
    public static func string(
        _ date: Date,
        pattern: String,
        locale: Locale = .current,
        in timeZone: TimeZone = .current
    ) -> String {
        DateFormatterCache.shared.string(from: date, pattern: pattern, locale: locale, timeZone: timeZone)
    }

    public static func isWeekend(_ date: Date, in timeZone: TimeZone = .current) -> Bool {
        let calendar = DateFormatterCache.shared.gregorianCalendar(timeZone)
        let weekday = calendar.component(.weekday, from: date)
        return weekday == 1 || weekday == 7  // 1 = Sun, 7 = Sat
    }
}

import Foundation

/// Mirrors `src/lib/recurrence.ts` so the iOS notification scheduler can
/// compute future occurrence dates locally without hitting the server.
public enum RecurrenceCalculator {
    /// Whether `dateStr` (YYYY-MM-DD) is an occurrence of `rule`.
    public static func occurs(date dateStr: String, rule: TaskRecurrenceDTO) -> Bool {
        guard let date = parseISODate(dateStr),
              let start = parseISODate(rule.startDate) else { return false }
        if date < start { return false }
        if let end = rule.endDate, let endDate = parseISODate(end), date > endDate {
            return false
        }

        switch rule.preset {
        case .daily:
            return true
        case .weekdays:
            let w = isoWeekday(date)
            return w >= 1 && w <= 5
        case .weekly:
            guard let csv = rule.weekdays else { return false }
            return csv.split(separator: ",").compactMap { Int($0) }.contains(isoWeekday(date))
        case .biweekly:
            guard let csv = rule.weekdays else { return false }
            let weekdays = csv.split(separator: ",").compactMap { Int($0) }
            guard weekdays.contains(isoWeekday(date)) else { return false }
            // Distance in whole days from the rule's startDate; even week index occurs.
            let comps = utcCalendar.dateComponents([.day], from: start, to: date)
            let days = comps.day ?? 0
            return (days / 7) % 2 == 0
        case .monthly_day:
            guard let md = rule.monthDay else { return false }
            return utcCalendar.component(.day, from: date) == md
        case .monthly_nth_weekday:
            guard let nth = rule.monthNth, let wkd = rule.monthNthWeekday else { return false }
            guard isoWeekday(date) == wkd else { return false }
            let dom = utcCalendar.component(.day, from: date)
            if nth == 5 {
                let last = lastDayOfMonth(date)
                return dom > last - 7
            }
            let lower = (nth - 1) * 7 + 1
            let upper = nth * 7
            return dom >= lower && dom <= upper
        case .yearly:
            let cal = utcCalendar
            let m = cal.component(.month, from: date)
            let d = cal.component(.day, from: date)
            let sm = cal.component(.month, from: start)
            let sd = cal.component(.day, from: start)
            if m == sm && d == sd { return true }
            // Feb-29 anchor falls back to Feb-28 in non-leap years.
            if sm == 2 && sd == 29 && m == 2 && d == 28 {
                return lastDayOfMonth(date) == 28
            }
            return false
        }
    }

    /// Enumerates every occurrence date (YYYY-MM-DD) of `rule` in the
    /// inclusive `[from, to]` window. `from` and `to` are YYYY-MM-DD.
    public static func occurrences(
        rule: TaskRecurrenceDTO,
        from: String,
        to: String
    ) -> [String] {
        guard let f = parseISODate(from), let t = parseISODate(to), f <= t else { return [] }
        let cal = utcCalendar
        var result: [String] = []
        var cur = f
        while cur <= t {
            let iso = isoDate(cur)
            if occurs(date: iso, rule: rule) { result.append(iso) }
            guard let next = cal.date(byAdding: .day, value: 1, to: cur) else { break }
            cur = next
        }
        return result
    }

    // MARK: - Helpers

    /// All date-component math must run in UTC to mirror `src/lib/recurrence.ts`,
    /// which operates purely in UTC. A bare `Calendar(identifier: .gregorian)`
    /// defaults to `TimeZone.current`, which would shift day-of-month/month
    /// extraction by one in non-UTC timezones (the Americas) and desync the
    /// iOS notification scheduler from the web materializer.
    private static var utcCalendar: Calendar {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(secondsFromGMT: 0) ?? .current
        return cal
    }

    private static func parseISODate(_ s: String) -> Date? {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = TimeZone(secondsFromGMT: 0)
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        return f.date(from: s)
    }

    private static func isoDate(_ d: Date) -> String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = TimeZone(secondsFromGMT: 0)
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        return f.string(from: d)
    }

    /// ISO 8601 weekday: 1=Mon..7=Sun. Calendar's .weekday is 1=Sun..7=Sat,
    /// so we remap.
    private static func isoWeekday(_ d: Date) -> Int {
        let w = utcCalendar.component(.weekday, from: d)
        return w == 1 ? 7 : w - 1
    }

    private static func lastDayOfMonth(_ d: Date) -> Int {
        let range = utcCalendar.range(of: .day, in: .month, for: d)
        return (range?.upperBound ?? 32) - 1
    }
}

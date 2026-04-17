import Foundation

public enum DateFormatters {
    /// "YYYY-MM-DD" server date format.
    public static func isoDate(_ date: Date, in timeZone: TimeZone = .current) -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = timeZone
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }

    public static func parseISODate(_ string: String, in timeZone: TimeZone = .current) -> Date? {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = timeZone
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.date(from: string)
    }

    /// Returns the Monday at 00:00 for the week containing `date`.
    public static func startOfWeek(_ date: Date, in timeZone: TimeZone = .current) -> Date {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        calendar.firstWeekday = 2  // Monday
        let components = calendar.dateComponents([.yearForWeekOfYear, .weekOfYear], from: date)
        return calendar.date(from: components) ?? date
    }

    public static func isWeekend(_ date: Date, in timeZone: TimeZone = .current) -> Bool {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        let weekday = calendar.component(.weekday, from: date)
        return weekday == 1 || weekday == 7  // 1 = Sun, 7 = Sat
    }
}

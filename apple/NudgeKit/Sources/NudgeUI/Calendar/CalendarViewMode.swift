import SwiftUI

public enum CalendarViewMode: String, CaseIterable, Identifiable, Sendable {
    case day, week, month
    public var id: String { rawValue }

    /// 預設檢視 — mac 桌面寬螢幕預設週（time grid）；iPhone 預設日。
    /// 只影響沒存過偏好的新使用者，@AppStorage 已有值者不受影響。
    public static var platformDefault: CalendarViewMode {
        #if os(macOS)
        .week
        #else
        .day
        #endif
    }

    public var labelKey: LocalizedStringKey {
        switch self {
        case .day: "calendar.viewMode.day"
        case .week: "calendar.viewMode.week"
        case .month: "calendar.viewMode.month"
        }
    }
}

/// UserDefaults key for persisting the user's preferred mode.
public enum CalendarPreferenceKey {
    public static let viewMode = "calendar.view.mode"
}

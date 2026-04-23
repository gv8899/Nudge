import SwiftUI

public enum CalendarViewMode: String, CaseIterable, Identifiable, Sendable {
    case day, week, month
    public var id: String { rawValue }

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

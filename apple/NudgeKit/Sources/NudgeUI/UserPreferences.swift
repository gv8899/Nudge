import SwiftUI

public enum NudgeTheme: String, CaseIterable, Identifiable, Sendable {
    case system, light, dark
    public var id: String { rawValue }

    public var colorScheme: ColorScheme? {
        switch self {
        case .system: nil
        case .light: .light
        case .dark: .dark
        }
    }
}

public enum NudgeLanguage: String, CaseIterable, Identifiable, Sendable {
    case auto, zhTW = "zh-Hant", en, ja
    public var id: String { rawValue }

    /// Value to inject via `.environment(\.locale, ...)`.
    /// `auto` returns nil so SwiftUI falls back to the system locale.
    public var locale: Locale? {
        switch self {
        case .auto: nil
        case .zhTW: Locale(identifier: "zh-Hant")
        case .en: Locale(identifier: "en")
        case .ja: Locale(identifier: "ja")
        }
    }
}

/// Keys used by `@AppStorage` across the app. Keep names in one place so
/// Settings and App entry points stay in sync.
public enum NudgePreferenceKey {
    public static let theme = "nudge.theme"
    public static let language = "nudge.language"
}

/// Applies user-selected theme + language to the wrapped content.
/// Use this at the app's root (wrapping the first View in WindowGroup)
/// so every view inherits the overrides.
public struct NudgePreferencesApplier<Content: View>: View {
    @AppStorage(NudgePreferenceKey.theme) private var themeRaw: String = NudgeTheme.system.rawValue
    @AppStorage(NudgePreferenceKey.language) private var languageRaw: String = NudgeLanguage.auto.rawValue

    let content: () -> Content

    public init(@ViewBuilder content: @escaping () -> Content) {
        self.content = content
    }

    public var body: some View {
        let theme = NudgeTheme(rawValue: themeRaw) ?? .system
        let language = NudgeLanguage(rawValue: languageRaw) ?? .auto
        // Force the entire view tree to rebuild when the in-app language
        // changes. SwiftUI propagates `.environment(\.locale)` to plain
        // `Text(_, bundle:)`, but UIKit-rendered surfaces — navigationTitle
        // (UINavigationBar title), alert buttons, system pickers — capture
        // their text at render time and don't observe env changes. Tagging
        // the content with the locale id forces SwiftUI to discard the old
        // hierarchy and rebuild from scratch under the new locale, so every
        // surface (including UIKit-backed ones) re-renders consistently.
        let localeID = language.locale?.identifier ?? "auto"
        content()
            .id(localeID)
            .preferredColorScheme(theme.colorScheme)
            .modifier(LocaleOverride(locale: language.locale))
    }
}

private struct LocaleOverride: ViewModifier {
    let locale: Locale?
    func body(content: Content) -> some View {
        if let locale {
            content.environment(\.locale, locale)
        } else {
            content
        }
    }
}

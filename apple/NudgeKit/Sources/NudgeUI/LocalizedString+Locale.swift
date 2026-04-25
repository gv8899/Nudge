import Foundation
import SwiftUI

/// Locale-aware NSLocalizedString replacement for use inside SwiftUI views.
///
/// Why this exists: `NSLocalizedString` reads from `Bundle.main.preferredLocalizations`
/// once and never observes SwiftUI's `@Environment(\.locale)`. After the user
/// switches the in-app language picker, screens that resolved their text via
/// `NSLocalizedString` keep the previous translation until the view is
/// destroyed and rebuilt — producing the "two languages on screen" bug.
///
/// `localized(_:locale:)` instead picks the matching `<lang>.lproj` sub-bundle
/// from `Bundle.module` for the locale you pass in. Pair it with
/// `@Environment(\.locale)` so the call site resolves against whatever locale
/// `NudgePreferencesApplier` is currently injecting.
public func nudgeLocalized(
    _ key: String,
    locale: Locale? = nil,
    arguments: CVarArg...
) -> String {
    let raw = localizedRaw(key: key, locale: locale)
    if arguments.isEmpty { return raw }
    return String(format: raw, locale: locale, arguments: arguments)
}

private func localizedRaw(key: String, locale: Locale?) -> String {
    let bundle = bundleFor(locale: locale)
    return bundle.localizedString(forKey: key, value: nil, table: nil)
}

private func bundleFor(locale: Locale?) -> Bundle {
    guard let locale else { return .module }
    let candidates: [String] = {
        var ids: [String] = [locale.identifier]
        // Apple .lproj names use BCP-47 with hyphens (e.g. "zh-Hant").
        // `Locale.identifier` may already match; fall back to the language
        // code alone when the full identifier isn't carried as an .lproj.
        if let lang = locale.language.languageCode?.identifier {
            ids.append(lang)
        }
        return ids
    }()
    for id in candidates {
        if let path = Bundle.module.path(forResource: id, ofType: "lproj"),
           let b = Bundle(path: path) {
            return b
        }
    }
    return .module
}

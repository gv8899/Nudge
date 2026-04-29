import Foundation

public enum AppGroupConfiguration {
    /// App Group identifier shared between Nudge-iOS app and NudgeWidget extension.
    /// Configured in both targets' entitlements.
    public static let identifier = "group.tw.nudge.app"

    /// Shared Keychain access group, prefixed with $(AppIdentifierPrefix) by the
    /// system at runtime (we just specify the suffix here and rely on the
    /// entitlements file to declare the full identifier).
    public static let keychainAccessGroup = "tw.nudge.app.shared"

    /// Shared container directory URL (App Group). nil if entitlement missing
    /// (which would only happen with a misconfigured build).
    public static var sharedContainerURL: URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: identifier)
    }

    /// File path inside the shared container where the widget snapshot lives.
    public static var snapshotFileURL: URL? {
        sharedContainerURL?.appendingPathComponent("widget-snapshot.json")
    }
}

import Foundation

/// Plain-file mirror of the auth token stored in the App Group container.
///
/// Why this exists alongside KeychainStorage:
/// Sharing the keychain between the App and Widget extension via
/// `kSecAttrAccessGroup` requires the access-group entitlement to resolve
/// correctly through `$(AppIdentifierPrefix)`. That works on signed device
/// builds but is fragile on simulator "Sign to Run Locally" builds where the
/// prefix isn't applied — keychain set/get then fails with errSecMissingEntitlement.
///
/// To keep widget intents reliably runnable on simulator, the App writes
/// the auth token to a file in the App Group container after successful auth
/// (and clears it on logout). The widget extension reads that file instead
/// of querying the shared keychain. The trade-off: a JSON-bodied file is
/// less secure than the system keychain. Acceptable because (a) the App
/// Group container is sandboxed to the app + its extensions, not other
/// processes, and (b) this token is the same JWT that's already in keychain —
/// not new sensitive material.
public final class SharedTokenStore: Sendable {
    private static let filename = "auth-token"

    public init() {}

    public func read() -> String? {
        guard let url = fileURL,
              let data = try? Data(contentsOf: url) else { return nil }
        return String(data: data, encoding: .utf8)
    }

    public func write(_ token: String) throws {
        guard let url = fileURL else {
            throw WidgetSnapshotError.appGroupContainerUnavailable
        }
        let data = token.data(using: .utf8) ?? Data()
        try data.write(to: url, options: [.atomic, .completeFileProtection])
    }

    public func clear() {
        guard let url = fileURL else { return }
        try? FileManager.default.removeItem(at: url)
    }

    private var fileURL: URL? {
        AppGroupConfiguration.sharedContainerURL?.appendingPathComponent(Self.filename)
    }
}

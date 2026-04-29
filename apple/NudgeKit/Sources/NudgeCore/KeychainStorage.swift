import Foundation
import Security

public enum KeychainError: Error, Sendable {
    case unexpectedStatus(OSStatus)
    case dataConversion
}

public final class KeychainStorage: Sendable {
    private let service: String
    private let accessGroup: String?

    /// - Parameters:
    ///   - service: kSecAttrService string used to namespace items.
    ///   - accessGroup: optional kSecAttrAccessGroup. Pass the suffix only
    ///     (e.g. `"tw.nudge.app.shared"`); the system prepends the team's
    ///     `$(AppIdentifierPrefix)` at runtime. Default `nil` keeps single-app
    ///     behaviour. Required for sharing items between an app and its
    ///     extensions (Widget, etc).
    public init(service: String, accessGroup: String? = nil) {
        self.service = service
        self.accessGroup = accessGroup
    }

    private func baseQuery(key: String) -> [String: Any] {
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
        if let accessGroup {
            query[kSecAttrAccessGroup as String] = accessGroup
        }
        return query
    }

    public func set(_ value: String, for key: String) throws {
        guard let data = value.data(using: .utf8) else {
            throw KeychainError.dataConversion
        }
        let query = baseQuery(key: key)
        let updateAttrs: [String: Any] = [kSecValueData as String: data]
        let updateStatus = SecItemUpdate(query as CFDictionary, updateAttrs as CFDictionary)
        switch updateStatus {
        case errSecSuccess:
            return
        case errSecItemNotFound:
            break
        default:
            throw KeychainError.unexpectedStatus(updateStatus)
        }
        var addQuery = query
        addQuery[kSecValueData as String] = data
        addQuery[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        let addStatus = SecItemAdd(addQuery as CFDictionary, nil)
        guard addStatus == errSecSuccess else {
            throw KeychainError.unexpectedStatus(addStatus)
        }
    }

    public func get(for key: String) throws -> String? {
        var query = baseQuery(key: key)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var out: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &out)
        switch status {
        case errSecSuccess:
            guard let data = out as? Data,
                  let string = String(data: data, encoding: .utf8) else {
                throw KeychainError.dataConversion
            }
            return string
        case errSecItemNotFound:
            return nil
        default:
            throw KeychainError.unexpectedStatus(status)
        }
    }

    public func remove(for key: String) throws {
        let query = baseQuery(key: key)
        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw KeychainError.unexpectedStatus(status)
        }
    }
}

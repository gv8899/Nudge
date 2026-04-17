import Testing
import Foundation
@testable import NudgeCore

/// Keychain 測試用獨立 service 名避免污染真實資料。
/// 每個 suite instance 用不同 UUID，serialized 避免 SecItem 併發問題。
@Suite("KeychainStorage", .serialized) struct KeychainStorageTests {
    let storage: KeychainStorage
    let service = "tw.nudge.tests.\(UUID().uuidString)"

    init() {
        self.storage = KeychainStorage(service: service)
    }

    @Test func setThenGetReturnsStoredValue() throws {
        try storage.set("hello", for: "token")
        let value = try storage.get(for: "token")
        #expect(value == "hello")
    }

    @Test func getReturnsNilWhenKeyMissing() throws {
        let value = try storage.get(for: "missing-key")
        #expect(value == nil)
    }

    @Test func setOverwritesExistingValue() throws {
        try storage.set("first", for: "token")
        try storage.set("second", for: "token")
        let value = try storage.get(for: "token")
        #expect(value == "second")
    }

    @Test func removeClearsValue() throws {
        try storage.set("hello", for: "token")
        try storage.remove(for: "token")
        let value = try storage.get(for: "token")
        #expect(value == nil)
    }
}

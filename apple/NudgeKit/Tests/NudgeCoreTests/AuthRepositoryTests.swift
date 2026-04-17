import Testing
import Foundation
@testable import NudgeCore

@Suite("AuthRepository", .serialized) @MainActor struct AuthRepositoryTests {
    let testService: String
    let keychain: KeychainStorage

    init() {
        self.testService = "tw.nudge.tests.\(UUID().uuidString)"
        self.keychain = KeychainStorage(service: testService)
    }

    func makeClient(status: Int, body: String) -> APIClient {
        MockURLProtocol.handler = { request in
            let data = body.data(using: .utf8)!
            let response = HTTPURLResponse(
                url: request.url!,
                statusCode: status,
                httpVersion: nil,
                headerFields: ["Content-Type": "application/json"]
            )!
            return (data, response)
        }
        return APIClient(
            configuration: APIConfiguration(baseURL: URL(string: "https://test.local")!),
            session: .mocked(),
            tokenProvider: { [keychain] in try? keychain.get(for: "token") }
        )
    }

    @Test func loginStoresTokenAndReturnsUser() async throws {
        let client = makeClient(
            status: 200,
            body: #"""
            {"token":"jwt-xyz","user":{"id":"u1","email":"a@b.c","name":null,"avatarUrl":null,"locale":null}}
            """#
        )
        let repo = AuthRepository(client: client, keychain: keychain)
        let user = try await repo.login(idToken: "google-token")

        #expect(user.id == "u1")
        #expect(try keychain.get(for: "token") == "jwt-xyz")
        #expect(repo.currentUser?.id == "u1")
    }

    @Test func loginFailurePropagatesError() async throws {
        let client = makeClient(status: 401, body: #"{"error":"Invalid token"}"#)
        let repo = AuthRepository(client: client, keychain: keychain)

        await #expect {
            _ = try await repo.login(idToken: "bad-token")
        } throws: { error in
            if case APIError.unauthorized = error { return true }
            return false
        }
        #expect(try keychain.get(for: "token") == nil)
    }

    @Test func logoutRemovesToken() async throws {
        try keychain.set("pre-existing", for: "token")
        let client = makeClient(status: 200, body: "{}")
        let repo = AuthRepository(client: client, keychain: keychain)
        await repo.logout()

        #expect(try keychain.get(for: "token") == nil)
        #expect(repo.currentUser == nil)
    }

    @Test func restoreSessionReturnsTrueWhenTokenValid() async throws {
        try keychain.set("existing-token", for: "token")
        let client = makeClient(
            status: 200,
            body: #"""
            {"id":"u2","email":"x@y.z","name":null,"avatarUrl":null,"locale":"ja","createdAt":"2026-04-17T00:00:00Z"}
            """#
        )
        let repo = AuthRepository(client: client, keychain: keychain)
        let restored = await repo.restoreSession()

        #expect(restored == true)
        #expect(repo.currentUser?.id == "u2")
        #expect(repo.currentUser?.locale == "ja")
    }

    @Test func restoreSessionClearsTokenWhenMeReturnsUnauthorized() async throws {
        try keychain.set("stale-token", for: "token")
        let client = makeClient(status: 401, body: #"{"error":"Unauthorized"}"#)
        let repo = AuthRepository(client: client, keychain: keychain)
        let restored = await repo.restoreSession()

        #expect(restored == false)
        #expect(try keychain.get(for: "token") == nil)
        #expect(repo.currentUser == nil)
    }

    @Test func restoreSessionReturnsFalseWhenNoToken() async throws {
        let client = makeClient(status: 200, body: "{}")
        let repo = AuthRepository(client: client, keychain: keychain)
        let restored = await repo.restoreSession()

        #expect(restored == false)
        #expect(repo.currentUser == nil)
    }
}

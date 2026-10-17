import Testing
import Foundation
@testable import NudgeCore

@Suite("ImageUploadCoordinator", .serialized) struct ImageUploadCoordinatorTests {
    private func makeClient() -> APIClient {
        APIClient(configuration: APIConfiguration(baseURL: URL(string: "https://test.local")!), session: .mocked(), tokenProvider: { "t" })
    }
    private static func okUpload(_ request: URLRequest) -> (Data, HTTPURLResponse) {
        (#"{"id":"a1","width":10,"height":20}"#.data(using: .utf8)!,
         HTTPURLResponse(url: request.url!, statusCode: 201, httpVersion: nil, headerFields: ["Content-Type": "application/json"])!)
    }
    private let req = UploadRequest(requestId: "r1", taskId: "t1", mime: "image/png", data: Data([1]), width: 10, height: 20)

    @MainActor @Test func deliversOkToLiveEditor() async throws {
        MockURLProtocol.handler = { r in Self.okUpload(r) }
        let client = makeClient()
        let c = ImageUploadCoordinator(attachments: AttachmentRepository(client: client), cards: CardRepository(client: client), client: client)
        var got: UploadOutcome?
        c.start(req) { outcome in got = outcome; return true }
        #expect(c.inFlightCount == 1)
        await c.drain()
        #expect(got == .ok(id: "a1", width: 10, height: 20))
        #expect(c.inFlightCount == 0)
    }

    @MainActor @Test func mapsErrorCodes() async throws {
        let client = makeClient()
        let c = ImageUploadCoordinator(attachments: AttachmentRepository(client: client), cards: CardRepository(client: client), client: client)
        for (status, code) in [(413, "imageTooLarge"), (400, "imageUnsupported"), (500, "imageUploadFailed")] {
            MockURLProtocol.handler = { r in (Data(), HTTPURLResponse(url: r.url!, statusCode: status, httpVersion: nil, headerFields: nil)!) }
            var got: UploadOutcome?
            c.start(req) { outcome in got = outcome; return true }
            await c.drain()
            #expect(got == .failed(code: code))
        }
        #expect(c.inFlightCount == 0)
    }

    @MainActor @Test func recoversIntoSavedDescriptionWhenEditorGone() async throws {
        final class Box: @unchecked Sendable { var body = "" }
        let box = Box()
        MockURLProtocol.handler = { r in
            switch (r.httpMethod, r.url?.path) {
            case ("POST", "/api/attachments"):
                return Self.okUpload(r)
            case ("GET", "/api/tasks/t1"):
                let json = #"{"id":"t1","title":"x","description":"<p>a</p><img data-upload-pending=\"true\" data-upload-id=\"r1\" alt=\"\">","updatedAt":"2026-10-17T00:00:00.000Z","tags":[]}"#
                return (json.data(using: .utf8)!, HTTPURLResponse(url: r.url!, statusCode: 200, httpVersion: nil, headerFields: ["Content-Type": "application/json"])!)
            case ("PATCH", "/api/tasks/t1"):
                box.body = String(decoding: r.bodyStreamData() ?? r.httpBody ?? Data(), as: UTF8.self)
                let json = #"{"id":"t1","title":"x","description":"","updatedAt":"2026-10-17T00:00:01.000Z"}"#
                return (json.data(using: .utf8)!, HTTPURLResponse(url: r.url!, statusCode: 200, httpVersion: nil, headerFields: ["Content-Type": "application/json"])!)
            default:
                return (Data(), HTTPURLResponse(url: r.url!, statusCode: 404, httpVersion: nil, headerFields: nil)!)
            }
        }
        let client = makeClient()
        let c = ImageUploadCoordinator(attachments: AttachmentRepository(client: client), cards: CardRepository(client: client), client: client)
        c.start(req) { _ in false }   // 編輯器已關
        await c.drain()
        let patchedBody = box.body
        #expect(patchedBody.contains(#"/api/attachments/a1"#))
        #expect(patchedBody.contains(#"data-attachment-id=\"a1\""#))
        #expect(!patchedBody.contains("data-upload-pending"))
        #expect(patchedBody.contains("baseUpdatedAt"))
        #expect(c.inFlightCount == 0)
    }

    // MARK: - 補寫重試 / 廣播

    private final class Calls: @unchecked Sendable {
        var gets = 0
        var patches = 0
        var patchBodies: [String] = []
    }
    private static func json(_ r: URLRequest, _ status: Int, _ body: String) -> (Data, HTTPURLResponse) {
        (body.data(using: .utf8)!,
         HTTPURLResponse(url: r.url!, statusCode: status, httpVersion: nil, headerFields: ["Content-Type": "application/json"])!)
    }
    private static let pendingCard = #"{"id":"t1","title":"x","description":"<p>a</p><img data-upload-pending=\"true\" data-upload-id=\"r1\" alt=\"\">","updatedAt":"2026-10-17T00:00:00.000Z","tags":[]}"#
    private static let plainCard = #"{"id":"t1","title":"x","description":"<p>a</p>","updatedAt":"2026-10-17T00:00:00.000Z","tags":[]}"#

    @MainActor private func makeCoordinator() -> ImageUploadCoordinator {
        let client = makeClient()
        return ImageUploadCoordinator(
            attachments: AttachmentRepository(client: client), cards: CardRepository(client: client),
            client: client, inFlightSaveRetryDelay: 1_000_000
        )
    }

    @MainActor @Test func placeholderGoneAndNoSaveInFlightSkipsPatch() async throws {
        let calls = Calls()
        MockURLProtocol.handler = { r in
            switch (r.httpMethod, r.url?.path) {
            case ("POST", "/api/attachments"): return Self.okUpload(r)
            case ("GET", "/api/tasks/t1"): calls.gets += 1; return Self.json(r, 200, Self.plainCard)
            case ("PATCH", "/api/tasks/t1"): calls.patches += 1; return Self.json(r, 200, Self.plainCard)
            default: return Self.json(r, 404, "{}")
            }
        }
        #expect(!CardVersionStore.isSaveInFlight(cardId: "t1"))
        let c = makeCoordinator()
        c.start(req) { _ in false }
        await c.drain()
        #expect(calls.gets == 1)
        #expect(calls.patches == 0)
    }

    @MainActor @Test func failedUploadNotDeliveredDoesNotRecover() async throws {
        let calls = Calls()
        MockURLProtocol.handler = { r in
            switch (r.httpMethod, r.url?.path) {
            case ("POST", "/api/attachments"): return Self.json(r, 500, "{}")
            case ("GET", _): calls.gets += 1; return Self.json(r, 200, Self.pendingCard)
            case ("PATCH", _): calls.patches += 1; return Self.json(r, 200, Self.plainCard)
            default: return Self.json(r, 404, "{}")
            }
        }
        let c = makeCoordinator()
        var got: UploadOutcome?
        c.start(req) { outcome in got = outcome; return false }
        await c.drain()
        #expect(got == .failed(code: "imageUploadFailed"))
        #expect(calls.gets == 0)
        #expect(calls.patches == 0)
    }

    @MainActor @Test func conflictOnFirstPatchRetriesOnce() async throws {
        let calls = Calls()
        MockURLProtocol.handler = { r in
            switch (r.httpMethod, r.url?.path) {
            case ("POST", "/api/attachments"): return Self.okUpload(r)
            case ("GET", "/api/tasks/t1"): calls.gets += 1; return Self.json(r, 200, Self.pendingCard)
            case ("PATCH", "/api/tasks/t1"):
                calls.patches += 1
                calls.patchBodies.append(String(decoding: r.bodyStreamData() ?? r.httpBody ?? Data(), as: UTF8.self))
                if calls.patches == 1 {
                    return Self.json(r, 409, #"{"id":"t1","title":"x","description":"<p>a</p>","updatedAt":"2026-10-17T00:00:05.000Z"}"#)
                }
                return Self.json(r, 200, #"{"id":"t1","title":"x","description":"","updatedAt":"2026-10-17T00:00:06.000Z"}"#)
            default: return Self.json(r, 404, "{}")
            }
        }
        let c = makeCoordinator()
        c.start(req) { _ in false }
        await c.drain()
        #expect(calls.gets == 2)
        #expect(calls.patches == 2)
        #expect(calls.patchBodies.allSatisfy { $0.contains("/api/attachments/a1") })
    }

    @MainActor @Test func successfulRecoveryBroadcastsConflictResolved() async throws {
        MockURLProtocol.handler = { r in
            switch (r.httpMethod, r.url?.path) {
            case ("POST", "/api/attachments"): return Self.okUpload(r)
            case ("GET", "/api/tasks/t1"): return Self.json(r, 200, Self.pendingCard)
            case ("PATCH", "/api/tasks/t1"):
                return Self.json(r, 200, #"{"id":"t1","title":"x","description":"","updatedAt":"2026-10-17T00:00:09.000Z"}"#)
            default: return Self.json(r, 404, "{}")
            }
        }
        final class Seen: @unchecked Sendable {
            var info: [AnyHashable: Any]?
            var object: Any?
            var cardsChanged = 0
        }
        let seen = Seen()
        let o1 = NotificationCenter.default.addObserver(forName: CardVersionStore.conflictResolved, object: nil, queue: nil) { note in
            seen.info = note.userInfo
            seen.object = note.object
        }
        let o2 = NotificationCenter.default.addObserver(forName: Notification.Name("nudge.cardsChanged"), object: nil, queue: nil) { _ in
            seen.cardsChanged += 1
        }
        defer {
            NotificationCenter.default.removeObserver(o1)
            NotificationCenter.default.removeObserver(o2)
        }
        let c = makeCoordinator()
        c.start(req) { _ in false }
        await c.drain()
        #expect(seen.object as? String == "t1")
        let desc = seen.info?[CardVersionStore.conflictDescriptionKey] as? String ?? ""
        #expect(desc.contains(#"src="/api/attachments/a1""#))
        #expect(!desc.contains("data-upload-pending"))
        #expect(seen.info?[CardVersionStore.conflictTitleKey] as? String == "x")
        let updatedAt = seen.info?[CardVersionStore.conflictUpdatedAtKey] as? Date
        #expect(updatedAt == ISO8601DateFormatter().date(from: "2026-10-17T00:00:09Z"))
        #expect(seen.cardsChanged == 1)
    }

    @MainActor @Test func placeholderGoneWhileSaveInFlightRetriesGetOnce() async throws {
        let calls = Calls()
        MockURLProtocol.handler = { r in
            switch (r.httpMethod, r.url?.path) {
            case ("POST", "/api/attachments"): return Self.okUpload(r)
            case ("GET", "/api/tasks/t1"):
                calls.gets += 1
                // 第一次 GET 時 flush 還沒落地；等過之後 placeholder 才出現。
                return Self.json(r, 200, calls.gets == 1 ? Self.plainCard : Self.pendingCard)
            case ("PATCH", "/api/tasks/t1"):
                calls.patches += 1
                return Self.json(r, 200, #"{"id":"t1","title":"x","description":"","updatedAt":"2026-10-17T00:00:01.000Z"}"#)
            default: return Self.json(r, 404, "{}")
            }
        }
        CardVersionStore.beginSave(cardId: "t1")
        defer { CardVersionStore.endSave(cardId: "t1") }
        let c = makeCoordinator()
        c.start(req) { _ in false }
        await c.drain()
        #expect(calls.gets == 2)
        #expect(calls.patches == 1)
    }
}

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
}

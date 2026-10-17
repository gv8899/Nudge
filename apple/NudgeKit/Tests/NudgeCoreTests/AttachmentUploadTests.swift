import Testing
import Foundation
@testable import NudgeCore

@Suite("AttachmentRepository.upload", .serialized) struct AttachmentUploadTests {
    @Test @MainActor func postsMultipartWithFieldsAndFile() async throws {
        MockURLProtocol.handler = { request in
            #expect(request.httpMethod == "POST")
            #expect(request.url?.path == "/api/attachments")
            #expect(request.value(forHTTPHeaderField: "Authorization") == "Bearer t")
            let ct = request.value(forHTTPHeaderField: "Content-Type") ?? ""
            #expect(ct.hasPrefix("multipart/form-data; boundary="))
            let boundary = ct.replacingOccurrences(of: "multipart/form-data; boundary=", with: "")
            let body = String(decoding: request.httpBody ?? request.bodyStreamData() ?? Data(), as: UTF8.self)
            #expect(body.contains("--\(boundary)\r\n"))
            #expect(body.contains("Content-Disposition: form-data; name=\"taskId\"\r\n\r\nt1\r\n"))
            #expect(body.contains("Content-Disposition: form-data; name=\"width\"\r\n\r\n640\r\n"))
            #expect(body.contains("Content-Disposition: form-data; name=\"height\"\r\n\r\n480\r\n"))
            #expect(body.contains(#"name="file"; filename="image""#))
            #expect(body.contains("Content-Type: image/webp\r\n\r\n"))
            #expect(body.hasSuffix("\r\n--\(boundary)--\r\n"))
            let data = #"{"id":"a1","mime":"image/webp","size":3,"width":640,"height":480}"#.data(using: .utf8)!
            return (data, HTTPURLResponse(url: request.url!, statusCode: 201, httpVersion: nil, headerFields: ["Content-Type": "application/json"])!)
        }
        let api = APIClient(configuration: APIConfiguration(baseURL: URL(string: "https://test.local")!), session: .mocked(), tokenProvider: { "t" })
        let repo = AttachmentRepository(client: api)
        let r = try await repo.upload(taskId: "t1", data: Data([1, 2, 3]), mime: "image/webp", width: 640, height: 480)
        #expect(r == AttachmentUploadResult(id: "a1", width: 640, height: 480))
    }

    @Test @MainActor func mapsStatusCodes() async throws {
        for (code, expected) in [(413, 413), (400, 400)] {
            MockURLProtocol.handler = { request in
                (Data(), HTTPURLResponse(url: request.url!, statusCode: code, httpVersion: nil, headerFields: nil)!)
            }
            let api = APIClient(configuration: APIConfiguration(baseURL: URL(string: "https://test.local")!), session: .mocked())
            let repo = AttachmentRepository(client: api)
            do {
                _ = try await repo.upload(taskId: "t1", data: Data([1]), mime: "image/png", width: 1, height: 1)
                Issue.record("expected throw for \(code)")
            } catch let e as APIError {
                if case .server(let status, _) = e { #expect(status == expected) } else { Issue.record("wrong error \(e)") }
            }
        }
    }
}

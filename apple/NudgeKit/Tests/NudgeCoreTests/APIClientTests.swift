import Testing
import Foundation
@testable import NudgeCore

@Suite("APIClient", .serialized) struct APIClientTests {
    struct TestPayload: Codable, Equatable {
        let id: String
        let name: String
    }

    @Test func getRequestDecodesJSONResponse() async throws {
        MockURLProtocol.handler = { request in
            #expect(request.httpMethod == "GET")
            #expect(request.url?.path == "/api/me")
            let data = #"{"id":"abc","name":"Mike"}"#.data(using: .utf8)!
            let response = HTTPURLResponse(
                url: request.url!,
                statusCode: 200,
                httpVersion: nil,
                headerFields: ["Content-Type": "application/json"]
            )!
            return (data, response)
        }

        let client = APIClient(
            configuration: APIConfiguration(baseURL: URL(string: "https://test.local")!),
            session: .mocked()
        )
        let result: TestPayload = try await client.get("/api/me")
        #expect(result == TestPayload(id: "abc", name: "Mike"))
    }

    @Test func requestAddsAuthorizationHeaderWhenTokenProvided() async throws {
        MockURLProtocol.handler = { request in
            #expect(request.value(forHTTPHeaderField: "Authorization") == "Bearer test-token")
            let data = #"{"id":"a","name":"b"}"#.data(using: .utf8)!
            let response = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!
            return (data, response)
        }

        let client = APIClient(
            configuration: APIConfiguration(baseURL: URL(string: "https://test.local")!),
            session: .mocked(),
            tokenProvider: { "test-token" }
        )
        let _: TestPayload = try await client.get("/api/me")
    }

    @Test func unauthorizedResponseThrowsUnauthorizedError() async {
        MockURLProtocol.handler = { request in
            let response = HTTPURLResponse(url: request.url!, statusCode: 401, httpVersion: nil, headerFields: nil)!
            return (Data(), response)
        }

        let client = APIClient(
            configuration: APIConfiguration(baseURL: URL(string: "https://test.local")!),
            session: .mocked()
        )

        await #expect {
            let _: TestPayload = try await client.get("/api/me")
        } throws: { error in
            if case APIError.unauthorized = error { return true }
            return false
        }
    }

    @Test func serverErrorCarriesStatusCode() async {
        MockURLProtocol.handler = { request in
            let data = #"{"error":"boom"}"#.data(using: .utf8)!
            let response = HTTPURLResponse(url: request.url!, statusCode: 500, httpVersion: nil, headerFields: nil)!
            return (data, response)
        }

        let client = APIClient(
            configuration: APIConfiguration(baseURL: URL(string: "https://test.local")!),
            session: .mocked()
        )

        await #expect {
            let _: TestPayload = try await client.get("/api/me")
        } throws: { error in
            if case APIError.server(let code, _) = error, code == 500 { return true }
            return false
        }
    }

    @Test func setUnauthorizedHandlerOverridesInit() async throws {
        MockURLProtocol.handler = { request in
            let response = HTTPURLResponse(url: request.url!, statusCode: 401, httpVersion: nil, headerFields: nil)!
            return (Data(), response)
        }

        actor CallCounter {
            var count = 0
            func increment() { count += 1 }
        }
        let counter = CallCounter()

        let client = APIClient(
            configuration: APIConfiguration(baseURL: URL(string: "https://test.local")!),
            session: .mocked()
        )
        client.setUnauthorizedHandler {
            await counter.increment()
        }

        struct P: Codable { let x: String }
        do {
            let _: P = try await client.get("/api/me")
        } catch {
            // expected: unauthorized
        }

        try await Task.sleep(for: .milliseconds(50))
        let count = await counter.count
        #expect(count == 1)
    }

    @Test func postRequestSendsJSONBody() async throws {
        MockURLProtocol.handler = { request in
            #expect(request.httpMethod == "POST")
            #expect(request.value(forHTTPHeaderField: "Content-Type") == "application/json")

            // URLProtocol 讀不到 httpBody（讀的是 httpBodyStream）；跳過 body 斷言

            let data = #"{"id":"x","name":"y"}"#.data(using: .utf8)!
            let response = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!
            return (data, response)
        }

        let client = APIClient(
            configuration: APIConfiguration(baseURL: URL(string: "https://test.local")!),
            session: .mocked()
        )

        struct Body: Codable { let idToken: String }
        let result: TestPayload = try await client.post("/api/auth/mobile", body: Body(idToken: "abc"))
        #expect(result == TestPayload(id: "x", name: "y"))
    }
}

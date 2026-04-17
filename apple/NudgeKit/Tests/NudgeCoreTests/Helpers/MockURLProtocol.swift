import Foundation

/// URLSession 的 mock，攔截 request 回傳指定 response。
///
/// **注意**：`handler` 是 global static，跨 suite 不隔離。跑完整 `swift test` 時
/// 請加 `--no-parallel` 避免多 suite 同時用 handler 造成 race。Per-filter 跑
/// 單一 suite 沒問題。
///
/// 使用方式：
/// ```swift
/// let config = URLSessionConfiguration.ephemeral
/// config.protocolClasses = [MockURLProtocol.self]
/// let session = URLSession(configuration: config)
///
/// MockURLProtocol.handler = { request in
///     let data = "...".data(using: .utf8)!
///     let response = HTTPURLResponse(url: request.url!, statusCode: 200, ...)!
///     return (data, response)
/// }
/// ```
final class MockURLProtocol: URLProtocol, @unchecked Sendable {
    nonisolated(unsafe) static var handler: ((URLRequest) throws -> (Data, HTTPURLResponse))?

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        guard let handler = Self.handler else {
            fatalError("MockURLProtocol.handler not set")
        }
        do {
            let (data, response) = try handler(request)
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: data)
            client?.urlProtocolDidFinishLoading(self)
        } catch {
            client?.urlProtocol(self, didFailWithError: error)
        }
    }

    override func stopLoading() {}
}

extension URLSession {
    static func mocked() -> URLSession {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [MockURLProtocol.self]
        return URLSession(configuration: config)
    }
}

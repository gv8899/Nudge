import Foundation

public final class APIClient: Sendable {
    public typealias TokenProvider = @Sendable () -> String?
    public typealias UnauthorizedHandler = @Sendable () async -> Void

    private let configuration: APIConfiguration
    private let session: URLSession
    private let tokenProvider: TokenProvider?
    private let handlerLock = NSLock()
    private nonisolated(unsafe) var _unauthorizedHandler: UnauthorizedHandler?
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    // ETag cache — 給 GET request 帶 If-None-Match。寫法與
    // _unauthorizedHandler 一致：NSLock + nonisolated(unsafe) dict。
    private let etagLock = NSLock()
    private nonisolated(unsafe) var _etagCache: [String: String] = [:]

    public init(
        configuration: APIConfiguration,
        session: URLSession = .shared,
        tokenProvider: TokenProvider? = nil,
        unauthorizedHandler: UnauthorizedHandler? = nil
    ) {
        self.configuration = configuration
        self.session = session
        self.tokenProvider = tokenProvider
        self._unauthorizedHandler = unauthorizedHandler

        // 用「有/無小數秒都吃」的策略 —— 裸 .iso8601 在較舊 macOS/iOS 解不了
        // server 的毫秒時間戳，會讓整個 DTO decode 失敗（見 NudgeISO8601）。
        self.decoder = NudgeISO8601.makeDecoder()

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.withoutEscapingSlashes]
        self.encoder = encoder
    }

    public func get<Response: Decodable>(_ path: String) async throws -> Response {
        let request = try buildRequest(method: "GET", path: path, body: nil as Empty?)
        return try await perform(request)
    }

    public func post<Body: Encodable, Response: Decodable>(
        _ path: String,
        body: Body
    ) async throws -> Response {
        let request = try buildRequest(method: "POST", path: path, body: body)
        return try await perform(request)
    }

    public func postVoid<Body: Encodable>(
        _ path: String,
        body: Body
    ) async throws {
        let request = try buildRequest(method: "POST", path: path, body: body)
        let _: Empty = try await perform(request)
    }

    public func patch<Body: Encodable, Response: Decodable>(
        _ path: String,
        body: Body
    ) async throws -> Response {
        let request = try buildRequest(method: "PATCH", path: path, body: body)
        return try await perform(request)
    }

    public func patchVoid<Body: Encodable>(
        _ path: String,
        body: Body
    ) async throws {
        let request = try buildRequest(method: "PATCH", path: path, body: body)
        let _: Empty = try await perform(request)
    }

    public func putVoid<Body: Encodable>(
        _ path: String,
        body: Body
    ) async throws {
        let request = try buildRequest(method: "PUT", path: path, body: body)
        let _: Empty = try await perform(request)
    }

    public func put<Body: Encodable, Response: Decodable>(
        _ path: String,
        body: Body
    ) async throws -> Response {
        let request = try buildRequest(method: "PUT", path: path, body: body)
        return try await perform(request)
    }

    public func delete(_ path: String) async throws {
        let request = try buildRequest(method: "DELETE", path: path, body: nil as Empty?)
        let _: Empty = try await perform(request)
    }

    public func deleteReturning<Response: Decodable>(_ path: String) async throws -> Response {
        let request = try buildRequest(method: "DELETE", path: path, body: nil as Empty?)
        return try await perform(request)
    }

    // MARK: - Public setter

    public func setUnauthorizedHandler(_ handler: UnauthorizedHandler?) {
        handlerLock.lock()
        defer { handlerLock.unlock() }
        _unauthorizedHandler = handler
    }

    // MARK: - Private

    private func currentUnauthorizedHandler() -> UnauthorizedHandler? {
        handlerLock.lock()
        defer { handlerLock.unlock() }
        return _unauthorizedHandler
    }

    private func cachedETag(for path: String) -> String? {
        etagLock.lock()
        defer { etagLock.unlock() }
        return _etagCache[path]
    }

    private func storeETag(_ etag: String, for path: String) {
        etagLock.lock()
        defer { etagLock.unlock() }
        _etagCache[path] = etag
    }

    private func buildRequest<Body: Encodable>(
        method: String,
        path: String,
        body: Body?
    ) throws -> URLRequest {
        guard let url = URL(string: path, relativeTo: configuration.baseURL) else {
            throw APIError.invalidResponse
        }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        if let token = tokenProvider?() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        // GET-only: 帶上同 path 的 last-seen ETag，server 一致回 304。
        // Cache key 用 request.url?.path 與 perform 存 ETag 的 key 對齊。
        if method == "GET",
           let urlPath = request.url?.path,
           let etag = cachedETag(for: urlPath) {
            request.setValue(etag, forHTTPHeaderField: "If-None-Match")
        }

        if let body, !(body is Empty) {
            request.httpBody = try encoder.encode(body)
        }

        return request
    }

    private func perform<Response: Decodable>(_ request: URLRequest) async throws -> Response {
        let urlString = request.url?.absoluteString ?? "<nil>"
        let (data, urlResponse): (Data, URLResponse)
        do {
            (data, urlResponse) = try await session.data(for: request)
        } catch {
            print("[APIClient] \(request.httpMethod ?? "?") \(urlString) network error: \(error.localizedDescription)")
            throw APIError.network(underlying: error)
        }

        guard let httpResponse = urlResponse as? HTTPURLResponse else {
            print("[APIClient] \(request.httpMethod ?? "?") \(urlString) invalid response type")
            throw APIError.invalidResponse
        }

        print("[APIClient] \(request.httpMethod ?? "?") \(urlString) -> \(httpResponse.statusCode) (\(data.count) bytes)")

        switch httpResponse.statusCode {
        case 304:
            throw APIError.notModified
        case 200..<300:
            // 存 ETag 供下次 GET 用
            if request.httpMethod == "GET",
               let etag = httpResponse.value(forHTTPHeaderField: "ETag"),
               let path = request.url?.path {
                storeETag(etag, for: path)
            }
            if Response.self == Empty.self {
                return Empty() as! Response
            }
            do {
                return try decoder.decode(Response.self, from: data)
            } catch {
                let body = String(data: data.prefix(300), encoding: .utf8) ?? "<binary>"
                print("[APIClient] decode failed for \(Response.self): \(error)\n  body: \(body)")
                throw APIError.decoding(underlying: error)
            }
        case 401:
            if let handler = currentUnauthorizedHandler() { await handler() }
            throw APIError.unauthorized
        default:
            let message = (try? decoder.decode(ErrorPayload.self, from: data))?.error
            throw APIError.server(statusCode: httpResponse.statusCode, message: message)
        }
    }

    private struct ErrorPayload: Decodable {
        let error: String?
    }

    struct Empty: Codable {}
}

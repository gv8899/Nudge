import Foundation

public final class APIClient: Sendable {
    public typealias TokenProvider = @Sendable () -> String?
    public typealias UnauthorizedHandler = @Sendable () async -> Void

    private let configuration: APIConfiguration
    private let session: URLSession
    /// SSE 長連線專用 session：與一般請求分開的連線池，長時間開著的串流不跟
    /// 圖片 / API 下載搶同一條連線。測試注入 mocked session 時沿用同一個
    /// （MockURLProtocol 才攔得到）。
    private let streamSession: URLSession
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
        // 預設 session：套 makeConfiguration（關 HTTP/3）+ 分段計時 delegate（Release 保留診斷）。
        if session === URLSession.shared {
            self.session = URLSession(configuration: Self.makeConfiguration(), delegate: NetMetricsLogger.shared, delegateQueue: nil)
        } else {
            self.session = session
        }
        self.streamSession = (session === URLSession.shared) ? URLSession(configuration: Self.makeConfiguration()) : session
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

    /// Raw GET：回 bytes + Content-Type，不走 JSON decode。給附件圖片用。
    /// 404 / 401 等沿用 perform 的狀態碼處理（401 會觸發 unauthorizedHandler）。
    public func getData(_ path: String) async throws -> (Data, String?) {
        var request = try buildRequest(method: "GET", path: path, body: nil as Empty?)
        let t0 = Date()
        request.setValue("*/*", forHTTPHeaderField: "Accept")
        let (data, urlResponse): (Data, URLResponse)
        do {
            (data, urlResponse) = try await session.data(for: request)
        } catch {
            throw APIError.network(underlying: error)
        }
        guard let http = urlResponse as? HTTPURLResponse else { throw APIError.invalidResponse }
        switch http.statusCode {
        case 200...299:
            print("[APIClient] GET \(request.url?.absoluteString ?? path) -> \(http.statusCode) (\(data.count) bytes, \(Int(Date().timeIntervalSince(t0) * 1000)) ms)")
            return (data, http.value(forHTTPHeaderField: "Content-Type"))
        case 401:
            if let handler = currentUnauthorizedHandler() { await handler() }
            throw APIError.unauthorized
        default:
            throw APIError.server(statusCode: http.statusCode, message: nil)
        }
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

    /// multipart/form-data POST（附件上傳用）。狀態碼處理沿用 perform
    /// （401 → unauthorizedHandler + `.unauthorized`；其他非 2xx → `.server`）。
    public func postMultipart<Response: Decodable>(
        _ path: String,
        fields: [String: String],
        file: MultipartFile
    ) async throws -> Response {
        var request = try buildRequest(method: "POST", path: path, body: Optional<Empty>.none)
        let boundary = "NudgeBoundary-\(UUID().uuidString)"
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        var body = Data()
        func append(_ s: String) { body.append(Data(s.utf8)) }
        for (key, value) in fields.sorted(by: { $0.key < $1.key }) {
            append("--\(boundary)\r\nContent-Disposition: form-data; name=\"\(key)\"\r\n\r\n\(value)\r\n")
        }
        append("--\(boundary)\r\nContent-Disposition: form-data; name=\"\(file.fieldName)\"; filename=\"\(file.filename)\"\r\nContent-Type: \(file.mime)\r\n\r\n")
        body.append(file.data)
        append("\r\n--\(boundary)--\r\n")
        request.httpBody = body
        return try await perform(request)
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

    /// 樂觀並行 PATCH：把 409 Conflict 當正常結果回傳（而非 throw），並一併
    /// 解出 server 回的最新版 body。200 → `.ok(latest)`；409 → `.conflict(latest)`。
    /// 給卡片 title/description 存檔的版本檢查用。
    public func patchOrConflict<Body: Encodable, Response: Decodable>(
        _ path: String,
        body: Body
    ) async throws -> SaveOutcome<Response> {
        let request = try buildRequest(method: "PATCH", path: path, body: body)
        return try await performAllowingConflict(request)
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

        // 本機 APNs token → 後端排除「發起 mutation 的裝置」，不推給自己
        // （避免打字存檔時自己被喚醒刷新、撞編輯器 409 重載）。macOS 無 token
        // → 不帶（Mac 本來就收不到 push）。
        if let deviceId = PushDeviceToken.current {
            request.setValue(deviceId, forHTTPHeaderField: "X-Nudge-Device-Id")
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

    /// 長連線（SSE）：回傳位元組串流與回應。Accept 改為 text/event-stream，
    /// 不帶 If-None-Match（不是資源 GET）。401 丟 `.unauthorized`（並通知 handler），
    /// 其他非 2xx 丟 `.server(statusCode:message:)`。
    public func eventStream(_ path: String) async throws -> (URLSession.AsyncBytes, HTTPURLResponse) {
        var request = try buildRequest(method: "GET", path: path, body: Optional<Empty>.none)
        request.setValue("text/event-stream", forHTTPHeaderField: "Accept")
        request.setValue(nil, forHTTPHeaderField: "If-None-Match")
        request.timeoutInterval = 60 * 60 * 24
        let (bytes, response) = try await streamSession.bytes(for: request)
        guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
        if http.statusCode == 401 {
            if let handler = currentUnauthorizedHandler() { await handler() }
            throw APIError.unauthorized
        }
        guard (200...299).contains(http.statusCode) else {
            throw APIError.server(statusCode: http.statusCode, message: nil)
        }
        return (bytes, http)
    }

    /// 一般請求 / SSE 共用的 session 設定。
    ///
    /// 關閉 HTTP/3（QUIC）：nudge.tw 的邊緣節點會回 `alt-svc: h3`，URLSession 學到後
    /// 整個 app 生命週期都走同一條 QUIC 連線；實測這條連線的傳輸速率會隨時間崩到
    /// 每秒數十 KB（1.2 MB 附件要 37 s、/api/cards 要 3–7 s），同網路下 HTTP/2 都在
    /// 0.3 s 內。沒有公開 API 可關，用 KVC 設私有 `_allowsHTTP3`；key 不存在時略過
    /// （不會 crash），行為退回系統預設。
    ///
    /// 目前只在 macOS 關（Developer ID 分發不過審核）。iOS 同樣會學到 h3，但私有 key
    /// 有 App Store 審核風險，待決定走伺服器端拿掉 alt-svc 或同招。
    static func makeConfiguration() -> URLSessionConfiguration {
        let config = URLSessionConfiguration.default
        #if os(macOS)
        let key = "_allowsHTTP3"
        if class_getProperty(URLSessionConfiguration.self, key) != nil {
            config.setValue(false, forKey: key)
        }
        #endif
        return config
    }

    private func perform<Response: Decodable>(_ request: URLRequest) async throws -> Response {
        let t0 = Date()
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

        print("[APIClient] \(request.httpMethod ?? "?") \(urlString) -> \(httpResponse.statusCode) (\(data.count) bytes, \(Int(Date().timeIntervalSince(t0) * 1000)) ms)")

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

    /// perform 的變體：200..<300 → `.ok`，409 → `.conflict`（兩者都解 body），
    /// 其餘 status 與 perform 相同處理（401 走 unauthorized handler、其他 throw）。
    private func performAllowingConflict<Response: Decodable>(
        _ request: URLRequest
    ) async throws -> SaveOutcome<Response> {
        let urlString = request.url?.absoluteString ?? "<nil>"
        let (data, urlResponse): (Data, URLResponse)
        do {
            (data, urlResponse) = try await session.data(for: request)
        } catch {
            print("[APIClient] \(request.httpMethod ?? "?") \(urlString) network error: \(error.localizedDescription)")
            throw APIError.network(underlying: error)
        }
        guard let httpResponse = urlResponse as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        print("[APIClient] \(request.httpMethod ?? "?") \(urlString) -> \(httpResponse.statusCode) (\(data.count) bytes)")
        switch httpResponse.statusCode {
        case 200..<300:
            return .ok(try decodeOrThrow(data))
        case 409:
            return .conflict(try decodeOrThrow(data))
        case 401:
            if let handler = currentUnauthorizedHandler() { await handler() }
            throw APIError.unauthorized
        default:
            let message = (try? decoder.decode(ErrorPayload.self, from: data))?.error
            throw APIError.server(statusCode: httpResponse.statusCode, message: message)
        }
    }

    private func decodeOrThrow<Response: Decodable>(_ data: Data) throws -> Response {
        do {
            return try decoder.decode(Response.self, from: data)
        } catch {
            let body = String(data: data.prefix(300), encoding: .utf8) ?? "<binary>"
            print("[APIClient] decode failed for \(Response.self): \(error)\n  body: \(body)")
            throw APIError.decoding(underlying: error)
        }
    }

    private struct ErrorPayload: Decodable {
        let error: String?
    }

    struct Empty: Codable {}
}

/// `APIClient.postMultipart` 的檔案部分。
public struct MultipartFile: Sendable {
    public let fieldName: String
    public let filename: String
    public let mime: String
    public let data: Data

    public init(fieldName: String, filename: String, mime: String, data: Data) {
        self.fieldName = fieldName
        self.filename = filename
        self.mime = mime
        self.data = data
    }
}

/// 樂觀並行存檔結果：`.ok` = 存成功（帶 server 回的最新版）；`.conflict` =
/// server 已被別台改新、這次被擋（帶 server 最新版供 client 採用）。
public enum SaveOutcome<T: Sendable>: Sendable {
    case ok(T)
    case conflict(T)
}


/// 診斷用（Release 保留）：印出每個 URLSession task 的分段時間與協定（h2/h3、連線重用、等回應、傳輸）。
/// 抓 log：`script -q -F <log> <app binary>`。
final class NetMetricsLogger: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    static let shared = NetMetricsLogger()
    func urlSession(_ session: URLSession, task: URLSessionTask, didFinishCollecting metrics: URLSessionTaskMetrics) {
        let path = task.originalRequest?.url?.path ?? "?"
        let total = Int(metrics.taskInterval.duration * 1000)
        var parts: [String] = []
        for (i, m) in metrics.transactionMetrics.enumerated() {
            func ms(_ a: Date?, _ b: Date?) -> String { guard let a, let b else { return "-" }; return "\(Int(b.timeIntervalSince(a) * 1000))" }
            let dns = ms(m.domainLookupStartDate, m.domainLookupEndDate)
            let con = ms(m.connectStartDate, m.connectEndDate)
            let tls = ms(m.secureConnectionStartDate, m.secureConnectionEndDate)
            let wait = ms(m.requestEndDate, m.responseStartDate)
            let xfer = ms(m.responseStartDate, m.responseEndDate)
            let reqSend = ms(m.requestStartDate, m.requestEndDate)
            parts.append("#\(i) \(m.networkProtocolName ?? "?") reused=\(m.isReusedConnection ? 1 : 0) dns=\(dns) connect=\(con) tls=\(tls) send=\(reqSend) wait=\(wait) xfer=\(xfer) fetch=\(m.resourceFetchType.rawValue)")
        }
        print("[net] \(path) total=\(total)ms " + parts.joined(separator: " | "))
    }
}

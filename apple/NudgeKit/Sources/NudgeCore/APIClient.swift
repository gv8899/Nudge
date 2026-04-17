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

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        self.decoder = decoder

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
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

    public func delete(_ path: String) async throws {
        let request = try buildRequest(method: "DELETE", path: path, body: nil as Empty?)
        let _: Empty = try await perform(request)
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

        if let body, !(body is Empty) {
            request.httpBody = try encoder.encode(body)
        }

        return request
    }

    private func perform<Response: Decodable>(_ request: URLRequest) async throws -> Response {
        let (data, urlResponse): (Data, URLResponse)
        do {
            (data, urlResponse) = try await session.data(for: request)
        } catch {
            throw APIError.network(underlying: error)
        }

        guard let httpResponse = urlResponse as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        switch httpResponse.statusCode {
        case 200..<300:
            if Response.self == Empty.self {
                return Empty() as! Response
            }
            do {
                return try decoder.decode(Response.self, from: data)
            } catch {
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

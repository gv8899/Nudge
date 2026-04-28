import Foundation

public enum APIError: Error, Sendable, LocalizedError {
    case unauthorized
    case network(underlying: (any Error)?)
    case server(statusCode: Int, message: String?)
    case decoding(underlying: any Error)
    case invalidResponse
    case notModified

    public var errorDescription: String? {
        switch self {
        case .unauthorized:
            return "Authentication required"
        case .network(let underlying):
            return underlying?.localizedDescription ?? "Network error"
        case .server(let statusCode, let message):
            return message ?? "Server error (\(statusCode))"
        case .decoding:
            return "Failed to decode server response"
        case .invalidResponse:
            return "Invalid server response"
        case .notModified:
            return "Resource not modified (304)"
        }
    }

    public var isCancellation: Bool {
        switch self {
        case .network(let underlying):
            return Self.isCancellation(underlying)
        default:
            return false
        }
    }

    public static func isCancellation(_ error: (any Error)?) -> Bool {
        guard let error else { return false }
        if error is CancellationError { return true }
        if let urlError = error as? URLError, urlError.code == .cancelled { return true }
        let ns = error as NSError
        if ns.domain == NSURLErrorDomain && ns.code == NSURLErrorCancelled { return true }
        return false
    }
}

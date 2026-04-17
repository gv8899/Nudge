import Foundation

public enum APIError: Error, Sendable, LocalizedError {
    case unauthorized
    case network(underlying: (any Error)?)
    case server(statusCode: Int, message: String?)
    case decoding(underlying: any Error)
    case invalidResponse

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
        }
    }
}

import Testing
@testable import NudgeCore

@Test func apiErrorUnauthorizedHasCorrectMessage() {
    let error = APIError.unauthorized
    #expect(error.errorDescription == "Authentication required")
}

@Test func apiErrorServerCarriesStatusCode() {
    let error = APIError.server(statusCode: 500, message: "Internal error")
    if case .server(let statusCode, let message) = error {
        #expect(statusCode == 500)
        #expect(message == "Internal error")
    } else {
        Issue.record("Expected .server case")
    }
}

@Test func apiErrorIsSendable() {
    let error: any Sendable = APIError.network(underlying: nil)
    _ = error
}

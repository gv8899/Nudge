import Testing
import Foundation
@testable import NudgeCore

@MainActor
@Suite("CardVersionStore in-flight") struct CardVersionStoreTests {
    @Test func beginEndTogglesInFlight() {
        let id = "cvs-test-\(UUID().uuidString)"
        #expect(CardVersionStore.isSaveInFlight(cardId: id) == false)
        CardVersionStore.beginSave(cardId: id)
        #expect(CardVersionStore.isSaveInFlight(cardId: id) == true)
        CardVersionStore.endSave(cardId: id)
        #expect(CardVersionStore.isSaveInFlight(cardId: id) == false)
    }

    @Test func nestedSavesStayInFlightUntilLastEnds() {
        let id = "cvs-test-\(UUID().uuidString)"
        let other = "cvs-test-\(UUID().uuidString)"
        CardVersionStore.beginSave(cardId: id)
        CardVersionStore.beginSave(cardId: id)
        #expect(CardVersionStore.isSaveInFlight(cardId: other) == false)
        CardVersionStore.endSave(cardId: id)
        #expect(CardVersionStore.isSaveInFlight(cardId: id) == true)
        CardVersionStore.endSave(cardId: id)
        #expect(CardVersionStore.isSaveInFlight(cardId: id) == false)
    }

    @Test func extraEndDoesNotGoNegative() {
        let id = "cvs-test-\(UUID().uuidString)"
        CardVersionStore.endSave(cardId: id)
        #expect(CardVersionStore.isSaveInFlight(cardId: id) == false)
        CardVersionStore.beginSave(cardId: id)
        #expect(CardVersionStore.isSaveInFlight(cardId: id) == true)
        CardVersionStore.endSave(cardId: id)
        #expect(CardVersionStore.isSaveInFlight(cardId: id) == false)
    }
}

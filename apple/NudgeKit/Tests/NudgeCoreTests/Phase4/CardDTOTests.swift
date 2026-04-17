import Testing
import Foundation
@testable import NudgeCore

@Suite("CardDTO") struct CardDTOTests {
    @Test func cardDecodesWithTags() throws {
        let json = """
        {
          "id": "c1",
          "title": "My card",
          "description": "<p>Hello</p>",
          "updatedAt": "2026-04-17T10:00:00.000Z",
          "tags": [
            {"id": "t1", "name": "Work", "color": "#5a7050", "sortOrder": 0} // nudge:allow-color
          ]
        }
        """.data(using: .utf8)!
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let card = try decoder.decode(CardDTO.self, from: json)
        #expect(card.id == "c1")
        #expect(card.tags.count == 1)
        #expect(card.tags.first?.name == "Work")
    }

    @Test func cardTolerateNullDescription() throws {
        let json = """
        {
          "id": "c1",
          "title": "My card",
          "description": null,
          "updatedAt": "2026-04-17T10:00:00.000Z",
          "tags": []
        }
        """.data(using: .utf8)!
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let card = try decoder.decode(CardDTO.self, from: json)
        #expect(card.description == "")
    }

    @Test func cardListDecodes() throws {
        let json = """
        {
          "cards": [
            {"id":"c1","title":"A","description":"","updatedAt":"2026-04-17T10:00:00.000Z","tags":[]}
          ],
          "nextCursor": "2026-04-17T10:00:00.000Z"
        }
        """.data(using: .utf8)!
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let list = try decoder.decode(CardListDTO.self, from: json)
        #expect(list.cards.count == 1)
        #expect(list.nextCursor == "2026-04-17T10:00:00.000Z")
    }

    @Test func cardListDecodesNullCursor() throws {
        let json = """
        {"cards": [], "nextCursor": null}
        """.data(using: .utf8)!
        let list = try JSONDecoder().decode(CardListDTO.self, from: json)
        #expect(list.nextCursor == nil)
    }
}

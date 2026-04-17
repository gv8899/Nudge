import Testing
import Foundation
@testable import NudgeCore

@Suite("Auth DTO") struct AuthDTOTests {
    @Test func authRequestEncodesIdToken() throws {
        let request = MobileAuthRequest(idToken: "google-id-token")
        let data = try JSONEncoder().encode(request)
        let json = try #require(String(data: data, encoding: .utf8))
        #expect(json.contains("\"idToken\":\"google-id-token\""))
    }

    @Test func authResponseDecodesTokenAndUser() throws {
        let json = #"""
        {
          "token": "jwt-abc",
          "user": {
            "id": "u1",
            "email": "mike@example.com",
            "name": "Mike",
            "avatarUrl": "https://example.com/pic.jpg",
            "locale": "ja"
          }
        }
        """#.data(using: .utf8)!

        let response = try JSONDecoder().decode(MobileAuthResponse.self, from: json)
        #expect(response.token == "jwt-abc")
        #expect(response.user.id == "u1")
        #expect(response.user.email == "mike@example.com")
        #expect(response.user.name == "Mike")
        #expect(response.user.avatarUrl == "https://example.com/pic.jpg")
        #expect(response.user.locale == "ja")
    }

    @Test func userDTODecodesNullableFields() throws {
        let json = #"""
        {
          "id": "u1",
          "email": "mike@example.com",
          "name": null,
          "avatarUrl": null,
          "locale": null
        }
        """#.data(using: .utf8)!

        let user = try JSONDecoder().decode(UserDTO.self, from: json)
        #expect(user.id == "u1")
        #expect(user.name == nil)
        #expect(user.avatarUrl == nil)
        #expect(user.locale == nil)
    }
}

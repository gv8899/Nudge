import Foundation
import Observation

@Observable
@MainActor
public final class CardRepository {
    private let client: APIClient

    /// Card 內容（title / description）變動後 broadcast — 讓「最近卡片」之類
    /// 的 list 知道要 refetch（不然編輯完卡片不會跳到 list 最上面）。定義在
    /// NudgeCore 是因為 CardRepository 在這個 module、NudgeUI 才能反向 listen。
    public static let cardDidChangeNotification = Notification.Name("nudge.cardDidChange")

    public init(client: APIClient) {
        self.client = client
    }

    /// Fetches one page of cards. Pass `cursor = nil` for the first page.
    /// Empty `query` omits the `q=` query parameter.
    /// `tagIds` filters with AND semantics — card must carry every listed tag.
    public func list(query: String, cursor: String?, tagIds: [String] = [], limit: Int = 20) async throws -> CardListDTO {
        // Build query string manually so values are fully percent-encoded
        // (URLComponents leaves colons and other RFC-allowed chars unencoded).
        var allowed = CharacterSet.urlQueryAllowed
        allowed.remove(charactersIn: ":@!$&'()*+,;=")
        func encode(_ value: String) -> String {
            value.addingPercentEncoding(withAllowedCharacters: allowed) ?? value
        }
        var pairs: [String] = ["limit=\(limit)"]
        if !query.isEmpty {
            pairs.append("q=\(encode(query))")
        }
        if let cursor, !cursor.isEmpty {
            pairs.append("cursor=\(encode(cursor))")
        }
        if !tagIds.isEmpty {
            // Sort so caches and request URLs are stable per filter set.
            let csv = tagIds.sorted().joined(separator: ",")
            pairs.append("tagIds=\(encode(csv))")
        }
        let path = "/api/cards?" + pairs.joined(separator: "&")
        return try await client.get(path)
    }

    /// Creates a new empty card (POST /api/tasks). Returns it as a
    /// CardDTO so the caller can push the detail view immediately.
    public func create() async throws -> CardDTO {
        struct Body: Codable {
            let title: String
            let description: String
            let status: String
        }
        struct TaskShim: Codable {
            let id: String
            let title: String
            let description: String?
            let updatedAt: Date
        }
        let body = Body(title: "", description: "<p></p>", status: "inbox")
        let shim: TaskShim = try await client.post("/api/tasks", body: body)
        return CardDTO(
            id: shim.id,
            title: shim.title,
            description: shim.description ?? "",
            updatedAt: shim.updatedAt,
            tags: []
        )
    }

    /// Fetches one card (task) by id, including its tags. Backs the shared
    /// detail view when called from entry points that only have a task id
    /// (e.g. Daily page rows, which carry a TaskDTO with no tags).
    public func get(cardId: String) async throws -> CardDTO {
        let card: CardDTO = try await client.get("/api/tasks/\(cardId)")
        // seed 樂觀並行基準 —— 拿到 server 最新 updatedAt 當「目前畫面內容
        // 所基於的版本」，之後這張卡的存檔會帶這個 base 做版本檢查。
        CardVersionStore.seed(cardId: cardId, updatedAt: card.updatedAt)
        return card
    }

    /// PATCHes the title of an existing card（帶 baseUpdatedAt 樂觀並行；衝突
    /// 由 saveCardFieldWithVersionCheck 廣播）。
    public func updateTitle(cardId: String, title: String) async throws {
        try await saveCardFieldWithVersionCheck(client: client, cardId: cardId, title: title)
        NotificationCenter.default.post(name: Self.cardDidChangeNotification, object: cardId)
    }

    /// PATCHes the rich-text description of an existing card.
    /// `html` is the same HTML string Web's TipTap editor emits; empty content
    /// is normalized to `""` (matches Web's card-detail.tsx behavior).
    public func updateDescription(cardId: String, html: String) async throws {
        try await saveCardFieldWithVersionCheck(client: client, cardId: cardId, description: html)
        NotificationCenter.default.post(name: Self.cardDidChangeNotification, object: cardId)
    }

    /// PATCHes the absolute one-shot reminder time on a non-recurring task.
    /// Pass nil to clear. Recurrence-driven reminders go via
    /// RecurrenceRepository.upsert(remindAtTimeOfDay:) instead.
    public func updateRemindAt(cardId: String, remindAt: String?) async throws {
        struct Body: Codable { let remindAt: String? }
        try await client.patchVoid("/api/tasks/\(cardId)", body: Body(remindAt: remindAt))
    }

    /// Deletes every card whose title is empty or whitespace-only.
    /// Returns the number of cards deleted.
    public func deleteUntitled() async throws -> Int {
        struct Response: Codable { let deleted: Int }
        let response: Response = try await client.deleteReturning("/api/cards/untitled")
        return response.deleted
    }
}

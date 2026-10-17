import Foundation

/// 卡片內容（title/description）存檔的「樂觀並行」基準版本追蹤 + 衝突廣播。
///
/// 跨裝置同時編輯同一張卡時，停在舊版本的裝置存檔會被 server 回 409。這裡
/// 集中記「我這台目前畫面內容基於哪個 updatedAt」，存檔時送給 server 比對；
/// server 若已被別台改新 → 回 409 + 最新版 → 這裡廣播，開著該卡的編輯器靜默
/// 改用最新（方案二：silent use-latest，丟棄本機這次衝突的編輯）。
///
/// 由編輯器 view 在顯示卡片時 `seed`（用當下顯示內容的 updatedAt）；repo 存檔
/// 時讀 `base`、送 server、依結果 `advance`（200）或廣播衝突（409）。
/// process-wide 單例（純記憶體、以 cardId 為 key），Cards 路徑（CardRepository）
/// 與 Daily 路徑（TaskRepository）共用同一份基準。
@MainActor
public enum CardVersionStore {
    private static var baseByCardId: [String: Date] = [:]
    /// 存檔在途計數（對應 Web 的 isCardSaveInFlight）：PATCH 發出到回應處理完
    /// 之間基準還沒推進，這段期間收到自己寫入的 SSE 回音會被誤判成「別處改了」。
    /// 即時同步閘門把在途視為 pending。
    private static var inFlightByCardId: [String: Int] = [:]

    /// 編輯器顯示某張卡時呼叫 —— 記錄「目前畫面內容所基於的版本」。
    public static func seed(cardId: String, updatedAt: Date) {
        baseByCardId[cardId] = updatedAt
    }

    /// 取存檔要送的 baseUpdatedAt（沒 seed 過回 nil → server 跳過版本檢查）。
    public static func base(cardId: String) -> Date? {
        baseByCardId[cardId]
    }

    /// 存檔成功 / 衝突解決後，推進基準到 server 回的最新 updatedAt。
    public static func advance(cardId: String, to updatedAt: Date) {
        baseByCardId[cardId] = updatedAt
    }

    /// 存檔開始（`saveCardFieldWithVersionCheck` 呼叫；與 `endSave` 成對）。
    public static func beginSave(cardId: String) {
        inFlightByCardId[cardId, default: 0] += 1
    }

    /// 存檔結束（成功 / 409 / 丟錯都要呼叫）。
    public static func endSave(cardId: String) {
        let n = (inFlightByCardId[cardId] ?? 1) - 1
        if n <= 0 { inFlightByCardId[cardId] = nil } else { inFlightByCardId[cardId] = n }
    }

    /// 這張卡是否有存檔尚未完成（即時同步 pending 閘門用）。
    public static func isSaveInFlight(cardId: String) -> Bool {
        (inFlightByCardId[cardId] ?? 0) > 0
    }

    /// 409 衝突解決廣播：object = cardId，userInfo 帶 server 最新 title /
    /// description / updatedAt。開著該卡的編輯器 view 收到後靜默改用最新。
    public static let conflictResolved = Notification.Name("nudge.card.conflictResolved")
    public static let conflictTitleKey = "title"
    public static let conflictDescriptionKey = "description"
    public static let conflictUpdatedAtKey = "updatedAt"
}

/// server PATCH /api/tasks/[id] 回傳（200）或 409 body 解出的精簡卡片版本資訊。
public struct CardVersionShim: Decodable, Sendable {
    public let id: String
    public let title: String
    public let description: String?
    public let updatedAt: Date
}

/// 共用存檔：帶 baseUpdatedAt 樂觀並行 PATCH 卡片欄位，處理 200/409。
/// CardRepository（Cards 路徑）與 TaskRepository（Daily 路徑）共用，兩條路徑
/// 存同一張卡都走相同的版本檢查 + 衝突廣播。title / description 只送有值的那個
/// （nil 會被 Encodable 省略 → server 不動該欄位）。
/// 回傳 server 的結果（200 → `.ok(saved)`、409 → `.conflict(latest)`，409 已在這裡
/// 廣播過）；一般存檔呼叫端可忽略，圖片補寫需要它判斷要不要重試 + 拿 updatedAt。
@MainActor
@discardableResult
public func saveCardFieldWithVersionCheck(
    client: APIClient,
    cardId: String,
    title: String? = nil,
    description: String? = nil
) async throws -> SaveOutcome<CardVersionShim> {
    struct Body: Encodable {
        let title: String?
        let description: String?
        let baseUpdatedAt: Date?
    }
    CardVersionStore.beginSave(cardId: cardId)
    defer { CardVersionStore.endSave(cardId: cardId) }
    let body = Body(
        title: title,
        description: description,
        baseUpdatedAt: CardVersionStore.base(cardId: cardId)
    )
    let outcome: SaveOutcome<CardVersionShim> = try await client.patchOrConflict(
        "/api/tasks/\(cardId)", body: body
    )
    switch outcome {
    case .ok(let task):
        CardVersionStore.advance(cardId: cardId, to: task.updatedAt)
    case .conflict(let latest):
        CardVersionStore.advance(cardId: cardId, to: latest.updatedAt)
        NotificationCenter.default.post(
            name: CardVersionStore.conflictResolved,
            object: cardId,
            userInfo: [
                CardVersionStore.conflictTitleKey: latest.title,
                CardVersionStore.conflictDescriptionKey: latest.description ?? "",
                CardVersionStore.conflictUpdatedAtKey: latest.updatedAt,
            ]
        )
    }
    return outcome
}

import Foundation

/// 共用的 ISO8601 日期解析策略 —— **同時吃「有/無小數秒」**。
///
/// 為什麼不直接用 `JSONDecoder.DateDecodingStrategy.iso8601`：在較舊的
/// macOS / iOS Foundation 上，`.iso8601` 走嚴格行為（內部
/// `ISO8601DateFormatter` 預設 `[.withInternetDateTime]`，**不含** fractional
/// seconds），解不了 server 用 `new Date().toISOString()` 產的毫秒時間戳
/// （`"2026-06-15T02:51:18.061Z"`）→ `date(from:)` 回 nil → JSONDecoder
/// throws → 整個 DTO decode 失敗。症狀：行動頁「發生錯誤」。較新的 macOS 26
/// Foundation 寬鬆才沒事，所以開發機看不到。
///
/// codebase 其他多處（calendar / schedule / notification）早就各自手刻
/// `[.withInternetDateTime, .withFractionalSeconds]`；這裡集中成一處，所有
/// 走 API/JSON 的 `JSONDecoder` 統一用它。
public enum NudgeISO8601 {
    /// 給 `decoder.dateDecodingStrategy = .custom(NudgeISO8601.decodeDate)` 用。
    /// 先試帶小數秒、再試不帶；兩者都失敗才 throw。formatter 就地建（decode
    /// 一次網路回應才跑、非熱迴圈），避免共用 static 在 Swift 6 Sendable 下的
    /// data-race 顧慮。
    public static func decodeDate(_ decoder: Decoder) throws -> Date {
        let container = try decoder.singleValueContainer()
        let s = try container.decode(String.self)

        let withFractional = ISO8601DateFormatter()
        withFractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = withFractional.date(from: s) { return date }

        let plain = ISO8601DateFormatter()
        plain.formatOptions = [.withInternetDateTime]
        if let date = plain.date(from: s) { return date }

        throw DecodingError.dataCorrupted(
            DecodingError.Context(
                codingPath: decoder.codingPath,
                debugDescription: "Invalid ISO8601 date: \(s)"
            )
        )
    }

    /// 預設 decoder —— dateDecodingStrategy 已套上「有/無小數秒都吃」。
    public static func makeDecoder() -> JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { try decodeDate($0) }
        return decoder
    }
}

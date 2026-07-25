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
/// 兩個 `ISO8601DateFormatter`（帶/不帶小數秒）的共用快取。
///
/// 原本各呼叫點都就地新建 formatter，理由是「decode 一次網路回應才跑、
/// 非熱迴圈」。但 `date(from:)` 後來被拉進 render 熱路徑 —— 日曆各檢視的
/// `isPast(_:)` 每個事件 bar 呼叫一次，月檢視一次 render 最多 126 次 ——
/// 建立成本（ICU 初始化）就變成 CPU 與記憶體的實際來源。
///
/// 當初避開共用 static 是顧慮 Swift 6 的 data race；這裡改用鎖正面解決：
/// formatter 不交出臨界區，解析在鎖內完成。
private final class ISO8601Cache: @unchecked Sendable {
    static let shared = ISO8601Cache()

    private let lock = NSLock()
    private let withFractional: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
    private let plain: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    /// 先試帶小數秒、再試不帶。
    func date(from s: String) -> Date? {
        lock.lock()
        defer { lock.unlock() }
        if let date = withFractional.date(from: s) { return date }
        return plain.date(from: s)
    }
}

public enum NudgeISO8601 {
    /// 給 `decoder.dateDecodingStrategy = .custom(NudgeISO8601.decodeDate)` 用。
    /// 先試帶小數秒、再試不帶；兩者都失敗才 throw。
    public static func decodeDate(_ decoder: Decoder) throws -> Date {
        let container = try decoder.singleValueContainer()
        let s = try container.decode(String.self)

        if let date = ISO8601Cache.shared.date(from: s) { return date }

        throw DecodingError.dataCorrupted(
            DecodingError.Context(
                codingPath: decoder.codingPath,
                debugDescription: "Invalid ISO8601 date: \(s)"
            )
        )
    }

    /// 直接把 ISO8601 字串轉 Date（有/無小數秒都吃）。給非 decode 場景用
    /// （例：entitlement 的 accessUntil 算剩餘天數、日曆判斷事件是否已過）。
    public static func date(from s: String) -> Date? {
        ISO8601Cache.shared.date(from: s)
    }

    /// 預設 decoder —— dateDecodingStrategy 已套上「有/無小數秒都吃」。
    public static func makeDecoder() -> JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { try decodeDate($0) }
        return decoder
    }
}

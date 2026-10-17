import Foundation

/// 伺服器同步事件（GET /api/sync/events）。
public enum SyncEvent: Equatable, Sendable {
    case task(id: String, updatedAt: Date)
    case any
}

/// 最小 SSE 解析器：逐行餵（`URLSession.AsyncBytes.lines` 已去掉換行），
/// 空行代表一個事件結束。只認 `event: change`；`:` 開頭是心跳 / 註解。
public struct SSEParser: Sendable {
    private var eventName: String?
    private var dataLines: [String] = []

    public init() {}

    public mutating func feed(line: String) -> SyncEvent? {
        if line.isEmpty {
            defer { eventName = nil; dataLines = [] }
            guard eventName == "change", !dataLines.isEmpty else { return nil }
            return Self.parse(data: dataLines.joined(separator: "\n"))
        }
        if line.hasPrefix(":") { return nil }
        if line.hasPrefix("event:") {
            eventName = line.dropFirst("event:".count).trimmingCharacters(in: .whitespaces)
        } else if line.hasPrefix("data:") {
            dataLines.append(String(line.dropFirst("data:".count).trimmingCharacters(in: .whitespaces)))
        }
        return nil
    }

    private struct Wire: Decodable {
        let kind: String
        let id: String?
        let updatedAt: String?
    }

    static func parse(data: String) -> SyncEvent? {
        guard let bytes = data.data(using: .utf8),
              let w = try? JSONDecoder().decode(Wire.self, from: bytes) else { return nil }
        switch w.kind {
        case "any":
            return .any
        case "task":
            guard let id = w.id, let s = w.updatedAt, let d = NudgeISO8601.date(from: s) else { return nil }
            return .task(id: id, updatedAt: d)
        default:
            return nil
        }
    }
}

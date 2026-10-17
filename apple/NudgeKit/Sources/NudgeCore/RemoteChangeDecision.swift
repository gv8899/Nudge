import Foundation

public enum RemoteDecision: Equatable, Sendable { case apply, ignore, listOnly }

/// 打開中的卡片收到同步事件要怎麼辦 —— 與 Web `src/lib/live-sync-rules.ts`
/// 鏡像。改一邊，兩邊測試都要過。
public enum RemoteChangeDecision {
    /// 與 server 409 判斷一致：秒精度。
    public static func sameSecond(_ a: Date, _ b: Date) -> Bool {
        floor(a.timeIntervalSince1970) == floor(b.timeIntervalSince1970)
    }

    public static func decide(event: SyncEvent, cardId: String, base: Date?, hasPending: Bool) -> RemoteDecision {
        guard case .task(let id, let updatedAt) = event, id == cardId else { return .listOnly }
        if let base {
            if sameSecond(updatedAt, base) { return .ignore }
            if updatedAt < base { return .ignore }
        }
        // 本機有未存檔修改：不抓、不 seed、不重載（CardRepository.get 會 seed）。
        if hasPending { return .ignore }
        return .apply
    }
}

import Foundation
import Observation

public enum NudgeSync {
    /// 收到一個同步事件。userInfo[eventKey] = SyncEventBox。
    public static let changeNotification = Notification.Name("nudge.sync.change")
    /// 斷線後重新連上（第二次以後的連線成功）—— 訂閱者應補抓一次。
    public static let reconnectedNotification = Notification.Name("nudge.sync.reconnected")
    public static let eventKey = "event"
}

public final class SyncEventBox: NSObject, Sendable {
    public let event: SyncEvent
    public init(_ event: SyncEvent) { self.event = event }
}

/// 卡片即時同步的長連線。前景且已登入時 `start()`，退背景 / 登出 `stop()`。
/// 斷線退避重連 1→2→4…≤30s；401 停止（等重新登入後再 start）。
@MainActor
@Observable
public final class SyncStreamClient {
    public enum State: Equatable, Sendable {
        case idle, connecting, connected
        case backingOff(seconds: Double)
        case stopped(reason: String)
    }

    public private(set) var state: State = .idle

    private let client: APIClient
    private let path: String
    private let minBackoff: Double
    private let maxBackoff: Double
    private var task: Task<Void, Never>?
    private var successfulConnections = 0

    public init(client: APIClient, path: String = "/api/sync/events", minBackoff: Double = 1, maxBackoff: Double = 30) {
        self.client = client
        self.path = path
        self.minBackoff = minBackoff
        self.maxBackoff = maxBackoff
    }

    public nonisolated static func nextBackoff(after current: Double?, min: Double, max: Double) -> Double {
        guard let current else { return min }
        return Swift.min(max, current * 2)
    }

    public func start() {
        guard task == nil else { return }
        successfulConnections = 0
        task = Task { [weak self] in await self?.run() }
    }

    public func stop() {
        task?.cancel()
        task = nil
        state = .idle
    }

    private static func post(_ event: SyncEvent) {
        NotificationCenter.default.post(
            name: NudgeSync.changeNotification, object: nil,
            userInfo: [NudgeSync.eventKey: SyncEventBox(event)]
        )
    }

    private func run() async {
        var backoff: Double? = nil
        while !Task.isCancelled {
            state = .connecting
            do {
                let (bytes, _) = try await client.eventStream(path)
                if Task.isCancelled { return }
                state = .connected
                successfulConnections += 1
                if successfulConnections > 1 {
                    NotificationCenter.default.post(name: NudgeSync.reconnectedNotification, object: nil)
                }
                backoff = nil
                // 不用 `bytes.lines`：AsyncLineSequence 會丟掉空行，而空行正是 SSE
                // 事件的結束符號 → 事件永遠不會送出。自己按 \n 切，空行也餵給 parser。
                var parser = SSEParser()
                var buffer: [UInt8] = []
                for try await byte in bytes {
                    if Task.isCancelled { return }
                    if byte == 0x0A {
                        if buffer.last == 0x0D { buffer.removeLast() }
                        let line = String(decoding: buffer, as: UTF8.self)
                        buffer.removeAll(keepingCapacity: true)
                        if let event = parser.feed(line: line) { Self.post(event) }
                    } else {
                        buffer.append(byte)
                    }
                }
                if Task.isCancelled { return }
                // EOF：最後一個事件若沒有結尾空行也送出（事件只是「去補抓」的提示，
                // 多送一次無害；JSON 被截斷的話 parser 本來就會丟掉）。
                if !buffer.isEmpty, let event = parser.feed(line: String(decoding: buffer, as: UTF8.self)) {
                    Self.post(event)
                }
                if let event = parser.feed(line: "") { Self.post(event) }
                // 串流正常結束（server 重啟等）→ 走退避重連
            } catch is CancellationError {
                return
            } catch let e as APIError where e.isUnauthorized {
                state = .stopped(reason: "unauthorized")
                task = nil
                return
            } catch {
                // 網路錯 / 非 2xx → 退避重連
            }
            if Task.isCancelled { return }
            let wait = Self.nextBackoff(after: backoff, min: minBackoff, max: maxBackoff)
            backoff = wait
            state = .backingOff(seconds: wait)
            try? await Task.sleep(nanoseconds: UInt64(wait * 1_000_000_000))
        }
    }
}

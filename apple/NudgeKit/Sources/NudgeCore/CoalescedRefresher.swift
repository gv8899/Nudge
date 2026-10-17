import Foundation

/// 把短時間內的多次刷新請求合併成一次：debounce `delay` 後執行 `action`；
/// 執行中再收到請求 → 結束後再跑一次（最多一次 pending）。
///
/// 用途：一次存檔 / 上傳圖片會在 ~2 秒內連發多個 SSE change / cardsChanged
/// 通知，若每個都直接重抓 `/api/cards`，會同時打出好幾個重查詢、把後面的
/// 請求（例如圖片 GET）卡在後面。透過這個類別合併成一次。
@MainActor public final class CoalescedRefresher {
    private let delay: Duration
    private let action: @MainActor () async -> Void
    private var timer: Task<Void, Never>?
    private var isRunning = false
    private var pending = false

    /// 實際執行 action 的次數（測試用）。
    public private(set) var runCount: Int = 0

    public init(delay: Duration = .milliseconds(800), action: @escaping @MainActor () async -> Void) {
        self.delay = delay
        self.action = action
    }

    /// 請求一次刷新：啟動（或重新啟動）debounce 計時器。
    public func request() {
        timer?.cancel()
        let delay = self.delay
        timer = Task { [weak self] in
            try? await Task.sleep(for: delay)
            guard !Task.isCancelled else { return }
            await self?.fire()
        }
    }

    /// 取消尚未觸發的計時器並清掉 pending（執行中的 action 不會被中斷）。
    public func cancel() {
        timer?.cancel()
        timer = nil
        pending = false
    }

    private func fire() async {
        timer = nil
        if isRunning {
            pending = true
            return
        }
        isRunning = true
        repeat {
            pending = false
            runCount += 1
            await action()
        } while pending
        isRunning = false
    }
}

import Foundation
import Observation

public struct UploadRequest: Sendable {
    public let requestId: String
    public let taskId: String
    public let mime: String
    public let data: Data
    public let width: Int
    public let height: Int

    public init(requestId: String, taskId: String, mime: String, data: Data, width: Int, height: Int) {
        self.requestId = requestId
        self.taskId = taskId
        self.mime = mime
        self.data = data
        self.width = width
        self.height = height
    }
}

public enum UploadOutcome: Sendable, Equatable {
    case ok(id: String, width: Int?, height: Int?)
    /// "imageTooLarge" | "imageUnsupported" | "imageUploadFailed"
    case failed(code: String)
}

/// Mac 編輯器的圖片上傳由 App 層持有：webview 關掉後上傳仍要跑完，並把結果補寫
/// 進已存檔的內文（對應 Web use-image-upload 的 recoverIntoSavedDescription）。
@MainActor
@Observable
public final class ImageUploadCoordinator {
    @ObservationIgnored private let attachments: AttachmentRepository
    @ObservationIgnored private let cards: CardRepository
    @ObservationIgnored private let client: APIClient
    /// key 用內部 token（不用 requestId）：同 requestId 重送時，舊 Task 的收尾不會清掉新 Task。
    @ObservationIgnored private var tasks: [UUID: Task<Void, Never>] = [:]
    public private(set) var inFlightCount = 0
    /// 補寫時 placeholder 不在、但有存檔在途 → 等這麼久再 GET 一次。
    @ObservationIgnored private let inFlightSaveRetryDelay: UInt64

    public init(
        attachments: AttachmentRepository,
        cards: CardRepository,
        client: APIClient,
        inFlightSaveRetryDelay: UInt64 = 1_000_000_000
    ) {
        self.attachments = attachments
        self.cards = cards
        self.client = client
        self.inFlightSaveRetryDelay = inFlightSaveRetryDelay
    }

    /// 上傳；完成後呼叫 deliver。deliver 回 false（webview 已不在 / eval 失敗）→ 走補寫。
    public func start(_ req: UploadRequest, deliver: @escaping @MainActor (UploadOutcome) async -> Bool) {
        let token = UUID()
        inFlightCount += 1
        tasks[token] = Task { [weak self] in
            guard let self else { return }
            defer {
                self.inFlightCount -= 1
                self.tasks[token] = nil
            }
            let outcome = await self.upload(req)
            let delivered = await deliver(outcome)
            if !delivered, case .ok(let id, let w, let h) = outcome {
                await self.recover(
                    taskId: req.taskId,
                    uploadId: req.requestId,
                    result: AttachmentUploadResult(id: id, width: w, height: h)
                )
            }
        }
    }

    private func upload(_ req: UploadRequest) async -> UploadOutcome {
        do {
            let r = try await attachments.upload(
                taskId: req.taskId, data: req.data, mime: req.mime, width: req.width, height: req.height
            )
            return .ok(id: r.id, width: r.width, height: r.height)
        } catch APIError.server(let status, _) where status == 413 {
            return .failed(code: "imageTooLarge")
        } catch APIError.server(let status, _) where status == 400 {
            return .failed(code: "imageUnsupported")
        } catch {
            return .failed(code: "imageUploadFailed")
        }
    }

    /// 卡片編輯器已關（或 deliver 失敗）時，把上傳結果補寫進伺服器端已存檔的內文。
    ///
    /// - placeholder 不在、但這張卡有存檔在途（編輯器關掉時的 flush 還沒落地）→
    ///   等一下再 GET 一次。
    /// - PATCH 撞 409（helper 已廣播 server 最新）→ 重新 GET + 套一次（transform 只換
    ///   那一格 placeholder，可重入）。
    /// - 成功 → 廣播 conflictResolved（開著同卡、沒編輯過的 CardDetailView 會改用補寫
    ///   後內容）+ 清單重抓通知。
    private func recover(taskId: String, uploadId: String, result: AttachmentUploadResult) async {
        var waitedForInFlightSave = false
        var retriedConflict = false
        do {
            while true {
                let card = try await cards.get(cardId: taskId, seedVersion: false)
                guard let next = AttachmentHTMLRewrite.replacePendingImage(
                    html: card.description, uploadId: uploadId, result: result
                ) else {
                    if !waitedForInFlightSave && CardVersionStore.isSaveInFlight(cardId: taskId) {
                        waitedForInFlightSave = true
                        try? await Task.sleep(nanoseconds: inFlightSaveRetryDelay)
                        continue
                    }
                    return   // placeholder 已被後續存檔丟掉 → 使用者不要這張圖了
                }
                CardVersionStore.seed(cardId: taskId, updatedAt: card.updatedAt)
                let outcome = try await saveCardFieldWithVersionCheck(
                    client: client, cardId: taskId, description: next
                )
                switch outcome {
                case .ok(let saved):
                    NotificationCenter.default.post(
                        name: CardVersionStore.conflictResolved,
                        object: taskId,
                        userInfo: [
                            CardVersionStore.conflictTitleKey: card.title,
                            CardVersionStore.conflictDescriptionKey: next,
                            CardVersionStore.conflictUpdatedAtKey: saved.updatedAt,
                        ]
                    )
                    NotificationCenter.default.post(name: CardRepository.cardDidChangeNotification, object: taskId)
                    // = NudgeCommands.cardsChangedNotification（NudgeUI，NudgeCore 不能 import）。
                    NotificationCenter.default.post(name: Notification.Name("nudge.cardsChanged"), object: nil)
                    return
                case .conflict:
                    if retriedConflict { return }
                    retriedConflict = true
                }
            }
        } catch {
            // 補寫盡力而為；失敗的附件留給孤兒清理（reap-orphan-attachments）。
        }
    }

    /// 測試用：等所有在途 Task 完成（含等待期間新起的）。
    public func drain() async {
        while !tasks.isEmpty {
            let snapshot = Array(tasks.values)
            for t in snapshot { await t.value }
        }
    }
}

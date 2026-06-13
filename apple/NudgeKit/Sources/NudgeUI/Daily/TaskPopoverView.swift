#if os(macOS)
import SwiftUI
import NudgeCore

/// 行動頁點任務彈出的快速編輯 modal —— 與「卡片 modal」一致：task 與 card
/// 本質是同一個東西（同 `/api/tasks/[id]`），所以這裡直接 fetch CardDTO 後
/// 複用 `CardDetailView`（卡片 modal 的同一個元件：大標題原地編輯 + 內文
/// 編輯器 + 展開/關閉玻璃鈕）。外層由 root 的 `NudgeModalOverlay` 提供背景/
/// 圓角/點外關閉/⎋。
///
/// 「展開」→ `onExpand`（post expandTaskNotification，DailyHostView 開完整
/// detail）；「關閉」→ `onClose`。
struct TaskPopoverView: View {
    let assignment: DailyAssignmentDTO
    let onExpand: () -> Void
    let onClose: () -> Void

    @Environment(CardRepository.self) private var cardRepo
    @Environment(TagRepository.self) private var tagRepo

    @State private var card: CardDTO?

    init(
        assignment: DailyAssignmentDTO,
        onExpand: @escaping () -> Void,
        onClose: @escaping () -> Void
    ) {
        self.assignment = assignment
        self.onExpand = onExpand
        self.onClose = onClose
    }

    var body: some View {
        Group {
            if let card {
                CardDetailView(
                    card: card,
                    onUpdateTitle: { title in
                        Task {
                            do {
                                try await cardRepo.updateTitle(cardId: card.id, title: title)
                            } catch {
                                if !APIError.isCancellation(error) {
                                    print("[TaskPopoverView] save title failed: \(error)")
                                }
                            }
                        }
                    },
                    onUpdateDescription: { html in
                        Task {
                            do {
                                try await cardRepo.updateDescription(cardId: card.id, html: html)
                            } catch {
                                if !APIError.isCancellation(error) {
                                    print("[TaskPopoverView] save description failed: \(error)")
                                }
                            }
                        }
                    },
                    onUpdateTags: { newIds in
                        do {
                            try await tagRepo.setTaskTags(taskId: card.id, tagIds: Array(newIds))
                        } catch {
                            if !APIError.isCancellation(error) {
                                print("[TaskPopoverView] save tags failed: \(error)")
                            }
                        }
                    },
                    onExpand: onExpand,
                    onClose: onClose
                )
                .id(card.id)
            } else {
                ProgressView()
                    .controlSize(.small)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color.nudgeBackground)
            }
        }
        .task { await loadCard() }
    }

    private func loadCard() async {
        do {
            card = try await cardRepo.get(cardId: assignment.task.id)
        } catch {
            if !APIError.isCancellation(error) {
                print("[TaskPopoverView] loadCard failed: \(error)")
            }
        }
    }
}
#endif

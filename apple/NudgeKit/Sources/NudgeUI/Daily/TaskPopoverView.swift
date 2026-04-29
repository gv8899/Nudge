#if os(macOS)
import SwiftUI
import NudgeCore

/// Heptabase 風格的 popout 卡片編輯器 — 點任務時以 .sheet 在視窗正中
/// 央彈出。可以直接打字編標題 / 內文，不用進到完整 detail 頁。
///
/// 左上 ↗ 按鈕展開到右側完整 detail 欄；右上 ✕ 關閉（也綁 Esc）；
/// checkbox 直接打勾完成。
///
/// 自動載入 CardDTO（fetch 期間 editor 區顯示 spinner，title 先 sync
/// 自 task DTO）；title / description 編輯都是 500ms debounce 後存回
/// repo，跟 DashboardColumnCardDetail 同套儲存邏輯。
struct TaskPopoverView: View {
    let assignment: DailyAssignmentDTO
    let onToggleComplete: () -> Void
    let onExpand: () -> Void

    @Environment(CardRepository.self) private var cardRepo
    @Environment(\.locale) private var locale
    @Environment(\.dismiss) private var dismiss

    @State private var title: String
    @State private var descriptionHTML: String = ""
    @State private var isLoading: Bool = true
    @State private var titleSaveWorkItem: DispatchWorkItem?
    @State private var descSaveWorkItem: DispatchWorkItem?
    @State private var hasPendingTitleEdit: Bool = false
    @State private var hasPendingDescEdit: Bool = false
    /// loadCard 設值時 SwiftUI 會觸發 onChange → 跑 debouncedSaveTitle，
    /// 但這不是使用者編輯，不該標 pending 也不該存。設此 flag 讓 save
    /// path 短路。
    @State private var isApplyingFetched: Bool = false
    @State private var activeMarks = ActiveMarks()
    @FocusState private var titleFocused: Bool
    private let commandBus = EditorCommandBus()

    init(
        assignment: DailyAssignmentDTO,
        onToggleComplete: @escaping () -> Void,
        onExpand: @escaping () -> Void
    ) {
        self.assignment = assignment
        self.onToggleComplete = onToggleComplete
        self.onExpand = onExpand
        // Title 先用 task DTO 已知值（usually 跟 card.title 相同），
        // 避免 spinner 期間 title 區整片空白。fetch 完才 sync。
        _title = State(initialValue: assignment.task.title)
    }

    var body: some View {
        VStack(spacing: 0) {
            topBar
            Divider()
                .background(Color.nudgeBorderLight)

            TextField(
                "",
                text: $title,
                prompt: Text("cardDetail.untitled", bundle: .module)
            )
            .textFieldStyle(.plain)
            .nudgeFont(.columnDetailTitle)
            .foregroundStyle(Color.nudgeForeground)
            .padding(.horizontal, 22)
            .padding(.top, 18)
            .padding(.bottom, 10)
            .strikethrough(assignment.isCompleted)
            .focused($titleFocused)
            .onChange(of: title) { _, new in debouncedSaveTitle(new) }

            EditorToolbar(
                activeMarks: activeMarks,
                commandBus: commandBus,
                onDismissKeyboard: nil
            )

            editorBody
        }
        // 視窗正中央 modal — 比 popover anchor 到 row 自然得多，使用
        // 者不用追游標。給 frame range 而非寫死，視窗寬時用 ideal、
        // 視窗窄時自動縮（縮到 minWidth 480 為止避免內容擠爛）。
        .frame(
            minWidth: 480,
            idealWidth: 640,
            maxWidth: 720,
            minHeight: 420,
            idealHeight: 520
        )
        .background(Color.nudgeBackground)
        .task { await loadCard() }
        .task {
            // sheet present 與 focus 競爭：太早 set 會被 NSWindow 搶走，
            // 60ms 後再 focus。
            try? await Task.sleep(nanoseconds: 60_000_000)
            titleFocused = true
        }
    }

    private var topBar: some View {
        HStack(spacing: 10) {
            // ↗ 是「升級到完整 detail」action，視覺要比次要的 ✕ 強。
            // 加 capsule + primary 色，使用者一眼識別這是主要動作；
            // ✕ 維持 dim icon。
            Button(action: handleExpand) {
                HStack(spacing: 4) {
                    Image(systemName: "arrow.up.left.and.arrow.down.right")
                    Text("daily.popoverExpand", bundle: .module)
                }
                .nudgeFont(.inlineButtonLabel)
                .foregroundStyle(Color.nudgePrimaryForeground)
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(Capsule().fill(Color.nudgePrimary))
            }
            .buttonStyle(.plain)
            .help(Text("daily.popoverExpand", bundle: .module))

            Spacer()

            if assignment.isRecurring {
                HStack(spacing: 4) {
                    Image(systemName: "arrow.triangle.2.circlepath")
                    Text("daily.popoverRecurringBadge", bundle: .module)
                }
                .nudgeFont(.chipLabel)
                .foregroundStyle(Color.nudgeTextDim)
            }

            NudgeCheckbox(
                isChecked: assignment.isCompleted,
                accessibilityLabel: assignment.isCompleted ? "task.uncomplete" : "task.complete",
                action: onToggleComplete
            )

            Button(action: { dismiss() }) {
                Image(systemName: "xmark")
                    .nudgeFont(.fieldIcon)
                    .foregroundStyle(Color.nudgeTextDim)
                    .frame(width: 28, height: 28)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .keyboardShortcut(.cancelAction)
            .help(Text("common.done", bundle: .module))
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
    }

    @ViewBuilder
    private var editorBody: some View {
        if isLoading {
            VStack {
                ProgressView()
                    .controlSize(.small)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            RichTextEditor(
                html: $descriptionHTML,
                placeholder: nudgeLocalized("cardDetail.editorPlaceholder", locale: locale),
                activeMarks: $activeMarks,
                commandBus: commandBus
            )
            .id(assignment.task.id)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .onChange(of: descriptionHTML) { _, new in debouncedSaveDescription(new) }
        }
    }

    private func loadCard() async {
        do {
            let card = try await cardRepo.get(cardId: assignment.task.id)
            await MainActor.run {
                isApplyingFetched = true
                // title 已 init 過；只在 cards 與 task 不同步時更新
                if card.title != title {
                    title = card.title
                }
                descriptionHTML = card.description
                isLoading = false
                // SwiftUI onChange 是同步的，set 完當下這個 frame 已
                // 跑過了；下一 runloop tick 才能解除 flag。
                DispatchQueue.main.async {
                    isApplyingFetched = false
                }
            }
        } catch {
            if !APIError.isCancellation(error) {
                print("[TaskPopoverView] loadCard failed: \(error)")
            }
            isLoading = false
        }
    }

    private func debouncedSaveTitle(_ value: String) {
        // 來自 fetched data 同步觸發的 onChange 不算「使用者編輯」，跳
        // 過。否則開 sheet 立刻按 ↗ 會誤以為有 pending edit、白白送一
        // 次空 PUT。
        if isApplyingFetched { return }
        hasPendingTitleEdit = true
        titleSaveWorkItem?.cancel()
        let work = DispatchWorkItem {
            Task {
                do {
                    try await cardRepo.updateTitle(cardId: assignment.task.id, title: value)
                } catch {
                    if !APIError.isCancellation(error) {
                        print("[TaskPopoverView] save title failed: \(error)")
                    }
                }
            }
        }
        titleSaveWorkItem = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5, execute: work)
    }

    private func debouncedSaveDescription(_ value: String) {
        if isApplyingFetched { return }
        hasPendingDescEdit = true
        descSaveWorkItem?.cancel()
        let work = DispatchWorkItem {
            Task {
                do {
                    try await cardRepo.updateDescription(cardId: assignment.task.id, html: value)
                } catch {
                    if !APIError.isCancellation(error) {
                        print("[TaskPopoverView] save description failed: \(error)")
                    }
                }
            }
        }
        descSaveWorkItem = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5, execute: work)
    }

    /// ↗ 展開時 — 如果 < 500ms debounce 還沒 flush，先同步 await 把
    /// pending 寫入 fire 出去再 dismiss + onExpand。否則右側 detail
    /// 會 fetch 到舊資料、使用者看到「我剛打的字消失了」的錯覺。
    private func handleExpand() {
        Task { @MainActor in
            await flushPendingSaves()
            onExpand()
        }
    }

    private func flushPendingSaves() async {
        // 先取消 timer，避免之後重複觸發。
        titleSaveWorkItem?.cancel()
        descSaveWorkItem?.cancel()
        titleSaveWorkItem = nil
        descSaveWorkItem = nil

        guard hasPendingTitleEdit || hasPendingDescEdit else { return }

        do {
            if hasPendingTitleEdit {
                try await cardRepo.updateTitle(cardId: assignment.task.id, title: title)
            }
            if hasPendingDescEdit {
                try await cardRepo.updateDescription(
                    cardId: assignment.task.id,
                    html: descriptionHTML
                )
            }
        } catch {
            if !APIError.isCancellation(error) {
                print("[TaskPopoverView] flushPendingSaves failed: \(error)")
            }
        }
        hasPendingTitleEdit = false
        hasPendingDescEdit = false
    }
}
#endif

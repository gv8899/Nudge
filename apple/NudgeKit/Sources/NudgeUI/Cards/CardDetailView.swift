import SwiftUI
import NudgeCore

#if os(iOS)
import UIKit
#endif

public struct CardDetailView: View {
    public let initialCard: CardDTO
    public let onUpdateTitle: (String) -> Void
    public let onUpdateDescription: (String) -> Void
    public let onUpdateTags: (Set<String>) async -> Void
    /// macOS quick modal 用：header 右側多「展開 / 關閉」兩顆玻璃鈕。
    /// 全頁編輯時 nil（不顯示）。iOS 不使用。
    public var onExpand: (() -> Void)? = nil
    public var onClose: (() -> Void)? = nil

    @Environment(TagRepository.self) private var tagRepo
    @Environment(CardRepository.self) private var cardRepo
    @Environment(\.locale) private var locale
    @State private var title: String
    @State private var descriptionHTML: String
    @State private var tags: [TagDTO]
    @State private var absoluteRemindAt: String?
    @State private var titleSaveWorkItem: DispatchWorkItem?
    @State private var descriptionSaveWorkItem: DispatchWorkItem?
    // Dirty 追蹤：編輯器載入內容走 setContent(emitUpdate:false)，binding 只在
    // 「使用者真的改字」時才變 → onChange 只在真編輯時觸發。用 sticky 旗標當
    // dirty 訊號，沒改過的欄位一律不存（避免「停在舊內容的裝置一離開就覆蓋
    // 別台新編輯」這條跨裝置資料覆蓋 bug）。
    @State private var hasEditedTitle = false
    @State private var hasEditedDescription = false
    // 樂觀並行：跨裝置衝突（409）時，server 最新內容會透過 conflictResolved
    // 廣播進來 → 套用最新 + 把 reloadToken++ 強制 RichTextEditor 重 mount 載入
    // 新內文（編輯器 ready 後自己擁有內容，只能靠換 .id 重載）。
    // suppressEditDetection 在套用遠端內容期間擋掉 onChange 的「使用者編輯」誤判。
    @State private var reloadToken = 0
    @State private var suppressEditDetection = false
    @State private var showTagPicker = false
    @State private var showRenameAlert = false
    @State private var showScheduleSheet = false
    @State private var pendingTitle = ""
    @State private var activeMarks = ActiveMarks()
    private let commandBus = EditorCommandBus()

    public init(
        card: CardDTO,
        onUpdateTitle: @escaping (String) -> Void,
        onUpdateDescription: @escaping (String) -> Void,
        onUpdateTags: @escaping (Set<String>) async -> Void,
        onExpand: (() -> Void)? = nil,
        onClose: (() -> Void)? = nil
    ) {
        self.initialCard = card
        self.onUpdateTitle = onUpdateTitle
        self.onUpdateDescription = onUpdateDescription
        self.onUpdateTags = onUpdateTags
        self.onExpand = onExpand
        self.onClose = onClose
        _title = State(initialValue: card.title)
        _descriptionHTML = State(initialValue: card.description)
        _tags = State(initialValue: card.tags)
        _absoluteRemindAt = State(initialValue: card.remindAt)
    }

    public var body: some View {
        VStack(spacing: 0) {
            #if os(macOS)
            // macOS：標題 + rename/schedule/tags（+ modal 的展開/關閉）玻璃
            // 按鈕改在內容頂端 macHeader（對齊 web modal）；不再用 navbar
            // title + ... menu。
            macHeader
            #endif
            // mac: EditorToolbar 拿掉 — 改用 TipTap slash command menu
            // (`/` 觸發)，跟 web 一致。iOS 仍走 EditorAccessoryView
            // (鍵盤上方 input accessory)，那是另一個元件、不在這裡。
            scrollContent
        }
        .background(Color.nudgeBackground)
        #if os(iOS)
        // Title now lives in the navigation bar (matching CalendarHostView's
        // pattern — static inline text, not an editable TextField). Editing
        // goes through the "..." menu → rename alert, avoiding the iOS
        // UITextInput session lockup caused by a TextField inside
        // ToolbarItem(.principal).
        .navigationTitle(title.isEmpty ? untitledLabel : title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                moreMenu
            }
        }
        .alert(Text("cardDetail.renameTitle", bundle: .module), isPresented: $showRenameAlert) {
            TextField("", text: $pendingTitle)
            Button(action: commitRename) {
                Text("common.save", bundle: .module)
            }
            Button(role: .cancel) {
                pendingTitle = title
            } label: {
                Text("common.cancel", bundle: .module)
            }
        }
        #else
        // macOS — 標題原地編輯在 macHeader。tags / 重複入口在全頁時放
        // window toolbar（返回那排）；按鈕 post notification、這裡接到開 sheet。
        .onReceive(NotificationCenter.default.publisher(for: NudgeCommands.cardsManageTagsNotification)) { _ in
            showTagPicker = true
        }
        .onReceive(NotificationCenter.default.publisher(for: NudgeCommands.cardsScheduleNotification)) { _ in
            showScheduleSheet = true
        }
        #endif
        .onAppear {
            pendingTitle = title
            // seed 樂觀並行基準：目前畫面內容所基於的版本 = 這張卡的 updatedAt。
            CardVersionStore.seed(cardId: initialCard.id, updatedAt: initialCard.updatedAt)
            // macOS 刻意不自動 focus 標題 —— 避免 sheet 開啟時系統把標題
            // 全選（使用者要「不全選」）。需要編輯時點一下標題即可。
            #if os(iOS)
            if initialCard.title.isEmpty {
                DispatchQueue.main.async { showRenameAlert = true }
            }
            #endif
        }
        // 跨裝置衝突解決：別台先存、這台被 server 擋（409）→ 靜默改用 server 最新。
        .onReceive(NotificationCenter.default.publisher(for: CardVersionStore.conflictResolved)) { note in
            guard note.object as? String == initialCard.id, let info = note.userInfo else { return }
            // 取消還在排隊的本機存檔，別用舊內容回頭覆蓋剛採用的 server 最新。
            titleSaveWorkItem?.cancel(); titleSaveWorkItem = nil
            descriptionSaveWorkItem?.cancel(); descriptionSaveWorkItem = nil
            suppressEditDetection = true
            if let t = info[CardVersionStore.conflictTitleKey] as? String { title = t }
            if let d = info[CardVersionStore.conflictDescriptionKey] as? String { descriptionHTML = d }
            hasEditedTitle = false
            hasEditedDescription = false
            reloadToken += 1
            // onChange 在這輪 state 變更後同步觸發、會看到 suppress=true 而跳過；
            // 下一個 runloop 再解除，之後使用者真打字才重新被視為編輯。
            DispatchQueue.main.async { suppressEditDetection = false }
        }
        .onDisappear {
            // 離開（回上一頁 / 關 modal / 切換卡片）前 flush pending 存檔。
            // 只 flush「真的改過」的欄位 —— 沒編輯過就別送，免得覆蓋別台新編輯。
            titleSaveWorkItem?.cancel()
            titleSaveWorkItem = nil
            descriptionSaveWorkItem?.cancel()
            descriptionSaveWorkItem = nil
            if hasEditedTitle { onUpdateTitle(title) }
            if hasEditedDescription {
                onUpdateDescription(descriptionHTML) // 同步 fallback
                // 內文：向編輯器取「權威當前內容」覆蓋存 —— binding 可能還沒收到
                // 跨程序的最後一次 change（刪光內文後立刻返回），getHTML 直接問
                // WebContent 取最新，避免存到舊值。
                commandBus.flush { html in
                    onUpdateDescription(html)
                }
            }
        }
        #if os(macOS)
        // 切走分頁（host 隱藏不移除、onDisappear 不觸發）時也 flush 存檔。
        .onReceive(NotificationCenter.default.publisher(for: NudgeCommands.flushEditorsNotification)) { _ in
            titleSaveWorkItem?.cancel(); titleSaveWorkItem = nil
            descriptionSaveWorkItem?.cancel(); descriptionSaveWorkItem = nil
            if hasEditedTitle { onUpdateTitle(title) }
            if hasEditedDescription {
                onUpdateDescription(descriptionHTML)
                commandBus.flush { html in onUpdateDescription(html) }
            }
        }
        #endif
        .sheet(isPresented: $showTagPicker) {
            TagPickerSheet(
                initiallySelectedIds: Set(tags.map(\.id)),
                onCommit: { newIds in
                    showTagPicker = false
                    Task { await applyTagChanges(newIds: newIds) }
                },
                onCancel: { showTagPicker = false }
            )
            #if os(iOS)
            // iOS 26 bottom-sheet defaults: medium detent so the editor
            // stays partly visible, drag indicator so the gesture
            // affordance reads at a glance. presentationBackground
            // replaces the system material so the sheet picks up our
            // dark token instead of layering over it.
            .presentationDetents([.medium, .large])
            .presentationDragIndicator(.visible)
            .presentationBackground(Color.nudgeBackground)
            #endif
        }
        .sheet(isPresented: $showScheduleSheet) {
            ScheduleEditSheet(
                taskId: initialCard.id,
                taskTitle: title,
                initialAbsoluteRemindAt: $absoluteRemindAt,
                onChangeAbsoluteRemindAt: { newValue in
                    Task {
                        do {
                            try await cardRepo.updateRemindAt(cardId: initialCard.id, remindAt: newValue)
                        } catch {
                            print("[CardDetail] updateRemindAt failed: \(error)")
                        }
                    }
                },
                onDone: { showScheduleSheet = false }
            )
            #if os(iOS)
            .presentationDetents([.medium, .large])
            .presentationDragIndicator(.visible)
            .presentationBackground(Color.nudgeBackground)
            #endif
        }
    }

    @ViewBuilder
    private var scrollContent: some View {
        // RichTextEditor owns its own scrolling (WKWebView internal scroll).
        // Do NOT wrap the editor in a SwiftUI ScrollView — nesting breaks
        // contenteditable focus on iOS.
        //
        // Recurrence + reminder live behind the "..." menu (ScheduleEditSheet),
        // not inline above the editor — keeps the writing surface unobstructed.
        RichTextEditor(
            html: $descriptionHTML,
            placeholder: nudgeLocalized("cardDetail.editorPlaceholder", locale: locale),
            activeMarks: $activeMarks,
            commandBus: commandBus,
            onBlurSave: { html in
                // 失焦即存（切到別張卡片 / 別分頁 / 視窗外都會先失焦）。
                // 取消還在排隊的 debounce，直接存權威內容。沒改過就別存。
                descriptionSaveWorkItem?.cancel(); descriptionSaveWorkItem = nil
                if hasEditedDescription { onUpdateDescription(html) }
            }
        )
        .id("\(initialCard.id)-\(reloadToken)")
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .onChange(of: descriptionHTML) { _, newValue in
            if suppressEditDetection { return }
            hasEditedDescription = true
            debouncedSaveDescription(newValue)
        }
    }

    private var untitledLabel: String {
        nudgeLocalized("cardDetail.untitled", locale: locale)
    }

    #if os(iOS)
    @ViewBuilder
    private var moreMenu: some View {
        Menu {
            Button {
                pendingTitle = title
                showRenameAlert = true
            } label: {
                Label {
                    Text("cardDetail.renameTitle", bundle: .module)
                } icon: {
                    Image(systemName: "pencil")
                }
            }
            Button {
                showScheduleSheet = true
            } label: {
                Label {
                    Text("cardDetail.schedule", bundle: .module)
                } icon: {
                    Image(systemName: "calendar.badge.clock")
                }
            }
            Button {
                showTagPicker = true
            } label: {
                Label {
                    Text("cardDetail.manageTags", bundle: .module)
                } icon: {
                    Image(systemName: "tag")
                }
            }
        } label: {
            Image(systemName: "ellipsis")
                .font(.system(size: 17, weight: .medium))
                .foregroundStyle(Color.nudgeForeground)
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
        }
        .accessibilityLabel(Text("cardDetail.moreActions", bundle: .module))
        .help(Text("cardDetail.moreActions", bundle: .module))
    }
    #endif

    #if os(macOS)
    @FocusState private var titleFocused: Bool

    /// 內容頂端 header（對齊 web modal）：大標題「原地可編輯」+ modal 的
    /// 展開/關閉玻璃鈕。tags / 重複入口在全頁時改放 window toolbar（返回那排）。
    @ViewBuilder
    private var macHeader: some View {
        HStack(spacing: 8) {
            TextField(
                "",
                text: $title,
                prompt: Text("cardDetail.untitled", bundle: .module)
            )
            .textFieldStyle(.plain)
            .font(.system(size: 26, weight: .bold))
            .foregroundStyle(Color.nudgeForeground)
            .tint(Color.nudgePrimary) // caret / 選取吃主色
            .focused($titleFocused)
            .lineLimit(1)
            .onChange(of: title) { _, v in
                if suppressEditDetection { return }
                hasEditedTitle = true
                debouncedSaveTitle(v)
            }
            .onSubmit { titleFocused = false }

            Spacer(minLength: 12)

            if let onExpand {
                glassAction("arrow.up.left.and.arrow.down.right", "daily.popoverExpand", action: onExpand)
            }
            if let onClose {
                glassAction("xmark", "common.done", action: onClose)
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 14)
        .padding(.bottom, 16) // 標題與內文間距
    }

    /// macOS 26 玻璃圓鈕；低於 26（deployment 15）fallback 用 material + shadow。
    @ViewBuilder
    private func glassAction(
        _ systemName: String,
        _ labelKey: LocalizedStringKey,
        action: @escaping () -> Void
    ) -> some View {
        let core = Button(action: action) {
            Image(systemName: systemName)
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(Color.nudgeForeground)
                .frame(width: 34, height: 34)
                .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .help(Text(labelKey, bundle: .module))
        .accessibilityLabel(Text(labelKey, bundle: .module))

        if #available(macOS 26.0, *) {
            core.glassEffect(.regular, in: .circle)
        } else {
            core.background(
                Circle()
                    .fill(.regularMaterial)
                    .shadow(color: Color.nudgeForeground.opacity(0.12), radius: 5, x: 0, y: 2)
            )
        }
    }
    #endif

    private func commitRename() {
        let trimmed = pendingTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, trimmed != title else { return }
        title = trimmed
        hasEditedTitle = true
        debouncedSaveTitle(trimmed)
    }

    private func debouncedSaveTitle(_ newValue: String) {
        titleSaveWorkItem?.cancel()
        let work = DispatchWorkItem { onUpdateTitle(newValue) }
        titleSaveWorkItem = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5, execute: work)
    }

    private func debouncedSaveDescription(_ newValue: String) {
        descriptionSaveWorkItem?.cancel()
        let work = DispatchWorkItem { onUpdateDescription(newValue) }
        descriptionSaveWorkItem = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5, execute: work)
    }

    private func applyTagChanges(newIds: Set<String>) async {
        await onUpdateTags(newIds)
        // Refresh local chip list from authoritative source (the repo cache
        // was invalidated by the create/PUT, so a fresh fetch resolves names).
        do {
            let all = try await tagRepo.list()
            tags = all.filter { newIds.contains($0.id) }
        } catch {
            if APIError.isCancellation(error) { return }
            print("[CardDetail] tag refresh failed: \(error)")
        }
    }

    private func removeTag(_ id: String) async {
        let next = Set(tags.map(\.id)).subtracting([id])
        await applyTagChanges(newIds: next)
    }
}

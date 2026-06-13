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
            // macOS 刻意不自動 focus 標題 —— 避免 sheet 開啟時系統把標題
            // 全選（使用者要「不全選」）。需要編輯時點一下標題即可。
            #if os(iOS)
            if initialCard.title.isEmpty {
                DispatchQueue.main.async { showRenameAlert = true }
            }
            #endif
        }
        .onDisappear {
            // 離開（回上一頁 / 關 modal / 切換卡片）前 flush pending 存檔。
            titleSaveWorkItem?.cancel()
            titleSaveWorkItem = nil
            descriptionSaveWorkItem?.cancel()
            descriptionSaveWorkItem = nil
            onUpdateTitle(title)
            // 內文：向編輯器取「權威當前內容」存檔 —— binding 可能還沒收到
            // 跨程序的最後一次 change（刪光內文後立刻返回），getHTML 直接問
            // WebContent 取最新，避免存到舊值。
            commandBus.flush { html in
                onUpdateDescription(html)
            }
        }
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
            commandBus: commandBus
        )
        .id(initialCard.id)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .onChange(of: descriptionHTML) { _, newValue in
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
            .onChange(of: title) { _, v in debouncedSaveTitle(v) }
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

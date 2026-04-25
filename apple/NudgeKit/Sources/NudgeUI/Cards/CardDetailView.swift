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
        onUpdateTags: @escaping (Set<String>) async -> Void
    ) {
        self.initialCard = card
        self.onUpdateTitle = onUpdateTitle
        self.onUpdateDescription = onUpdateDescription
        self.onUpdateTags = onUpdateTags
        _title = State(initialValue: card.title)
        _descriptionHTML = State(initialValue: card.description)
        _tags = State(initialValue: card.tags)
        _absoluteRemindAt = State(initialValue: card.remindAt)
    }

    public var body: some View {
        VStack(spacing: 0) {
            #if os(macOS)
            EditorToolbar(
                activeMarks: activeMarks,
                commandBus: commandBus,
                onDismissKeyboard: nil
            )
            #endif
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
        #endif
        .onAppear {
            pendingTitle = title
            if initialCard.title.isEmpty {
                // Empty card → open rename alert so user can fill in the
                // title. Dispatched async so it doesn't fight the
                // navigation transition.
                DispatchQueue.main.async { showRenameAlert = true }
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
            // affordance reads at a glance.
            .presentationDetents([.medium, .large])
            .presentationDragIndicator(.visible)
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

    #if os(iOS)
    private var untitledLabel: String {
        nudgeLocalized("cardDetail.untitled", locale: locale)
    }

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
    }

    private func commitRename() {
        let trimmed = pendingTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, trimmed != title else { return }
        title = trimmed
        debouncedSaveTitle(trimmed)
    }
    #endif

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

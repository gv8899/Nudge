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
    @State private var title: String
    @State private var descriptionHTML: String
    @State private var tags: [TagDTO]
    @State private var titleSaveWorkItem: DispatchWorkItem?
    @State private var descriptionSaveWorkItem: DispatchWorkItem?
    @State private var showTagPicker = false
    @State private var activeMarks = ActiveMarks()
    private let commandBus = EditorCommandBus()
    @FocusState private var titleFocused: Bool

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
        .navigationBarTitleDisplayMode(.inline)
        // No .safeAreaInset EditorToolbar — on iOS the toolbar is installed
        // as the WKWebView's inputAccessoryView (see EditorAccessoryView.swift).
        // That makes taps on toolbar buttons NOT resign the keyboard first
        // responder, so format commands actually apply while the caret is
        // preserved.
        #endif
        .onAppear {
            if initialCard.title.isEmpty {
                titleFocused = true
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
        }
    }

    @ViewBuilder
    private var scrollContent: some View {
        // Tag row is fixed at the top; RichTextEditor owns its own scrolling
        // (WKWebView internal scroll). Do NOT wrap the editor in a SwiftUI
        // ScrollView — nesting breaks contenteditable focus on iOS.
        //
        // Title stays in the view body (NOT ToolbarItem(placement: .principal)):
        // putting an editable TextField inside a NavigationStack's toolbar
        // causes iOS to lock the UITextInput session onto it, so even when
        // the WKWebView's contenteditable shows a caret, keystrokes still
        // route to the toolbar TextField (Apple forums / SwiftUI toolbar in
        // NavigationStack is a known-broken combo).
        VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: 12) {
                TextField(text: $title) {
                    Text("cardDetail.editTitleAria", bundle: .module)
                }
                .focused($titleFocused)
                .font(.title2.weight(.semibold))
                .textFieldStyle(.plain)
                .foregroundStyle(Color.nudgeForeground)
                .onChange(of: title) { _, newValue in
                    debouncedSaveTitle(newValue)
                }

                tagRow
                Divider()
                    .background(Color.nudgeBorderLight)
            }
            .padding(.horizontal, 16)
            .padding(.top, 12)
            .padding(.bottom, 8)

            // .id(initialCard.id) — matches the web fix (<TiptapEditor
            // key={task.id}>). The editor does not sync htmlBinding →
            // content after ready; switching to a different card must
            // happen via view-identity remount.
            RichTextEditor(
                html: $descriptionHTML,
                placeholder: NSLocalizedString(
                    "cardDetail.editorPlaceholder",
                    bundle: .module,
                    comment: ""
                ),
                activeMarks: $activeMarks,
                commandBus: commandBus
            )
            .id(initialCard.id)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .onChange(of: descriptionHTML) { _, newValue in
                debouncedSaveDescription(newValue)
            }
        }
    }

    @ViewBuilder
    private var tagRow: some View {
        FlowLayout(spacing: 6, lineSpacing: 6) {
            ForEach(tags) { tag in
                HStack(spacing: 4) {
                    Text(tag.name)
                        .font(.caption2)
                        .foregroundStyle(Color.nudgeForeground)
                    Button {
                        Task { await removeTag(tag.id) }
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundStyle(Color.nudgeTextDim)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(Text("tags.removeAria \(tag.name)", bundle: .module))
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                .overlay(
                    Capsule().stroke(Color.nudgeBorderLight, lineWidth: 1)
                )
            }

            Button {
                showTagPicker = true
            } label: {
                HStack(spacing: 4) {
                    Image(systemName: "plus")
                        .font(.system(size: 10, weight: .semibold))
                    Text(tags.isEmpty ? "tags.addTag" : "tags.add", bundle: .module)
                        .font(.caption2)
                }
                .foregroundStyle(Color.nudgePrimary)
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                .overlay(
                    Capsule().stroke(Color.nudgePrimary.opacity(0.5), lineWidth: 1)
                )
            }
            .buttonStyle(.plain)
        }
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

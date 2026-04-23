import SwiftUI
import NudgeCore

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
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                tagRow

                Divider()
                    .background(Color.nudgeBorderLight)

                RichTextEditor(
                    html: $descriptionHTML,
                    placeholder: NSLocalizedString(
                        "cardDetail.editorPlaceholder",
                        bundle: .module,
                        comment: ""
                    )
                )
                .frame(maxWidth: .infinity, alignment: .leading)
                .onChange(of: descriptionHTML) { _, newValue in
                    debouncedSaveDescription(newValue)
                }
            }
            .padding(16)
        }
        .background(Color.nudgeBackground)
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                TextField(text: $title) {
                    Text("cardDetail.editTitleAria", bundle: .module)
                }
                .focused($titleFocused)
                .font(.headline)
                .multilineTextAlignment(.center)
                .textFieldStyle(.plain)
                .foregroundStyle(Color.nudgeForeground)
                .frame(maxWidth: 240)
                .onChange(of: title) { _, newValue in
                    debouncedSaveTitle(newValue)
                }
            }
        }
        #endif
        .onAppear {
            // Newly-created cards arrive with an empty title — jump into edit.
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

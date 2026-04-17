import SwiftUI
import NudgeCore

public struct CardDetailView: View {
    public let initialCard: CardDTO
    public let onUpdateTitle: (String) -> Void
    public let onUpdateDescription: (String) -> Void

    @State private var title: String
    @State private var descriptionHTML: String
    @State private var titleSaveWorkItem: DispatchWorkItem?
    @State private var descriptionSaveWorkItem: DispatchWorkItem?
    @FocusState private var titleFocused: Bool

    public init(
        card: CardDTO,
        onUpdateTitle: @escaping (String) -> Void,
        onUpdateDescription: @escaping (String) -> Void
    ) {
        self.initialCard = card
        self.onUpdateTitle = onUpdateTitle
        self.onUpdateDescription = onUpdateDescription
        _title = State(initialValue: card.title)
        _descriptionHTML = State(initialValue: card.description)
    }

    public var body: some View {
        ScrollView {
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

                if !initialCard.tags.isEmpty {
                    HStack(spacing: 6) {
                        ForEach(initialCard.tags, id: \.id) { tag in
                            TagBadgeView(tag: tag)
                        }
                    }
                    .padding(.top, 8)
                }
            }
            .padding(16)
        }
        .background(Color.nudgeBackground)
        .onAppear {
            // Newly-created cards arrive with an empty title — jump into edit.
            if initialCard.title.isEmpty {
                titleFocused = true
            }
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
}

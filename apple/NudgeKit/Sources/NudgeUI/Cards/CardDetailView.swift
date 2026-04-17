import SwiftUI
import NudgeCore

public struct CardDetailView: View {
    public let initialCard: CardDTO
    public let onUpdateTitle: (String) -> Void

    @State private var title: String
    @State private var saveWorkItem: DispatchWorkItem?
    @FocusState private var titleFocused: Bool

    public init(card: CardDTO, onUpdateTitle: @escaping (String) -> Void) {
        self.initialCard = card
        self.onUpdateTitle = onUpdateTitle
        _title = State(initialValue: card.title)
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

                Text(strippedDescription)
                    .font(.body)
                    .foregroundStyle(
                        isDescriptionEmpty
                            ? Color.nudgeTextDim
                            : Color.nudgeForeground
                    )
                    .frame(maxWidth: .infinity, alignment: .leading)

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

    private var isDescriptionEmpty: Bool {
        initialCard.description.strippedHTML().isEmpty
    }

    private var strippedDescription: String {
        let stripped = initialCard.description.strippedHTML()
        return stripped.isEmpty
            ? NSLocalizedString("cardDetail.editorPlaceholder", bundle: .module, comment: "")
            : stripped
    }

    private func debouncedSaveTitle(_ newValue: String) {
        saveWorkItem?.cancel()
        let work = DispatchWorkItem { onUpdateTitle(newValue) }
        saveWorkItem = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5, execute: work)
    }
}

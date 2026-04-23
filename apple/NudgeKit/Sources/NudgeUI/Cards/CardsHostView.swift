import SwiftUI
import NudgeCore

public struct CardsHostView: View {
    @Environment(CardRepository.self) private var cardRepo
    @Environment(TagRepository.self) private var tagRepo

    @State private var cards: [CardDTO] = []
    @State private var query: String = ""
    @State private var debouncedQuery: String = ""
    @State private var nextCursor: String?
    @State private var isLoading = false
    @State private var isLoadingMore = false
    @State private var hasError = false
    @State private var pushedCard: CardDTO?

    #if os(iOS)
    @State private var navigationPath = NavigationPath()
    #endif

    public init() {}

    public var body: some View {
        #if os(iOS)
        iOSLayout
        #else
        macOSLayout
        #endif
    }

    #if os(iOS)
    private var iOSLayout: some View {
        NavigationStack(path: $navigationPath) {
            VStack(spacing: 0) {
                inlineHeader
                searchBar
                content
            }
            .background(Color.nudgeBackground)
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: CardDTO.self) { card in
                CardDetailView(
                    card: card,
                    onUpdateTitle: { updateTitle(cardId: card.id, title: $0) },
                    onUpdateDescription: { updateDescription(cardId: card.id, html: $0) },
                    onUpdateTags: { newIds in await updateTags(cardId: card.id, tagIds: newIds) }
                )
            }
        }
        .task(id: debouncedQuery) { await firstPage() }
        .task(id: query) { await debounceQuery() }
    }

    private var inlineHeader: some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text("nav.cards", bundle: .module)
                .font(.largeTitle.weight(.bold))
                .foregroundStyle(Color.nudgeForeground)
            IconButton(
                systemName: "plus",
                accessibilityLabel: "cards.createAria",
                foreground: .nudgePrimary,
                action: createCard
            )
            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
    }
    #endif

    #if os(macOS)
    private var macOSLayout: some View {
        NavigationSplitView {
            VStack(spacing: 0) {
                searchBar
                content
            }
            .background(Color.nudgeBackground)
            .navigationTitle(Text("nav.cards", bundle: .module))
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    IconButton(
                        systemName: "plus",
                        accessibilityLabel: "cards.createAria",
                        foreground: .nudgePrimary,
                        action: createCard
                    )
                }
            }
            .frame(minWidth: 300)
        } detail: {
            if let card = pushedCard {
                CardDetailView(
                    card: card,
                    onUpdateTitle: { updateTitle(cardId: card.id, title: $0) },
                    onUpdateDescription: { updateDescription(cardId: card.id, html: $0) },
                    onUpdateTags: { newIds in await updateTags(cardId: card.id, tagIds: newIds) }
                )
            } else {
                Text(verbatim: "—")
                    .foregroundStyle(Color.nudgeTextDim)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color.nudgeBackground)
            }
        }
        .task(id: debouncedQuery) { await firstPage() }
        .task(id: query) { await debounceQuery() }
    }
    #endif

    // MARK: - Custom search bar (replaces .searchable so there's only one ✕)

    private var searchBar: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(Color.nudgeTextDim)
            TextField(text: $query) {
                Text("cards.searchPlaceholder", bundle: .module)
            }
            .textFieldStyle(.plain)
            .foregroundStyle(Color.nudgeForeground)
            .submitLabel(.search)

            if !query.isEmpty {
                Button {
                    query = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(Color.nudgeTextDim)
                        .frame(minWidth: 44, minHeight: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(Text("common.cancel", bundle: .module))
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(
            RoundedRectangle(cornerRadius: 10)
                .fill(Color.nudgeBorderLight.opacity(0.3))
        )
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
    }

    @ViewBuilder
    private var content: some View {
        if cards.isEmpty && isLoading {
            ProgressView()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if cards.isEmpty && !debouncedQuery.isEmpty {
            emptyState(key: "cards.emptyWithQuery")
        } else if cards.isEmpty && hasError {
            emptyState(key: "error.unknown")
        } else if cards.isEmpty {
            emptyState(key: "cards.emptyNoCards")
        } else {
            list
        }
    }

    private func emptyState(key: LocalizedStringKey) -> some View {
        VStack {
            Spacer()
            Text(key, bundle: .module)
                .font(.subheadline)
                .foregroundStyle(Color.nudgeTextDim)
            Spacer()
        }
        .frame(maxWidth: .infinity)
    }

    private var list: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                ForEach(cards) { card in
                    CardListItemView(card: card) {
                        openDetail(card)
                    }
                    .onAppear {
                        if card.id == cards.last?.id {
                            Task { await loadMore() }
                        }
                    }
                    Divider()
                        .background(Color.nudgeBorderLight)
                        .padding(.leading, 16)
                }
                if isLoadingMore {
                    Text("cards.loadMore", bundle: .module)
                        .font(.caption)
                        .foregroundStyle(Color.nudgeTextDim)
                        .padding(12)
                } else if nextCursor == nil && !cards.isEmpty {
                    Text("cards.noMore", bundle: .module)
                        .font(.caption)
                        .foregroundStyle(Color.nudgeTextDim)
                        .padding(12)
                }
            }
        }
    }

    private func openDetail(_ card: CardDTO) {
        #if os(iOS)
        navigationPath.append(card)
        #else
        pushedCard = card
        #endif
    }

    private func debounceQuery() async {
        try? await Task.sleep(nanoseconds: 300_000_000)
        if !Task.isCancelled {
            debouncedQuery = query
        }
    }

    private func firstPage() async {
        isLoading = true
        hasError = false
        do {
            let result = try await cardRepo.list(query: debouncedQuery, cursor: nil)
            cards = result.cards
            nextCursor = result.nextCursor
        } catch {
            print("[CardsHostView] firstPage failed: \(error)")
            cards = []
            hasError = true
        }
        isLoading = false
    }

    private func loadMore() async {
        guard !isLoadingMore, let cursor = nextCursor else { return }
        isLoadingMore = true
        do {
            let result = try await cardRepo.list(query: debouncedQuery, cursor: cursor)
            cards.append(contentsOf: result.cards)
            nextCursor = result.nextCursor
        } catch {
            print("[CardsHostView] loadMore failed: \(error)")
        }
        isLoadingMore = false
    }

    private func createCard() {
        Task {
            do {
                let card = try await cardRepo.create()
                cards.insert(card, at: 0)
                openDetail(card)
            } catch {
                print("[CardsHostView] create failed: \(error)")
            }
        }
    }

    private func updateTitle(cardId: String, title: String) {
        if let idx = cards.firstIndex(where: { $0.id == cardId }) {
            let c = cards[idx]
            cards[idx] = CardDTO(
                id: c.id,
                title: title,
                description: c.description,
                updatedAt: c.updatedAt,
                tags: c.tags
            )
        }

        Task {
            do {
                try await cardRepo.updateTitle(cardId: cardId, title: title)
            } catch {
                print("[CardsHostView] updateTitle failed: \(error)")
            }
        }
    }

    private func updateTags(cardId: String, tagIds: Set<String>) async {
        do {
            try await tagRepo.setTaskTags(taskId: cardId, tagIds: Array(tagIds))
            // Refresh in-memory list so chips show in row + detail next time.
            let allTags = try await tagRepo.list()
            let nextTags = allTags.filter { tagIds.contains($0.id) }
            if let idx = cards.firstIndex(where: { $0.id == cardId }) {
                let c = cards[idx]
                cards[idx] = CardDTO(
                    id: c.id,
                    title: c.title,
                    description: c.description,
                    updatedAt: c.updatedAt,
                    tags: nextTags
                )
            }
        } catch {
            print("[CardsHostView] updateTags failed: \(error)")
        }
    }

    private func updateDescription(cardId: String, html: String) {
        if let idx = cards.firstIndex(where: { $0.id == cardId }) {
            let c = cards[idx]
            cards[idx] = CardDTO(
                id: c.id,
                title: c.title,
                description: html,
                updatedAt: c.updatedAt,
                tags: c.tags
            )
        }

        Task {
            do {
                try await cardRepo.updateDescription(cardId: cardId, html: html)
            } catch {
                print("[CardsHostView] updateDescription failed: \(error)")
            }
        }
    }
}

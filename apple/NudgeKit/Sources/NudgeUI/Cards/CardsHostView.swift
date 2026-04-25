import SwiftUI
import NudgeCore

public struct CardsHostView: View {
    @Environment(CardRepository.self) private var cardRepo
    @Environment(TagRepository.self) private var tagRepo

    @State private var cards: [CardDTO] = []
    @State private var nextCursor: String?
    @State private var isLoading = false
    @State private var isLoadingMore = false
    @State private var hasError = false
    @State private var pushedCard: CardDTO?

    // Search + tag filtering now lives in the dedicated
    // `Tab(role: .search)` surface (CardSearchView). This host view is
    // an unfiltered list of all cards.

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
            ZStack(alignment: .bottomTrailing) {
                content
                    .background(Color.nudgeBackground)

                createFAB
                    .padding(.trailing, 20)
                    .padding(.bottom, 20)
            }
            // Search and tag filtering moved to the dedicated
            // `Tab(role: .search)` surface (CardSearchView) — this host
            // view just lists all cards. `+` stays as the floating FAB.
            .navigationTitle(Text("nav.cards", bundle: .module))
            .navigationBarTitleDisplayMode(.inline)
            .navigationDestination(for: CardDTO.self) { card in
                CardDetailView(
                    card: card,
                    onUpdateTitle: { updateTitle(cardId: card.id, title: $0) },
                    onUpdateDescription: { updateDescription(cardId: card.id, html: $0) },
                    onUpdateTags: { newIds in await updateTags(cardId: card.id, tagIds: newIds) }
                )
            }
        }
        .task { await firstPage() }
    }

    /// iOS 26 glass FAB for creating a new card. `.glass` (neutral,
    /// untinted) matches the system toolbar and tab-bar glass pills;
    /// same contract as the Daily FAB so the two primary actions feel
    /// like one pattern rather than two bespoke buttons.
    private var createFAB: some View {
        Button(action: createCard) {
            Image(systemName: "plus")
                .font(.title2.weight(.semibold))
                .frame(width: 28, height: 28)
        }
        // Match the Daily FAB exactly — glassEffect with the same
        // material the system search pill uses, so all primary
        // affordances read as one family.
        .buttonStyle(.plain)
        .frame(width: 56, height: 56)
        .glassEffect(.regular, in: .circle)
        .tint(.primary)
        .accessibilityLabel(Text("cards.createAria", bundle: .module))
    }
    #endif

    #if os(macOS)
    private var macOSLayout: some View {
        NavigationSplitView {
            content
                .background(Color.nudgeBackground)
                .navigationTitle(Text("nav.cards", bundle: .module))
                .toolbar {
                    ToolbarItem(placement: .primaryAction) {
                        IconButton(
                            systemName: "plus",
                            accessibilityLabel: "cards.createAria",
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
        .task { await firstPage() }
    }
    #endif

    @ViewBuilder
    private var content: some View {
        if cards.isEmpty && isLoading {
            ProgressView()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
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
        // Switched from flat Divider list to elevated cards. The flat
        // list with 1pt borderLight separators read as one continuous
        // wall of text in dark mode; per-card RoundedRect bg gives the
        // eye an anchor for each card without adding heavy chrome.
        // Same elevated-surface pattern as CalendarDayView event cards.
        ScrollView {
            LazyVStack(spacing: 8) {
                ForEach(cards) { card in
                    CardListItemView(card: card) {
                        openDetail(card)
                    }
                    .background(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .fill(Color.nudgeForeground.opacity(0.04))
                    )
                    .onAppear {
                        if card.id == cards.last?.id {
                            Task { await loadMore() }
                        }
                    }
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
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
        }
    }

    private func openDetail(_ card: CardDTO) {
        #if os(iOS)
        navigationPath.append(card)
        #else
        pushedCard = card
        #endif
    }

    private func firstPage() async {
        isLoading = true
        hasError = false
        do {
            let result = try await cardRepo.list(query: "", cursor: nil)
            cards = result.cards
            nextCursor = result.nextCursor
        } catch {
            if APIError.isCancellation(error) {
                isLoading = false
                return
            }
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
            let result = try await cardRepo.list(query: "", cursor: cursor)
            cards.append(contentsOf: result.cards)
            nextCursor = result.nextCursor
        } catch {
            if !APIError.isCancellation(error) {
                print("[CardsHostView] loadMore failed: \(error)")
            }
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

// `TagFilterChip` / `PressableChipStyle` live in
// `Tags/TagFilterChip.swift`; the dedicated Search tab (CardSearchView)
// is the only consumer now that this host view no longer filters
// inline. Retained in the shared component file for future reuse.

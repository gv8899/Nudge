import SwiftUI
import NudgeCore

/// Dedicated search surface backing `Tab(role: .search)` in the root tab
/// bar. iOS 26 renders that tab as the separated glass pill next to the
/// main tabs; tapping promotes this view with the search field anchored
/// to the bottom of the screen (same pattern as Apple's Store app).
///
/// Scope decision: cards-only for now (matches user's direction
/// `A:(c)`). Text query AND tag selection are both legitimate
/// filters — the tag chip row below the search field lets the user
/// narrow results without typing.
public struct CardSearchView: View {
    @Environment(CardRepository.self) private var cardRepo
    @Environment(TagRepository.self) private var tagRepo

    @State private var query: String = ""
    @State private var debouncedQuery: String = ""
    @State private var selectedTagIds: Set<String> = []
    @State private var allTags: [TagDTO] = []
    @State private var results: [CardDTO] = []
    @State private var isFetching = false
    @State private var hasSearched = false
    @State private var path = NavigationPath()

    public init() {}

    public var body: some View {
        NavigationStack(path: $path) {
            // InnerContent reads `@Environment(\.isSearching)` so it can
            // hide the bottom chip panel while the keyboard is up —
            // otherwise iOS 26 overlays its search field on top of the
            // chips when focused, which is what looked like "被擋住"
            // in the user's screenshot.
            InnerContent(
                allTags: allTags,
                selectedTagIds: $selectedTagIds,
                debouncedQuery: debouncedQuery,
                results: results,
                isLoading: isFetching,
                hasSearched: hasSearched,
                onOpen: { path.append($0) }
            )
            .background(Color.nudgeBackground)
            .navigationTitle(Text("common.search", bundle: .module))
            .navigationBarTitleDisplayMode(.inline)
            .searchable(
                text: $query,
                placement: .automatic,
                prompt: Text("cards.searchPlaceholder", bundle: .module)
            )
            .navigationDestination(for: CardDTO.self) { card in
                CardDetailView(
                    card: card,
                    onUpdateTitle: { saveTitle(cardId: card.id, title: $0) },
                    onUpdateDescription: { saveDescription(cardId: card.id, html: $0) },
                    onUpdateTags: { newIds in await saveTags(cardId: card.id, tagIds: newIds) }
                )
            }
        }
        .task { await loadAllTags() }
        .task(id: query) { await debounce() }
        .task(id: filterRefreshKey) { await fetch() }
    }

    // MARK: - Fetch wiring

    /// Refresh trigger keyed on debounced query AND selected tags, so a
    /// chip tap re-fetches even while the query is unchanged.
    private var filterRefreshKey: String {
        let tags = selectedTagIds.sorted().joined(separator: ",")
        return "\(debouncedQuery)|\(tags)"
    }

    private func debounce() async {
        try? await Task.sleep(nanoseconds: 300_000_000)
        if !Task.isCancelled {
            debouncedQuery = query.trimmingCharacters(in: .whitespaces)
        }
    }

    private func fetch() async {
        let q = debouncedQuery
        let tagIds = Array(selectedTagIds)
        guard !q.isEmpty || !tagIds.isEmpty else {
            results = []
            hasSearched = false
            return
        }
        isFetching = true
        do {
            let page = try await cardRepo.list(query: q, cursor: nil, tagIds: tagIds)
            results = page.cards
            hasSearched = true
        } catch {
            if APIError.isCancellation(error) { return }
            print("[CardSearchView] search failed: \(error)")
            results = []
            hasSearched = true
        }
        isFetching = false
    }

    private func loadAllTags() async {
        do {
            allTags = try await tagRepo.list()
        } catch {
            if APIError.isCancellation(error) { return }
            print("[CardSearchView] loadAllTags failed: \(error)")
        }
    }

    // MARK: - Detail-save callbacks
    //
    // Fire-and-forget against the repo. Results only refresh when the
    // user next changes the query or tag selection, which is fine: the
    // search tab isn't a long-lived edit surface like CardsHostView.

    private func saveTitle(cardId: String, title: String) {
        Task {
            do {
                try await cardRepo.updateTitle(cardId: cardId, title: title)
            } catch {
                print("[CardSearchView] updateTitle failed: \(error)")
            }
        }
    }

    private func saveDescription(cardId: String, html: String) {
        Task {
            do {
                try await cardRepo.updateDescription(cardId: cardId, html: html)
            } catch {
                print("[CardSearchView] updateDescription failed: \(error)")
            }
        }
    }

    private func saveTags(cardId: String, tagIds: Set<String>) async {
        do {
            try await tagRepo.setTaskTags(taskId: cardId, tagIds: Array(tagIds))
        } catch {
            print("[CardSearchView] updateTags failed: \(error)")
        }
    }
}

// MARK: - InnerContent
//
// Split out because `@Environment(\.isSearching)` has to be read inside
// a view that's a child of `.searchable`. CardSearchView applies
// `.searchable` on this view, so this struct's body sees the correct
// `isSearching` value.

private struct InnerContent: View {
    let allTags: [TagDTO]
    @Binding var selectedTagIds: Set<String>
    let debouncedQuery: String
    let results: [CardDTO]
    let isLoading: Bool
    let hasSearched: Bool
    let onOpen: (CardDTO) -> Void

    var body: some View {
        mainContent
            // `safeAreaInset` keeps the chip panel above whatever the
            // system places at the bottom edge — tab bar when idle,
            // search field when the user is searching, keyboard when
            // typing. iOS animates the chips up in lock-step, which is
            // what the user asked for ("點搜尋是往上推才對"). We
            // deliberately don't gate on `@Environment(\.isSearching)`;
            // hiding the chips on focus was what made them look like
            // they were vanishing instead of rising.
            .safeAreaInset(edge: .bottom, spacing: 0) {
                if !allTags.isEmpty {
                    bottomChipPanel
                }
            }
    }

    @ViewBuilder
    private var mainContent: some View {
        if debouncedQuery.isEmpty && selectedTagIds.isEmpty {
            emptyPrompt
        } else if isLoading && results.isEmpty {
            ProgressView()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if hasSearched && results.isEmpty {
            emptyResults
        } else {
            resultsList
        }
    }

    @ViewBuilder
    private var emptyPrompt: some View {
        VStack(spacing: 10) {
            Spacer()
            Image(systemName: "magnifyingglass")
                .font(.system(size: 32))
                .foregroundStyle(Color.nudgeTextDim)
            Text("cards.searchPlaceholder", bundle: .module)
                .font(.subheadline)
                .foregroundStyle(Color.nudgeTextDim)
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    @ViewBuilder
    private var emptyResults: some View {
        VStack {
            Spacer()
            Text("cards.emptyWithQuery", bundle: .module)
                .font(.subheadline)
                .foregroundStyle(Color.nudgeTextDim)
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    @ViewBuilder
    private var resultsList: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                ForEach(results) { card in
                    CardListItemView(card: card, onTap: { onOpen(card) })
                    Divider()
                        .background(Color.nudgeBorderLight)
                        .padding(.leading, 16)
                }
            }
        }
    }

    // MARK: - Bottom chip panel
    //
    // FlowLayout-wrapped chips inside a vertical ScrollView capped at
    // two rows. `.ultraThinMaterial` matches the iOS 26 glass idiom;
    // the extra 16pt bottom padding keeps chips clear of the system
    // search field's top edge (the cramped look the user flagged).

    @ViewBuilder
    private var bottomChipPanel: some View {
        let twoRowsHeight: CGFloat = 82
        VStack(spacing: 0) {
            ScrollView(.vertical, showsIndicators: false) {
                FlowLayout(spacing: 8, lineSpacing: 10) {
                    ForEach(allTags) { tag in
                        TagFilterChip(
                            name: tag.name,
                            active: selectedTagIds.contains(tag.id)
                        ) {
                            withAnimation(.easeOut(duration: 0.15)) {
                                if selectedTagIds.contains(tag.id) {
                                    selectedTagIds.remove(tag.id)
                                } else {
                                    selectedTagIds.insert(tag.id)
                                }
                            }
                        }
                    }
                    if !selectedTagIds.isEmpty {
                        Button {
                            withAnimation(.easeOut(duration: 0.2)) {
                                selectedTagIds.removeAll()
                            }
                        } label: {
                            HStack(spacing: 4) {
                                Image(systemName: "xmark")
                                    .font(.footnote.weight(.semibold))
                                Text("common.clear", bundle: .module)
                                    .font(.footnote.weight(.medium))
                            }
                            .foregroundStyle(Color.nudgePrimary)
                            .padding(.horizontal, 10)
                            .frame(minHeight: 36)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(Text("common.clear", bundle: .module))
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 10)
                .padding(.bottom, 16)
            }
            .frame(maxHeight: twoRowsHeight + 26)
        }
        .background(.ultraThinMaterial)
    }
}

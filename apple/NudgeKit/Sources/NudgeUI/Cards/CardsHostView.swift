import SwiftUI
import NudgeCore

public struct CardsHostView: View {
    @Environment(CardRepository.self) private var cardRepo
    @Environment(TagRepository.self) private var tagRepo
    #if os(iOS)
    @Environment(NotificationRouter.self) private var notificationRouter
    #endif

    /// 當 host 被當作右側面板嵌入到 DailyHostView 時設 true。為 true 時
    /// 不掛 .toolbar / .navigationTitle — 否則它們會 bubble up 到外層
    /// NavigationStack 的 window toolbar、跟 DailyHostView 自己的 toolbar
    /// item 擠在一起。
    private let embedded: Bool
    /// macOS：fullPageCard 變動時回報給 MacSidebarRoot，讓 root toolbar 的
    /// 「+」在全頁時換成返回鈕。
    private let onFullPageChange: ((Bool) -> Void)?

    @State private var cards: [CardDTO] = []
    @State private var nextCursor: String?
    @State private var isLoading = false
    @State private var isLoadingMore = false
    @State private var hasError = false
    // Search + tag filtering now lives in the dedicated
    // `Tab(role: .search)` surface (CardSearchView). This host view is
    // an unfiltered list of all cards.

    // iOS push-detail；macOS 改用 selectedCard 切換 centered list ↔ split
    // detail，不需要 NavigationStack push。
    #if os(iOS)
    @State private var navigationPath = NavigationPath()
    #endif
    #if os(macOS)
    /// 點卡片 → quickCard 彈出 sheet（快速檢視/編輯，對齊 web 的 Modal）。
    /// sheet 按「展開」→ fullPageCard 設值、卡片詳情佔滿內容區全寬
    /// （對齊 web：Modal → 展開整頁；Escape 回列表）。
    @State private var quickCard: CardDTO?
    @State private var fullPageCard: CardDTO?
    #endif

    public init(embedded: Bool = false, onFullPageChange: ((Bool) -> Void)? = nil) {
        self.embedded = embedded
        self.onFullPageChange = onFullPageChange
    }

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
        // Widget deep link: PlatformRootView switches the tab on
        // `pendingNewCard`, but TabView lazily mounts CardsHostView the
        // FIRST time the tab is selected — by then `pendingNewCard` is
        // already `true`, so a plain `.onChange` would never see a
        // transition. `initial: true` re-fires with the current value at
        // mount, catching the widget-tap scenario.
        .onChange(of: notificationRouter.pendingNewCard, initial: true) { _, isPending in
            guard isPending else { return }
            createCard()
            notificationRouter.clear()
        }
    }

    /// iOS 26 glass FAB for creating a new card. `.glass` (neutral,
    /// untinted) matches the system toolbar and tab-bar glass pills;
    /// same contract as the Daily FAB so the two primary actions feel
    /// like one pattern rather than two bespoke buttons.
    private var createFAB: some View {
        Button(action: createCard) {
            // 同 Daily FAB — frame + contentShape 必須在 label 內，整個
            // 60×60 圓形範圍才是 button 的 hit area。原本 frame 加在
            // 外面，hit area 只有中央 28pt，使用者點偏一點就 miss。
            Image(systemName: "plus")
                .font(.title2.weight(.semibold))
                .frame(width: 60, height: 60)
                .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .glassEffect(.regular, in: .circle)
        .tint(.primary)
        .accessibilityLabel(Text("cards.createAria", bundle: .module))
    }
    #endif

    #if os(macOS)
    /// List 用 maxWidth: 720 — 沒選卡片時 Spacer 兩側 padding 把它置中；
    /// 選了卡片時剩餘寬度被 detail 吃掉、list 自動收窄但仍試圖置中。
    private static let listColumnWidth: CGFloat = 720

    /// 搜尋 / tag 篩選狀態（macOS Cards tab 常駐 search bar）。命名與
    /// DailyHostView 的 dashboard 卡片搜尋對稱。
    @State private var searchQuery = ""
    @State private var debouncedQuery = ""
    @State private var selectedTagIds: Set<String> = []
    @State private var allTags: [TagDTO] = []
    @State private var searchResults: [CardDTO] = []
    @State private var searchIsLoading = false
    @State private var hasSearched = false
    @FocusState private var searchFocused: Bool

    /// Mac layout — 對齊 web：點卡片 → quickCard sheet（快速 Modal），
    /// sheet 按「展開」→ fullPageCard 佔滿內容區全寬編輯（Escape 回列表）。
    /// 不再用 HSplitView / slide-in split（避免 NSSplitView 上下台打亂
    /// NavigationSplitView NSToolbar cache 的 Fix D toolbar bug）。
    @ViewBuilder
    private var macOSLayout: some View {
        let core = Group {
            if let card = fullPageCard {
                cardFullPage(card)
            } else {
                centeredList
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.nudgeBackground)
        .task { await firstPage() }
        .task { await loadAllTags() }
        .task(id: searchQuery) { await debounceSearch() }
        .task(id: searchKey) { await fetchSearch() }
        .sheet(item: $quickCard) { card in cardQuickSheet(card) }
        // 回報全頁狀態給 root toolbar（+ ↔ 返回鈕）。
        .onChange(of: fullPageCard?.id) { _, _ in
            onFullPageChange?(fullPageCard != nil)
        }

        // embedded = 嵌在 DailyHostView 右側面板用，不能掛 toolbar /
        // navigationTitle —— 它們會 bubble 到外層 NavigationStack 的視
        // 窗 toolbar，擠掉 Daily 自己的按鈕。
        if embedded {
            core
        } else {
            // "+" 按鈕上提到 MacSidebarRoot 的 root toolbar；host 透過
            // createCardNotification 接到觸發。全頁時 toolbar 改顯示返回鈕，
            // 點了 post cardsBackNotification → 清掉 fullPageCard。
            core
                .navigationTitle(macNavTitle)
                .onReceive(NotificationCenter.default.publisher(for: NudgeCommands.createCardNotification)) { _ in
                    createCard()
                }
                .onReceive(NotificationCenter.default.publisher(for: NudgeCommands.cardsBackNotification)) { _ in
                    fullPageCard = nil
                }
        }
    }

    /// 全頁時 window 標題顯示卡片標題（空標題→未命名）；否則顯示「卡片」。
    private var macNavTitle: Text {
        if let c = fullPageCard {
            return c.title.isEmpty
                ? Text("cards.untitled", bundle: .module)
                : Text(verbatim: c.title)
        }
        return Text("nav.cards", bundle: .module)
    }

    /// 內部自帶置中 — Spacer + content(maxWidth: listColumnWidth) + Spacer。
    /// 父層 HStack 空間夠寬時內外 Spacer 推 content 至 720pt 置中；空間
    /// 不夠 (detail 開啟把 right pane 吃走) content 自動收窄、Spacer 吸收 0。
    private var centeredList: some View {
        HStack(spacing: 0) {
            Spacer(minLength: 0)
            VStack(spacing: 0) {
                searchBar
                content
            }
            // top 對齊 + 撐滿高度：搜尋列恆釘在頂端，content（含空態）佔
            // 剩餘空間。否則空態高度小時整個 VStack 會被父 HStack 垂直
            // 置中，把搜尋框推到畫面中央。
            .frame(maxWidth: Self.listColumnWidth, maxHeight: .infinity, alignment: .top)
            Spacer(minLength: 0)
        }
    }

    /// Cards tab 常駐搜尋列：search field +（有 tag 時）tag chips。
    /// 與 Daily dashboard 不同，這裡不收合（全寬空間足夠、常駐更易發現）。
    private var searchBar: some View {
        VStack(spacing: 10) {
            CardSearchField(query: $searchQuery, isFocused: $searchFocused)
            if !allTags.isEmpty {
                CardTagChips(allTags: allTags, selectedTagIds: $selectedTagIds)
            }
        }
        .padding(.horizontal, 12)
        .padding(.top, 12)
        .padding(.bottom, 8)
    }

    /// 全頁編輯：卡片詳情佔滿內容區（左側 app sidebar 保留）。對齊 web
    /// 整頁編輯 —— 無可見返回鈕，靠 Escape（.onExitCommand）回到網格列表。
    /// CardDetailView 自帶 navigationTitle + ... menu（rename/schedule/tags），
    /// 會 bubble 到 window toolbar（與舊 split 同行為）。
    private func cardFullPage(_ card: CardDTO) -> some View {
        HStack(spacing: 0) {
            Spacer(minLength: 0)
            CardDetailView(
                card: card,
                onUpdateTitle: { updateTitle(cardId: card.id, title: $0) },
                onUpdateDescription: { updateDescription(cardId: card.id, html: $0) },
                onUpdateTags: { newIds in await updateTags(cardId: card.id, tagIds: newIds) }
            )
            // .id(card.id) 讓切換卡片時 CardDetailView 重 mount、@State 重灌。
            .id(card.id)
            // 兩側留白：內容置中、最寬 760（對齊 web max-w-3xl）。
            .frame(maxWidth: 760)
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.nudgeBackground)
        .onExitCommand { fullPageCard = nil }
    }

    /// 點卡片彈出的快速 Modal（sheet）—— 對齊 web modal：CardDetailView 的
    /// macHeader 已含「大標題 + rename/schedule/tags + 展開 + 關閉」玻璃鈕，
    /// 直接放進 sheet（無 NavigationStack chrome）。「展開」→ 關 sheet、開
    /// fullPageCard 全頁；「關閉」→ 關 sheet。
    private func cardQuickSheet(_ card: CardDTO) -> some View {
        CardDetailView(
            card: card,
            onUpdateTitle: { updateTitle(cardId: card.id, title: $0) },
            onUpdateDescription: { updateDescription(cardId: card.id, html: $0) },
            onUpdateTags: { newIds in await updateTags(cardId: card.id, tagIds: newIds) },
            onExpand: {
                let c = card
                quickCard = nil
                fullPageCard = c
            },
            onClose: { quickCard = nil }
        )
        .id(card.id)
        .frame(minWidth: 920, minHeight: 600)
        .background(Color.nudgeBackground)
    }
    #endif

    @ViewBuilder
    private var content: some View {
        #if os(macOS)
        macContentBody
        #else
        iOSContentBody
        #endif
    }

    #if os(iOS)
    /// iOS 維持原本「全部卡片」清單（iOS 搜尋走獨立 CardSearchView tab）。
    @ViewBuilder
    private var iOSContentBody: some View {
        if cards.isEmpty && isLoading {
            ProgressView()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if cards.isEmpty && hasError {
            ContentUnavailableView {
                Label {
                    Text("error.unknown", bundle: .module)
                } icon: {
                    Image(systemName: "exclamationmark.triangle")
                }
            }
        } else if cards.isEmpty {
            ContentUnavailableView {
                Label {
                    Text("cards.emptyNoCards", bundle: .module)
                } icon: {
                    Image(systemName: "square.stack")
                }
            } description: {
                Text("cards.emptyDescription", bundle: .module)
            } actions: {
                Button(action: createCard) {
                    Text("cards.createAria", bundle: .module)
                }
            }
        } else {
            ScrollView { iOSList }
        }
    }
    #endif

    #if os(macOS)
    /// macOS：filtering 時顯示搜尋結果、否則顯示全部卡片分頁列表。
    @ViewBuilder
    private var macContentBody: some View {
        if displayedCards.isEmpty {
            if isFiltering {
                if searchIsLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if hasSearched {
                    ContentUnavailableView {
                        Label {
                            Text("cards.emptyWithQuery", bundle: .module)
                        } icon: {
                            Image(systemName: "magnifyingglass")
                        }
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    // 剛開始 filtering、fetch 尚未回 — 撐版避免閃 empty。
                    Color.clear.frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            } else if isLoading {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if hasError {
                ContentUnavailableView {
                    Label {
                        Text("error.unknown", bundle: .module)
                    } icon: {
                        Image(systemName: "exclamationmark.triangle")
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ContentUnavailableView {
                    Label {
                        Text("cards.emptyNoCards", bundle: .module)
                    } icon: {
                        Image(systemName: "square.stack")
                    }
                } description: {
                    Text("cards.emptyDescription", bundle: .module)
                } actions: {
                    Button(action: createCard) {
                        Text("cards.createAria", bundle: .module)
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        } else {
            ScrollView { macGrid }
        }
    }

    private var isFiltering: Bool {
        !debouncedQuery.isEmpty || !selectedTagIds.isEmpty
    }

    /// filtering → 搜尋結果；否則 → 全部卡片（分頁快取）。
    private var displayedCards: [CardDTO] {
        isFiltering ? searchResults : cards
    }

    /// debouncedQuery + 選中 tag 一起 key — chip 切換也觸發 re-fetch。
    private var searchKey: String {
        let tags = selectedTagIds.sorted().joined(separator: ",")
        return "\(debouncedQuery)|\(tags)"
    }
    #endif

    #if os(macOS)
    /// 自適應 grid columns — 卡片最小 220pt（720pt 置中時 ≈3 欄；
    /// 380pt split mode 時 1 欄），自動隨欄寬調整。
    private var gridColumns: [GridItem] {
        [GridItem(.adaptive(minimum: 220), spacing: 12)]
    }

    @ViewBuilder
    private var macGrid: some View {
        LazyVGrid(columns: gridColumns, spacing: 12) {
            ForEach(displayedCards) { card in
                CardGridItemView(
                    card: card,
                    isSelected: quickCard?.id == card.id,
                    onTap: { openDetail(card) }
                )
                .onAppear {
                    // 分頁只在「全部卡片」模式有意義；filtering 結果只取
                    // 第一頁（與 Daily / iOS CardSearchView 一致），不續抓。
                    if !isFiltering, card.id == cards.last?.id {
                        Task { await loadMore() }
                    }
                }
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 12)

        if !isFiltering {
            paginationFooter
        }
    }
    #endif

    @ViewBuilder
    private var iOSList: some View {
        LazyVStack(spacing: 8) {
            ForEach(cards) { card in
                CardListItemView(card: card) {
                    openDetail(card)
                }
                .background(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(rowBackground(for: card))
                )
                .onAppear {
                    if card.id == cards.last?.id {
                        Task { await loadMore() }
                    }
                }
            }
            paginationFooter
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
    }

    @ViewBuilder
    private var paginationFooter: some View {
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

    /// macOS split mode 下選中的卡片要有視覺 highlight，使用者才知道
    /// 「右邊 detail 顯示的是哪個」。iOS 直接走預設背景。
    private func rowBackground(for card: CardDTO) -> Color {
        #if os(macOS)
        if quickCard?.id == card.id {
            return Color.nudgeSelectedFill
        }
        #endif
        return Color.nudgeForeground.opacity(0.04)
    }

    private func openDetail(_ card: CardDTO) {
        #if os(macOS)
        quickCard = card
        #else
        navigationPath.append(card)
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

    #if os(macOS)
    private func loadAllTags() async {
        do {
            allTags = try await tagRepo.list()
        } catch {
            if !APIError.isCancellation(error) {
                print("[CardsHostView] loadAllTags failed: \(error)")
            }
        }
    }

    private func debounceSearch() async {
        try? await Task.sleep(nanoseconds: 300_000_000)
        if !Task.isCancelled {
            debouncedQuery = searchQuery.trimmingCharacters(in: .whitespaces)
        }
    }

    private func fetchSearch() async {
        let q = debouncedQuery
        let tagIds = Array(selectedTagIds)
        guard !q.isEmpty || !tagIds.isEmpty else {
            searchResults = []
            hasSearched = false
            return
        }
        searchIsLoading = true
        do {
            let page = try await cardRepo.list(query: q, cursor: nil, tagIds: tagIds)
            searchResults = page.cards
            hasSearched = true
        } catch {
            if !APIError.isCancellation(error) {
                print("[CardsHostView] fetchSearch failed: \(error)")
                searchResults = []
                hasSearched = true
            }
        }
        searchIsLoading = false
    }
    #endif

    private func createCard() {
        Task {
            do {
                let card = try await cardRepo.create()
                cards.insert(card, at: 0)
                #if os(macOS)
                // 新卡直接進全頁編輯（對齊 web：新增 → /cards/[id] 全頁）。
                fullPageCard = card
                #else
                openDetail(card)
                #endif
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

        #if os(macOS)
        // 全頁 window 標題的來源是 fullPageCard；rename 後同步它才會即時更新。
        if let f = fullPageCard, f.id == cardId {
            fullPageCard = CardDTO(
                id: f.id,
                title: title,
                description: f.description,
                updatedAt: f.updatedAt,
                tags: f.tags
            )
        }
        #endif

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
            let refreshedTags = try await tagRepo.list()
            // Refresh in-memory list so chips show in row + detail next time.
            let nextTags = refreshedTags.filter { tagIds.contains($0.id) }
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
// `Tags/TagFilterChip.swift` and back the iOS `CardSearchView` search
// surface. The macOS Cards tab filters inline via the shared
// `CardSearchField` / `CardTagChips` components (see Cards/CardSearchComponents.swift).

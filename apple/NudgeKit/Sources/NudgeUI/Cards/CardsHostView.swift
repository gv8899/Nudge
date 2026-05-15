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
    /// Mac 端選中的卡片 — nil 時 list 置中、選中時 list 變窄欄、右側
    /// 展開 CardDetailView (Mail-style split)。
    @State private var selectedCard: CardDTO?
    #endif

    public init(embedded: Bool = false) {
        self.embedded = embedded
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

    /// Detail pane 寬度（pt）— resize handle 拖拉時更新；重開保留。
    /// 360 ~ 900 clamp：min 360 維持 card editor 可讀寬度，max 900 避免
    /// 把 list 擠到 <320pt 不堪用。Daily 用 400 default；Cards default
    /// 拉到 520，因為 card detail 含 title + rich text editor 比 Daily
    /// 的 calendar / cards summary panel 內容多。
    @AppStorage("cards.mac.detailWidth") private var detailWidth: Double = 520

    /// Mac layout — Heptabase-style slide-in detail：永遠是同一棵 HStack
    /// (parent 樹不變)，selectedCard 非 nil 時條件 insert detail pane +
    /// .transition(.move(edge: .trailing))。
    ///
    /// 之前用 HSplitView (有 selection) vs HStack (無 selection) 二選一，
    /// SwiftUI 看成兩棵不同 view tree 在切換。除了動畫不順，更嚴重的問
    /// 題：HSplitView 在 macOS 底層是 NSSplitView，appear / disappear
    /// 會 trigger window responder chain 變動，連帶讓 NavigationSplitView
    /// 的 NSToolbar 重新評估 item layout — 結果是 Fix D 已經修好的「切
    /// 分頁後 Daily toolbar 按鈕跑到 leading」bug 又透過「點卡片→切回
    /// Daily」這條路徑復發 (Calendar / Notes 不引入 HSplitView，所以
    /// 不觸發)。改成 stable HStack 後 NSSplitView 不再上下台、cache
    /// 不再被打亂。Trade-off：失去 HSplitView 的拖拉欄寬。Daily 也是
    /// 為了類似原因放棄 HSplitView (見 dashboardContent doc)。
    @ViewBuilder
    private var macOSLayout: some View {
        let core = HStack(spacing: 0) {
            centeredList
                .frame(maxWidth: .infinity, maxHeight: .infinity)

            if let card = selectedCard {
                // handle + detail 包成同一個 HStack 整段 slide（跟
                // DailyHostView.dashboardContent 一致 pattern），避免
                // handle / detail 動畫錯開。
                HStack(spacing: 0) {
                    ResizeHandle(width: $detailWidth, range: 360...900)
                    cardDetailPane(card)
                        .frame(width: detailWidth)
                        .frame(maxHeight: .infinity)
                }
                .transition(.asymmetric(
                    insertion: .move(edge: .trailing).combined(with: .opacity),
                    removal: .move(edge: .trailing).combined(with: .opacity)
                ))
            }
        }
        .animation(.spring(response: 0.32, dampingFraction: 0.86), value: selectedCard?.id)
        .background(Color.nudgeBackground)
        .task { await firstPage() }

        // embedded = 嵌在 DailyHostView 右側面板用，不能掛 toolbar /
        // navigationTitle —— 它們會 bubble 到外層 NavigationStack 的視
        // 窗 toolbar，擠掉 Daily 自己的按鈕。
        if embedded {
            core
        } else {
            // "+" 按鈕上提到 MacSidebarRoot 的 root toolbar；host 透過
            // createCardNotification 接到觸發。
            core
                .navigationTitle(Text("nav.cards", bundle: .module))
                .onReceive(NotificationCenter.default.publisher(for: NudgeCommands.createCardNotification)) { _ in
                    createCard()
                }
        }
    }

    /// 內部自帶置中 — Spacer + content(maxWidth: listColumnWidth) + Spacer。
    /// 父層 HStack 空間夠寬時內外 Spacer 推 content 至 720pt 置中；空間
    /// 不夠 (detail 開啟把 right pane 吃走) content 自動收窄、Spacer 吸收 0。
    private var centeredList: some View {
        HStack(spacing: 0) {
            Spacer(minLength: 0)
            content.frame(maxWidth: Self.listColumnWidth)
            Spacer(minLength: 0)
        }
    }

    /// 右側 detail 面板。頂端有 X 按鈕（清空 selectedCard 回到置中
    /// list），下方是 CardDetailView 標準完整功能（標題、編輯器、
    /// rename / schedule / tags toolbar menu 都在）。
    private func cardDetailPane(_ card: CardDTO) -> some View {
        VStack(spacing: 0) {
            HStack(spacing: 8) {
                Button { selectedCard = nil } label: {
                    Image(systemName: "xmark")
                        .font(.callout.weight(.medium))
                        .foregroundStyle(Color.nudgeTextDim)
                        .frame(width: 28, height: 28)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .help(Text("common.done", bundle: .module))
                .keyboardShortcut(.cancelAction)

                Spacer()
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)

            Divider()
                .background(Color.nudgeBorderLight)

            CardDetailView(
                card: card,
                onUpdateTitle: { updateTitle(cardId: card.id, title: $0) },
                onUpdateDescription: { updateDescription(cardId: card.id, html: $0) },
                onUpdateTags: { newIds in await updateTags(cardId: card.id, tagIds: newIds) }
            )
            // 強制 SwiftUI 把 CardDetailView 視為「不同 view」當切換卡片時。
            // CardDetailView 用 `_title = State(initialValue: card.title)` 在 init
            // 灌 @State；SwiftUI 預設只在 identity 第一次建立時 run init，
            // 所以同位置切不同 card 不會重新讀新 card 的欄位。給 .id(card.id)
            // 讓 identity 跟著 card 換，整個 view 重 mount、@State 重灌。
            .id(card.id)
        }
        .background(Color.nudgeBackground)
    }
    #endif

    @ViewBuilder
    private var content: some View {
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
            list
        }
    }

    private var list: some View {
        // 桌機寬度由 macOSLayout 的外層 wrapper（centered HStack 或
        // HSplitView 左欄 frame）決定，這裡不再 cap。iOS 直接吃滿。
        // mac 改 LazyVGrid；iOS 維持 LazyVStack（手機螢幕窄、grid 沒
        // 意義）。
        ScrollView {
            #if os(macOS)
            macGrid
            #else
            iOSList
            #endif
        }
    }

    #if os(macOS)
    /// 自適應 grid columns — 卡片最小 220pt（720pt 置中時 ≈3 欄；
    /// 380pt split mode 時 1 欄），自動隨欄寬調整。
    private var gridColumns: [GridItem] {
        [GridItem(.adaptive(minimum: 220), spacing: 12)]
    }

    @ViewBuilder
    private var macGrid: some View {
        LazyVGrid(columns: gridColumns, spacing: 12) {
            ForEach(cards) { card in
                CardGridItemView(
                    card: card,
                    isSelected: selectedCard?.id == card.id,
                    onTap: { openDetail(card) }
                )
                .onAppear {
                    if card.id == cards.last?.id {
                        Task { await loadMore() }
                    }
                }
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 12)

        paginationFooter
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
        if selectedCard?.id == card.id {
            return Color.nudgeSelectedFill
        }
        #endif
        return Color.nudgeForeground.opacity(0.04)
    }

    private func openDetail(_ card: CardDTO) {
        #if os(macOS)
        selectedCard = card
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

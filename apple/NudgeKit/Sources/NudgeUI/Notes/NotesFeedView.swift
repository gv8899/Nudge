import SwiftUI
import NudgeCore

/// Timeline list of past journal entries. Paginates via YYYY-MM-DD
/// cursor; tapping an entry routes to `NotesCanvasView(date:)`.
public struct NotesFeedView: View {
    @Environment(NoteRepository.self) private var noteRepo

    @State private var entries: [NoteFeedEntryDTO] = []
    @State private var nextCursor: String?
    @State private var isLoading = false
    @State private var isLoadingMore = false
    @State private var hasLoaded = false

    #if os(macOS)
    /// Mac feed split：點 row 把日期記在這裡，右側 inline 顯示 canvas
    /// detail（不走 NavigationStack push、避免 iOS 的全螢幕替換）。
    @State private var selectedDate: String?
    /// Detail pane 寬度（pt）— ResizeHandle 拖拉時更新；重開保留。
    /// 360 ~ 900 跟 CardsHostView 對齊。
    @AppStorage("notes.mac.detailWidth") private var detailWidth: Double = 520
    private static let listColumnWidth: CGFloat = 720
    #endif

    public init() {}

    public var body: some View {
        #if os(macOS)
        macOSLayout
            .background(Color.nudgeBackground)
            .task { await firstPage() }
            // typing 完成（NotesCanvasView debounced save）後 list refetch，
            // 今日 entry 從無到有（或內容預覽更新）立刻在 list 顯示。
            .onReceive(NotificationCenter.default.publisher(for: NudgeCommands.noteSavedNotification)) { _ in
                Task { await firstPage() }
            }
        #else
        content
            .background(Color.nudgeBackground)
            .task { await firstPage() }
        #endif
    }

    #if os(macOS)
    /// Mac feed split layout — 永久 split，**左邊 list、右邊 canvas 永遠
    /// 都在**。selectedDate 非 nil 顯示那天、nil 預設今日空白 canvas。
    /// ResizeHandle 中間可拖。沒有 toggle，feed 跟 canvas 是同一個畫面
    /// 的左右兩半（Apple Notes / Mail 慣例）。
    @ViewBuilder
    private var macOSLayout: some View {
        HStack(spacing: 0) {
            centeredFeed
                .frame(maxWidth: .infinity, maxHeight: .infinity)

            HStack(spacing: 0) {
                ResizeHandle(width: $detailWidth, range: 360...900)
                canvasDetailPane(date: effectiveSelectedDate)
                    .frame(width: detailWidth)
                    .frame(maxHeight: .infinity)
            }
        }
        .animation(.spring(response: 0.32, dampingFraction: 0.86), value: selectedDate)
    }

    private var centeredFeed: some View {
        HStack(spacing: 0) {
            Spacer(minLength: 0)
            content.frame(maxWidth: Self.listColumnWidth)
            Spacer(minLength: 0)
        }
    }

    /// Right pane：純編輯器、不要任何 chrome。Notes 沒有「沒選 vs 已選」
    /// 兩種 mode（不像 Cards 有 list-only / list+detail 兩態）— 永遠都在
    /// 編輯**某一天**，所以 X / 「關閉 detail」按鈕沒意義。要切到另一天
    /// 點 list、要回今日點 list 頂端的「今天」虛擬 row（或真實 entry，
    /// typing 後自動出現）。`.id(date)` 強制 SwiftUI 切換日期時整顆
    /// NotesCanvasView 重 mount，避免 @State (html / activeMarks /
    /// saveWorkItem) 殘留前一天的值。
    private func canvasDetailPane(date: String) -> some View {
        NotesCanvasView(date: date)
            .id(date)
            .background(Color.nudgeBackground)
    }

    /// 「effective」 selectedDate：nil 視為今日，給 row highlight / detail
    /// date 共用一致 source of truth。
    private var todayStr: String { DateFormatters.isoDate(Date()) }
    private var effectiveSelectedDate: String { selectedDate ?? todayStr }

    /// List 頂端的虛擬「今天」row — 今日 entry 還不存在時的入口。樣式
    /// 對齊 NotesFeedRow（datePillar + 預覽文字），預覽文字改成
    /// `notes.todayPlaceholder` localized 提示。
    private var todayPlaceholderRow: some View {
        Button {
            selectedDate = todayStr
        } label: {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 0) {
                    Text(verbatim: "\(Calendar(identifier: .gregorian).component(.day, from: Date()))")
                        .font(.title.weight(.semibold))
                        .foregroundStyle(Color.nudgeForeground)
                    Text(verbatim: Date().formatted(.dateTime.month(.abbreviated)))
                        .font(.caption2.weight(.medium))
                        .foregroundStyle(Color.nudgeTextDim)
                }
                .frame(width: 56, alignment: .leading)
                Text("notes.todayPlaceholder", bundle: .module)
                    .font(.subheadline)
                    .foregroundStyle(Color.nudgeTextDim)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .frame(minHeight: 88)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(
                    effectiveSelectedDate == todayStr
                        ? Color.nudgePrimary.opacity(0.12)
                        : Color.nudgeForeground.opacity(0.04)
                )
        )
    }
    #endif

    @ViewBuilder
    private var content: some View {
        if !hasLoaded && isLoading {
            ProgressView()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if entries.isEmpty {
            emptyState
        } else {
            feedList
        }
    }

    @ViewBuilder
    private var emptyState: some View {
        VStack(spacing: 10) {
            Spacer()
            // Token-aligned font (was .system(size: 32)) so the icon
            // tracks Dynamic Type with the body text below.
            Image(systemName: "book.closed")
                .font(.system(.largeTitle))
                .foregroundStyle(Color.nudgeTextDim)
            Text("notes.emptyFeedPrompt", bundle: .module)
                .font(.subheadline)
                .foregroundStyle(Color.nudgeTextDim)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 24)
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    @ViewBuilder
    private var feedList: some View {
        // Elevated cards with 8pt spacing — same family as
        // CardsHostView's list. Was flat Divider rows that visually
        // smushed together in dark mode.
        ScrollView {
            LazyVStack(spacing: 8) {
                #if os(macOS)
                // Mac always-split：今日 entry 還沒從 server fetch 回來時
                // (user 今天還沒寫過) 在 list 頂端塞一個虛擬 row 當「回今日」
                // 的入口。否則 user 從過去 entry 走回今日只有「重開 app」這
                // 條後路，太尷尬。一旦 typing 觸發 save → noteSavedNotification
                // refetch → 今日 entry 真的出現在 entries[0] → 虛擬 row 自
                // 動隱藏，不會跟真實 entry 重複。
                if !entries.contains(where: { $0.date == todayStr }) {
                    todayPlaceholderRow
                }
                #endif
                ForEach(entries) { entry in
                    // Mac: 點 row 設 selectedDate，右側 inline 顯示 canvas
                    // (split layout)。iOS: 維持 NavigationLink push，全螢幕
                    // 替換顯示，符合 phone 慣例。
                    #if os(macOS)
                    Button {
                        selectedDate = entry.date
                    } label: {
                        NotesFeedRow(entry: entry)
                    }
                    .buttonStyle(.plain)
                    .background(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .fill(
                                effectiveSelectedDate == entry.date
                                    ? Color.nudgePrimary.opacity(0.12)
                                    : Color.nudgeForeground.opacity(0.04)
                            )
                    )
                    .onAppear {
                        if entry.id == entries.last?.id {
                            Task { await loadMore() }
                        }
                    }
                    #else
                    NavigationLink(value: NotesRoute.date(entry.date)) {
                        NotesFeedRow(entry: entry)
                    }
                    .buttonStyle(.plain)
                    .background(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .fill(Color.nudgeForeground.opacity(0.04))
                    )
                    .onAppear {
                        if entry.id == entries.last?.id {
                            Task { await loadMore() }
                        }
                    }
                    #endif
                }
                if isLoadingMore {
                    ProgressView()
                        .padding(16)
                } else if nextCursor == nil && !entries.isEmpty {
                    Text("notes.noMoreEntries", bundle: .module)
                        .font(.caption)
                        .foregroundStyle(Color.nudgeTextDim)
                        .padding(12)
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
        }
    }

    // MARK: - Fetch

    private func firstPage() async {
        isLoading = true
        do {
            let page = try await noteRepo.feed(cursor: nil)
            entries = page.notes
            nextCursor = page.nextCursor
            hasLoaded = true
        } catch {
            if APIError.isCancellation(error) { return }
            print("[NotesFeedView] firstPage failed: \(error)")
        }
        isLoading = false
    }

    private func loadMore() async {
        guard !isLoadingMore, let cursor = nextCursor else { return }
        isLoadingMore = true
        do {
            let page = try await noteRepo.feed(cursor: cursor)
            entries.append(contentsOf: page.notes)
            nextCursor = page.nextCursor
        } catch {
            if !APIError.isCancellation(error) {
                print("[NotesFeedView] loadMore failed: \(error)")
            }
        }
        isLoadingMore = false
    }
}

/// One row in the feed list. Left: date pillar (day number + locale-
/// aware month abbreviation). Right: sanitized plaintext preview.
struct NotesFeedRow: View {
    let entry: NoteFeedEntryDTO
    @Environment(\.locale) private var locale

    /// Strip HTML once at row construction — was per-render scan, which
    /// scaled with feed length × scroll frame. Same fix as CardListItem.
    private let preview: String
    private let parsedDate: Date?

    init(entry: NoteFeedEntryDTO) {
        self.entry = entry
        self.preview = entry.content.strippedHTML(maxLength: 220)
        self.parsedDate = DateFormatters.parseISODate(entry.date)
    }

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            datePillar
                .frame(width: 56, alignment: .leading)
            Text(preview)
                .font(.subheadline)
                .foregroundStyle(Color.nudgeForeground)
                .lineLimit(3)
                .multilineTextAlignment(.leading)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .frame(minHeight: 88)
        .contentShape(Rectangle())
        // Combine into a single VoiceOver phrase: was "25, 4月, weekday,
        // {preview}" four separate elements.
        .accessibilityElement(children: .combine)
        .accessibilityLabel(Text(verbatim: a11yLabel))
    }

    @ViewBuilder
    private var datePillar: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(verbatim: dayNumber)
                .font(.title.weight(.semibold))
                .foregroundStyle(Color.nudgeForeground)
            Text(verbatim: monthLabel)
                .font(.caption2.weight(.medium))
                .foregroundStyle(Color.nudgeTextDim)
        }
    }

    /// Plain digit — `Date.FormatStyle(.day).locale("zh"/"ja")` would
    /// append "日" suffix and visually wrap the title-sized pillar
    /// number. The pillar's whole point is "big number, eye-catching",
    /// so we just want the integer.
    private var dayNumber: String {
        guard let d = parsedDate else { return "" }
        return "\(Calendar(identifier: .gregorian).component(.day, from: d))"
    }

    /// Locale-aware abbreviated month — "Apr" / "4月" / "4月".
    /// Suffix is OK here because the label is small (caption) and
    /// reading "4月" as-is feels natural in zh/ja.
    private var monthLabel: String {
        guard let d = parsedDate else { return "" }
        return d.formatted(.dateTime.month(.abbreviated).locale(locale))
    }

    private var a11yLabel: String {
        guard let d = parsedDate else { return preview }
        let dateStr = d.formatted(
            .dateTime.year().month().day().weekday().locale(locale)
        )
        return preview.isEmpty ? dateStr : "\(dateStr), \(preview)"
    }
}

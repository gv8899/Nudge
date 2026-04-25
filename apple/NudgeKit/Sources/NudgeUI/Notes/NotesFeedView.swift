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

    public init() {}

    public var body: some View {
        content
            .background(Color.nudgeBackground)
            .task { await firstPage() }
    }

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
                ForEach(entries) { entry in
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

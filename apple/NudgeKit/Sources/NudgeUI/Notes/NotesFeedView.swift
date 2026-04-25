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
            Image(systemName: "book.closed")
                .font(.system(size: 32))
                .foregroundStyle(Color.nudgeTextDim)
            Text("notes.emptyFeedPrompt", bundle: .module)
                .font(.subheadline)
                .foregroundStyle(Color.nudgeTextDim)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    @ViewBuilder
    private var feedList: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                ForEach(entries) { entry in
                    NavigationLink(value: NotesRoute.date(entry.date)) {
                        NotesFeedRow(entry: entry)
                    }
                    .buttonStyle(.plain)
                    .onAppear {
                        if entry.id == entries.last?.id {
                            Task { await loadMore() }
                        }
                    }
                    Divider()
                        .background(Color.nudgeBorderLight)
                        .padding(.leading, 16)
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

/// One row in the feed list. Left: date pillar (day number + month).
/// Right: sanitized plaintext preview (first ~150 chars of HTML).
struct NotesFeedRow: View {
    let entry: NoteFeedEntryDTO
    @Environment(\.locale) private var locale

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            datePillar
                .frame(width: 56, alignment: .leading)
            VStack(alignment: .leading, spacing: 4) {
                Text(weekday)
                    .font(.caption2)
                    .foregroundStyle(Color.nudgeTextDim)
                Text(preview)
                    .font(.subheadline)
                    .foregroundStyle(Color.nudgeForeground)
                    .lineLimit(3)
                    .multilineTextAlignment(.leading)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .contentShape(Rectangle())
    }

    @ViewBuilder
    private var datePillar: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(dayNumber)
                .font(.title.weight(.semibold))
                .foregroundStyle(Color.nudgeForeground)
            Text(monthLabel)
                .font(.caption2.weight(.medium))
                .foregroundStyle(Color.nudgeTextDim)
        }
    }

    private var dayNumber: String {
        guard let d = DateFormatters.parseISODate(entry.date) else { return "" }
        let cal = Calendar(identifier: .gregorian)
        return "\(cal.component(.day, from: d))"
    }

    private var monthLabel: String {
        guard let d = DateFormatters.parseISODate(entry.date) else { return "" }
        let cal = Calendar(identifier: .gregorian)
        return "\(cal.component(.month, from: d))月"
    }

    private var weekday: String {
        guard let d = DateFormatters.parseISODate(entry.date) else { return "" }
        let cal = Calendar(identifier: .gregorian)
        let idx = cal.component(.weekday, from: d) - 1
        let keys = [
            "weekday.sun", "weekday.mon", "weekday.tue", "weekday.wed",
            "weekday.thu", "weekday.fri", "weekday.sat",
        ]
        return nudgeLocalized(keys[idx], locale: locale)
    }

    private var preview: String {
        entry.content.strippedHTML(maxLength: 220)
    }
}

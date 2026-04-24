import SwiftUI
import NudgeCore

/// Single-date journal canvas. Fetches the note for `date` on appear,
/// shows the TipTap editor, and debounces saves back to the server
/// (800ms after the last keystroke — same budget as the web canvas).
///
/// Reused from two contexts:
/// - Root of the 日誌 tab (date = today)
/// - Navigation-pushed detail when tapping a feed row (date = past)
public struct NotesCanvasView: View {
    public let date: String

    @Environment(NoteRepository.self) private var noteRepo
    @State private var html: String = ""
    @State private var isLoaded: Bool = false
    @State private var saveWorkItem: DispatchWorkItem?
    @State private var activeMarks = ActiveMarks()
    private let commandBus = EditorCommandBus()

    public init(date: String) {
        self.date = date
    }

    public var body: some View {
        VStack(spacing: 0) {
            #if os(macOS)
            EditorToolbar(
                activeMarks: activeMarks,
                commandBus: commandBus,
                onDismissKeyboard: nil
            )
            #endif
            editor
        }
        .background(Color.nudgeBackground)
        .navigationTitle(Text(verbatim: formattedDate))
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #endif
        .task(id: date) { await load() }
        .onDisappear { saveImmediatelyIfPending() }
    }

    @ViewBuilder
    private var editor: some View {
        if isLoaded {
            RichTextEditor(
                html: $html,
                placeholder: NSLocalizedString(
                    "notes.canvasPlaceholder",
                    bundle: .module,
                    comment: ""
                ),
                activeMarks: $activeMarks,
                commandBus: commandBus
            )
            // `.id(date)` forces a full editor remount when the user
            // navigates to a different date's canvas, matching the
            // CardDetailView pattern. Without this the WKWebView
            // retains the previous day's doc on date change.
            .id(date)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .onChange(of: html) { _, newValue in
                debouncedSave(newValue)
            }
        } else {
            ProgressView()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    private var formattedDate: String {
        guard let d = DateFormatters.parseISODate(date) else { return date }
        let cal = Calendar(identifier: .gregorian)
        let m = cal.component(.month, from: d)
        let day = cal.component(.day, from: d)
        let weekdayIndex = cal.component(.weekday, from: d) // 1..7, Sun=1
        let shortWeekdayKeys: [LocalizedStringKey] = [
            "weekday.sun", "weekday.mon", "weekday.tue", "weekday.wed",
            "weekday.thu", "weekday.fri", "weekday.sat",
        ]
        let weekdayKey = shortWeekdayKeys[weekdayIndex - 1]
        let weekday = NSLocalizedString(
            weekdayKey.stringKey ?? "",
            bundle: .module,
            comment: ""
        )
        return "\(m)/\(day) · \(weekday)"
    }

    // MARK: - Load / save

    private func load() async {
        do {
            let note = try await noteRepo.fetch(date: date)
            html = note.content
            isLoaded = true
        } catch {
            if APIError.isCancellation(error) { return }
            print("[NotesCanvasView] load failed: \(error)")
            // Still mark loaded so the user can start writing; an
            // empty canvas is better than a stuck ProgressView.
            html = ""
            isLoaded = true
        }
    }

    /// 800ms debounce to match `src/components/notes/notes-canvas-editor
    /// .tsx` — generous enough that mid-sentence saves don't thrash the
    /// server, tight enough that switching away almost always lands a
    /// save (and `saveImmediatelyIfPending` catches the rest on
    /// `onDisappear`).
    private func debouncedSave(_ newValue: String) {
        saveWorkItem?.cancel()
        let work = DispatchWorkItem { Task { await save(newValue) } }
        saveWorkItem = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8, execute: work)
    }

    private func saveImmediatelyIfPending() {
        guard let item = saveWorkItem else { return }
        item.cancel()
        saveWorkItem = nil
        let snapshot = html
        Task { await save(snapshot) }
    }

    private func save(_ content: String) async {
        do {
            try await noteRepo.save(date: date, content: content)
        } catch {
            if APIError.isCancellation(error) { return }
            print("[NotesCanvasView] save failed: \(error)")
        }
    }
}

private extension LocalizedStringKey {
    /// Extract the underlying string key for `NSLocalizedString` lookup.
    /// `LocalizedStringKey` stores its key in a private `key` property
    /// but exposes it via `description`.
    var stringKey: String? {
        let mirror = Mirror(reflecting: self)
        return mirror.children.first(where: { $0.label == "key" })?.value as? String
    }
}

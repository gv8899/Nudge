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
    @Environment(\.locale) private var locale
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
            // EditorToolbar 拿掉 — mac 改用 TipTap slash command menu
            // (`/` 觸發)，跟 web 一致。iOS 仍走 EditorAccessoryView (鍵盤
            // 上方 input accessory)，那不是這裡的元件。
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
                placeholder: nudgeLocalized("notes.canvasPlaceholder", locale: locale),
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

    /// Locale-aware nav title — was hand-stitched "M/D · weekday" with
    /// hardcoded "·". Now `Date.FormatStyle` produces the right sequence
    /// per locale: "Apr 25, Fri" / "4月25日金" / "4月25日 週五".
    private var formattedDate: String {
        guard let d = DateFormatters.parseISODate(date) else { return date }
        return d.formatted(
            .dateTime.month(.abbreviated).day().weekday(.abbreviated).locale(locale)
        )
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
            #if os(macOS)
            // Mac feed split：永久顯示 list、user typing 完成後 list 要
            // 馬上反映今日 entry（前一秒空白 → 一秒後出現），不能等下次
            // tab 切換才 refetch。NotesFeedView 監聽這個通知 refetch
            // firstPage。
            NotificationCenter.default.post(name: NudgeCommands.noteSavedNotification, object: date)
            #endif
        } catch {
            if APIError.isCancellation(error) { return }
            print("[NotesCanvasView] save failed: \(error)")
        }
    }
}

import SwiftUI
import NudgeCore

/// Root of the 日誌 (journal) tab. Renders today's canvas by default and
/// lets the user toggle to the timeline feed via a toolbar button.
/// Historical entries pushed from the feed re-use `NotesCanvasView`
/// pointed at a past date.
public struct NotesHostView: View {
    @State private var showFeed: Bool = false
    @State private var navigationPath = NavigationPath()

    /// Mac MacSidebarRoot 用 ZStack 同時 mount 全部 5 個 host，inactive
    /// 視窗的 toolbar items 會 bubble 到外層共用 toolbar。embedded = true
    /// 跳過 .toolbar / .navigationTitle，避免 list.bullet / pencil.line
    /// 在 user 看 Today 時也漂出來。
    private let embedded: Bool

    public init(embedded: Bool = false) {
        self.embedded = embedded
    }

    public var body: some View {
        NavigationStack(path: $navigationPath) {
            content
        }
    }

    @ViewBuilder
    private var content: some View {
        let core = rootContent
            .navigationDestination(for: NotesRoute.self) { route in
                switch route {
                case .date(let date):
                    NotesCanvasView(date: date)
                }
            }

        if embedded {
            core
        } else {
            core
                .navigationTitle(Text("nav.notes", bundle: .module))
                #if os(iOS)
                .navigationBarTitleDisplayMode(.inline)
                #endif
                .toolbar {
                    ToolbarItem(placement: toolbarTrailing) {
                        Button {
                            withAnimation(.easeOut(duration: 0.2)) {
                                showFeed.toggle()
                            }
                        } label: {
                            Image(systemName: showFeed ? "pencil.line" : "list.bullet")
                                .foregroundStyle(Color.nudgeForeground)
                        }
                        .accessibilityLabel(
                            Text(
                                showFeed
                                    ? "notes.backToCanvasTitle"
                                    : "notes.canvasToggleFeedTitle",
                                bundle: .module
                            )
                        )
                        .help(
                            Text(
                                showFeed
                                    ? "notes.backToCanvasTitle"
                                    : "notes.canvasToggleFeedTitle",
                                bundle: .module
                            )
                        )
                    }
                }
        }
    }

    @ViewBuilder
    private var rootContent: some View {
        if showFeed {
            NotesFeedView()
        } else {
            NotesCanvasView(date: DateFormatters.isoDate(Date()))
        }
    }

    private var toolbarTrailing: ToolbarItemPlacement {
        #if os(iOS)
        .topBarTrailing
        #else
        .primaryAction
        #endif
    }
}

/// Typed navigation routes within the notes tab. A single case today,
/// but `enum` leaves room for future `.search`, `.newEntry`, etc.
public enum NotesRoute: Hashable {
    case date(String)
}

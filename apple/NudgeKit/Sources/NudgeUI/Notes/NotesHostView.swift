import SwiftUI
import NudgeCore

/// Root of the 日誌 (journal) tab. Renders today's canvas by default and
/// lets the user toggle to the timeline feed via a toolbar button.
/// Historical entries pushed from the feed re-use `NotesCanvasView`
/// pointed at a past date.
public struct NotesHostView: View {
    @State private var showFeed: Bool = false
    @State private var navigationPath = NavigationPath()

    public init() {}

    public var body: some View {
        NavigationStack(path: $navigationPath) {
            rootContent
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
                            // Explicit foregroundStyle overrides the
                            // .tint(Color.nudgePrimary) inherited from
                            // PlatformRootView's TabView root.
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
                    }
                }
                .navigationDestination(for: NotesRoute.self) { route in
                    switch route {
                    case .date(let date):
                        NotesCanvasView(date: date)
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

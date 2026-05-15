import SwiftUI
import NudgeCore

/// Root of the 日誌 (journal) tab.
///
/// **Mac**: 永久 split — 左 feed list、右 canvas（預設今日空白、選一筆
/// 顯示那筆）。沒有 toggle 按鈕。
///
/// **iOS**: 預設今日 canvas + toolbar 切換看 feed (showFeed flag)；feed
/// 內點 row push 過去 NotesCanvasView(date:) 全螢幕顯示，符合手機慣例。
public struct NotesHostView: View {
    #if os(iOS)
    @AppStorage("notes.mac.showFeed") private var showFeed: Bool = false
    #endif
    @State private var navigationPath = NavigationPath()

    /// MacSidebarRoot 用 ZStack 同時 mount 全部 5 個 host；inactive host 的
    /// `.navigationTitle` 會 bubble 到外層 NavigationSplitView 共用 chrome、
    /// 蓋掉 active host 的 title。embedded=true 時跳過。
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
            #if os(iOS)
            .navigationDestination(for: NotesRoute.self) { route in
                switch route {
                case .date(let date):
                    NotesCanvasView(date: date)
                }
            }
            #endif

        if embedded {
            core
        } else {
            let titled = core
                .navigationTitle(Text("nav.notes", bundle: .module))
                #if os(iOS)
                .navigationBarTitleDisplayMode(.inline)
                #endif

            #if os(iOS)
            titled
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
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
            #else
            titled
            #endif
        }
    }

    @ViewBuilder
    private var rootContent: some View {
        #if os(macOS)
        // Mac 永久 split — NotesFeedView 內部處理 list + canvas 雙欄。
        NotesFeedView()
        #else
        // iOS: toggle 切換 feed / canvas single-screen。
        if showFeed {
            NotesFeedView()
        } else {
            NotesCanvasView(date: DateFormatters.isoDate(Date()))
        }
        #endif
    }
}

/// Typed navigation routes within the notes tab. A single case today,
/// but `enum` leaves room for future `.search`, `.newEntry`, etc.
public enum NotesRoute: Hashable {
    case date(String)
}

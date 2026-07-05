#if os(macOS)
import SwiftUI

/// Mac sidebar 的 detail host 是否為當前顯示中的分頁。
///
/// `MacSidebarRoot` 用 ZStack 常駐 mount 全部 5 個分頁（保留各自
/// navigation / @State），inactive 分頁靠 `opacity(0)` +
/// `allowsHitTesting(false)` 隱藏 —— 但那只作用在 **SwiftUI 層**。
/// AppKit-backed view（WKWebView 編輯器）的 NSView 與其 NSTrackingArea
/// 仍然活著：WebKit 在每次 mouseMoved / cursorUpdate 都會把游標設回
/// 箭頭，於是**看不見的 Notes canvas webview 蓋在 Daily 分隔線座標上、
/// 持續搶走 resize 游標**（症狀：能拖、游標閃一下又變回箭頭；詳見
/// `apple/docs/mac-resize-cursor-handoff.md`）。
///
/// 修法：AppKitEditor 讀這個 environment，inactive 時把 WKWebView 的
/// `isHidden` 設 true —— AppKit 層隱藏的 view 不參與 hitTest、tracking
/// area 也不再派送事件；它本來就 opacity 0，視覺零差異。
private struct NudgeMacDetailActiveKey: EnvironmentKey {
    static let defaultValue = true
}

public extension EnvironmentValues {
    var nudgeMacDetailActive: Bool {
        get { self[NudgeMacDetailActiveKey.self] }
        set { self[NudgeMacDetailActiveKey.self] = newValue }
    }
}
#endif

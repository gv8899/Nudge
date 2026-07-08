import SwiftUI

/// `.popover` 的 NudgeUI 標準包裝。
///
/// **為什麼需要**：NSPopover 在 macOS 是獨立視窗層級，app 根部
/// （NudgePreferencesApplier）注入的 `.environment(\.locale)`（in-app
/// 語言設定）傳不進 popover content —— 系統語言中文 + app 內語言 English
/// 時，popover 裡的 `Text(key, bundle: .module)` 會 fallback 回中文，
/// 出現同一畫面英文混中文（實際發生在任務列「…」選單）。
///
/// 這裡在呼叫端的 hierarchy 抓 locale、直接套在 popover content 上，
/// 查找就跟頁面一致。**新 popover 一律用這個，不要裸 `.popover`。**
private struct NudgePopoverModifier<PopContent: View>: ViewModifier {
    @Environment(\.locale) private var locale
    @Binding var isPresented: Bool
    let arrowEdge: Edge
    @ViewBuilder let popContent: () -> PopContent

    func body(content: Content) -> some View {
        content.popover(isPresented: $isPresented, arrowEdge: arrowEdge) {
            popContent()
                .environment(\.locale, locale)
        }
    }
}

public extension View {
    func nudgePopover<Content: View>(
        isPresented: Binding<Bool>,
        arrowEdge: Edge,
        @ViewBuilder content: @escaping () -> Content
    ) -> some View {
        modifier(NudgePopoverModifier(
            isPresented: isPresented,
            arrowEdge: arrowEdge,
            popContent: content
        ))
    }
}

import SwiftUI

/// Window-level modal overlay — dim backdrop（點擊取消）+ 置中、正確 chrome
/// 的 card。掛在 root view 的 `.overlay { }` 上。
///
/// **為什麼需要這個 component**：macOS `.sheet` 是 size-to-content、撐不到
/// 全視窗、沒有可點的「modal 外面」→ 做不到「點空白取消」。要這個行為只能
/// 自刻 window-level overlay。
///
/// **為什麼不讓各 modal 自己刻**：`.sheet` 免費附帶圓角 clip / z-order /
/// backdrop dim；改自刻 overlay 後這些全部要手動補，漏一個就壞（實際發生過：
/// 漏 `.clipShape` → modal 變直角矩形）。把 card chrome（背景 / 圓角 /
/// 陰影 / clip）在這裡一次做對，個別 modal 包進來就不可能漏。
///
/// 用法：
/// ```swift
/// .overlay {
///     if let req = request {
///         NudgeModalOverlay(onDismiss: { request = nil }) {
///             SomeModalContent(...)
///                 .frame(width: 480, height: 560)  // size 由 content 自訂
///         }
///     }
/// }
/// ```
struct NudgeModalOverlay<Content: View>: View {
    /// 點 backdrop（modal 以外的暗區）時呼叫。
    let onDismiss: () -> Void
    @ViewBuilder let content: () -> Content

    /// Modal card 圓角 — 跟 app 其他 modal（QuickAdd / MoveToDate sheet）
    /// 視覺一致。
    private let cornerRadius: CGFloat = 16

    init(onDismiss: @escaping () -> Void, @ViewBuilder content: @escaping () -> Content) {
        self.onDismiss = onDismiss
        self.content = content
    }

    var body: some View {
        ZStack {
            Color.black.opacity(0.3)
                .ignoresSafeArea()
                .contentShape(Rectangle())
                .onTapGesture(perform: onDismiss)

            content()
                // 背景 + clip + shadow 一次做對。clipShape 確保 content 內
                // 自己的直角 `.background` 也被裁成圓角（漏這層就是直角 bug）。
                .background(Color.nudgeBackground)
                .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
                .shadow(color: Color.black.opacity(0.25), radius: 24, x: 0, y: 12)
        }
        .transition(.opacity)
        .background(
            // ⎋ dismiss — 隱形 Button 承載 keyboardShortcut。任何用
            // NudgeModalOverlay 的 modal 都免費獲得 ⎋ 關閉行為。
            Button("", action: onDismiss)
                .keyboardShortcut(.cancelAction)
                .opacity(0)
                .frame(width: 0, height: 0)
                .accessibilityHidden(true)
        )
    }
}

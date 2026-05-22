import SwiftUI

/// 任務 row 的狀態標示 — 重複任務 (`repeat`) ＋ 有設提醒 (`bell`)。
/// 小、dim、無底色，對齊 Nudge「安靜但可靠」調性。兩個 icon 都用
/// `nudgeTextDim`（不上品牌色 / 不 hardcode hex），靠 icon 形狀區分。
///
/// 放在 task row 的 trailing 區、動作 icon (📅 / …) 的左邊（placement B）。
struct TaskStatusIndicators: View {
    let isRecurring: Bool
    let hasReminder: Bool

    var body: some View {
        if isRecurring || hasReminder {
            HStack(spacing: 8) {
                if isRecurring {
                    // arrow.triangle.2.circlepath — 跟 app 其他「重複」入口
                    // (TaskRowMenu「設成重複」/ TaskPopover 重複 badge) 同
                    // icon，內部一致。之前用 `repeat` 跟既有慣例不統一。
                    Image(systemName: "arrow.triangle.2.circlepath")
                        .accessibilityLabel(Text("daily.a11y.recurring", bundle: .module))
                }
                if hasReminder {
                    Image(systemName: "bell")
                        .accessibilityLabel(Text("daily.a11y.hasReminder", bundle: .module))
                }
            }
            // 16pt medium — 比動作 icon (19pt) 略小（status < action 的階層），
            // 但比之前 12pt regular 醒目、weight 跟動作 icon 對齊。
            .font(.system(size: 16, weight: .medium))
            .foregroundStyle(Color.nudgeTextDim)
        }
    }
}

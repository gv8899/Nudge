import SwiftUI
#if os(macOS)
import AppKit
#endif

/// 版本硬閘擋板 —— pop-out modal + 模糊背景，**不可關閉**（強制更新）。
///
/// 刻意不用 `NudgeModalOverlay`：那個是「點外面取消」的可關閉 modal，強制
/// 更新不能被關掉。這裡自帶 card chrome（背景 / 圓角 / 陰影，值對齊
/// NudgeModalOverlay）+ 模糊 backdrop。`onUpdate` 由 mac app 接 Sparkle 的
/// checkForUpdates（此 view 不依賴 Sparkle，保持跨平台可編譯）。
public struct ForcedUpdateOverlay: View {
    let onUpdate: () -> Void

    public init(onUpdate: @escaping () -> Void) {
        self.onUpdate = onUpdate
    }

    public var body: some View {
        ZStack {
            // 背景模糊由 mac app 對「app 內容」直接做 `.blur`（看得到、但是糊的）；
            // 這裡只放一層極淡 scrim 蓋滿整窗 —— 吃掉點擊（不可點外關閉），
            // 不遮住背後內容。
            Color.black.opacity(0.05)
                .ignoresSafeArea()
                .contentShape(Rectangle())

            // 置中 pop-out modal card。
            VStack(spacing: 16) {
                appIcon
                    .frame(width: 76, height: 76)

                Text("update.required.title", bundle: .module)
                    .font(.system(size: 20, weight: .bold))
                    .foregroundStyle(Color.nudgeForeground)

                Text("update.required.body", bundle: .module)
                    .font(.system(size: 13))
                    .foregroundStyle(Color.nudgeTextDim)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)

                Button(action: onUpdate) {
                    Text("update.required.button", bundle: .module)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Color.nudgePrimaryForeground)
                        .padding(.horizontal, 28)
                        .padding(.vertical, 11)
                        .background(Color.nudgePrimary, in: Capsule())
                }
                .buttonStyle(.plain)
                .padding(.top, 4)
            }
            .padding(32)
            .frame(maxWidth: 340)
            // chrome 一次做對（對齊 NudgeModalOverlay）：背景 → clip → shadow。
            .background(Color.nudgeBackground)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .shadow(color: Color.black.opacity(0.25), radius: 24, x: 0, y: 12)
        }
        .transition(.opacity)
    }

    /// Nudge app icon。macOS 直接取執行中 app 的 icon（已含圓角遮罩）；
    /// iOS 沒有等價簡便取法，退回 SF Symbol（此 overlay 目前只用於 macOS）。
    @ViewBuilder private var appIcon: some View {
        #if os(macOS)
        Image(nsImage: NSApplication.shared.applicationIconImage)
            .resizable()
            .aspectRatio(contentMode: .fit)
        #else
        Image(systemName: "arrow.down.circle.fill")
            .resizable()
            .aspectRatio(contentMode: .fit)
            .foregroundStyle(Color.nudgePrimary)
        #endif
    }
}

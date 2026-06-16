import SwiftUI

/// 版本硬閘擋板 —— 當 app 版本低於後端 `minMacBuild` 時蓋在最上層，
/// 強制使用者更新才能繼續用。`onUpdate` 由 mac app 接 Sparkle 的
/// checkForUpdates（這個 view 不依賴 Sparkle，保持跨平台可編譯）。
public struct ForcedUpdateOverlay: View {
    let onUpdate: () -> Void

    public init(onUpdate: @escaping () -> Void) {
        self.onUpdate = onUpdate
    }

    public var body: some View {
        ZStack {
            Color.nudgeBackground.ignoresSafeArea()

            VStack(spacing: 18) {
                Image(systemName: "arrow.down.circle.fill")
                    .font(.system(size: 52))
                    .foregroundStyle(Color.nudgePrimary)

                Text("update.required.title", bundle: .module)
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(Color.nudgeForeground)

                Text("update.required.body", bundle: .module)
                    .font(.system(size: 14))
                    .foregroundStyle(Color.nudgeTextDim)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)

                Button(action: onUpdate) {
                    Text("update.required.button", bundle: .module)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Color.nudgePrimaryForeground)
                        .padding(.horizontal, 28)
                        .padding(.vertical, 12)
                        .background(Color.nudgePrimary, in: Capsule())
                }
                .buttonStyle(.plain)
                .padding(.top, 4)
            }
            .frame(maxWidth: 420)
            .padding(40)
        }
    }
}

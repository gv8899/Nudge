import SwiftUI

/// First-run welcome 卡片內容 —— 放進共用 `NudgeModalOverlay`（backdrop /
/// 圓角 / 陰影 / z-order 由 overlay 負責，這裡只排內容）。
///
/// 內容鏡像 web `welcome-card`：標題 + 一句 intro + 三點（任務 / 卡片 /
/// 重複與提醒）+ 主要 CTA「開始使用」。另有次要「看看範例卡片」動作。
struct OnboardingWelcomeView: View {
    /// 主要 CTA —— 關閉並標記 welcome 已看過。
    let onStart: () -> Void
    /// 次要動作 —— 關閉並切到 Cards 分頁（mac 有效；iOS 目前無 tab-switch
    /// 監聽 → 僅關閉）。
    let onViewCards: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("onboarding.welcome.title", bundle: .module)
                .nudgeFont(.columnDetailTitle)
                .foregroundStyle(Color.nudgeForeground)

            Text("onboarding.welcome.intro", bundle: .module)
                .nudgeFont(.emptyStateBody)
                .foregroundStyle(Color.nudgeTextDim)
                .fixedSize(horizontal: false, vertical: true)

            VStack(alignment: .leading, spacing: 12) {
                bullet(icon: "checkmark.circle", key: "onboarding.welcome.pointTasks")
                bullet(icon: "arrow.uturn.forward", key: "onboarding.welcome.pointRollover")
                bullet(icon: "doc.text", key: "onboarding.welcome.pointCards")
            }
            .padding(.vertical, 2)

            VStack(spacing: 10) {
                NudgeButton("onboarding.welcome.cta", variant: .primary, action: onStart)
                    .frame(maxWidth: .infinity)

                Button(action: onViewCards) {
                    Text("onboarding.welcome.viewCards", bundle: .module)
                        .nudgeFont(.inlineButtonLabel)
                        .foregroundStyle(Color.nudgePrimary)
                }
                .buttonStyle(.plain)
            }
            .padding(.top, 4)
            .frame(maxWidth: .infinity)
        }
        .padding(24)
    }

    private func bullet(icon: String, key: LocalizedStringKey) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Color.nudgePrimary)
                .frame(width: 22, alignment: .center)
            Text(key, bundle: .module)
                .nudgeFont(.rowBody)
                .foregroundStyle(Color.nudgeForeground)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

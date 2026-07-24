import SwiftUI
import NudgeCore

/// Mac 硬付費牆 —— root 層以「取代內容」方式呈現（非 modal）。
/// 不在 app 內結帳：CTA 走 OTT 手遞開預設瀏覽器到 web /paywall。
/// 顯示條件見 AuthRepository.shouldShowMacPaywall（flags.mac + 無權 + 離線寬限）。
public struct PaywallView: View {
    @Bindable var auth: AuthRepository
    @Environment(\.locale) private var locale

    @State private var checkoutBusy = false
    @State private var checkoutFailed = false
    @State private var refreshBusy = false
    @State private var promoOpen = false
    @State private var promoCode = ""
    @State private var promoBusy = false
    @State private var promoMessage: String?
    @State private var promoFailed = false

    public init(auth: AuthRepository) {
        self.auth = auth
    }

    public var body: some View {
        VStack(spacing: 0) {
            Spacer(minLength: 40)

            VStack(spacing: 12) {
                Text("billing.paywall.title", bundle: .module)
                    .nudgeFont(.dateTitle)
                    .foregroundStyle(Color.nudgeForeground)
                Text("billing.paywall.subtitle", bundle: .module)
                    .nudgeFont(.rowBody)
                    .foregroundStyle(Color.nudgeTextDim)
            }

            VStack(alignment: .leading, spacing: 10) {
                point(icon: "checkmark.circle", key: "billing.paywall.point1")
                point(icon: "calendar", key: "billing.paywall.point2")
                point(icon: "arrow.triangle.2.circlepath", key: "billing.paywall.point3")
            }
            .padding(.top, 28)

            VStack(spacing: 10) {
                NudgeButton("billing.paywall.ctaBuy", variant: .primary, action: openCheckout)
                    .disabled(checkoutBusy)
                if checkoutFailed {
                    Text("billing.paywall.notConfigured", bundle: .module)
                        .nudgeFont(.errorMeta)
                        .foregroundStyle(Color.nudgeTextDim)
                }
                Text("billing.paywall.trialNote", bundle: .module)
                    .nudgeFont(.rowMeta)
                    .foregroundStyle(Color.nudgeTextDim)
                    .multilineTextAlignment(.center)
            }
            .padding(.top, 28)

            // 次要動作：已付款重刷 / 兌換碼 / 登出
            VStack(spacing: 12) {
                Button {
                    Task {
                        refreshBusy = true
                        await auth.refreshEntitlement()
                        refreshBusy = false
                    }
                } label: {
                    Text("billing.paywall.paidDone", bundle: .module)
                        .nudgeFont(.inlineButtonLabel)
                        .foregroundStyle(Color.nudgeTextDim)
                }
                .buttonStyle(.plain)
                .disabled(refreshBusy)

                if promoOpen {
                    promoInput
                } else {
                    Button {
                        promoOpen = true
                    } label: {
                        Text("billing.paywall.havePromo", bundle: .module)
                            .nudgeFont(.inlineButtonLabel)
                            .foregroundStyle(Color.nudgeTextDim)
                    }
                    .buttonStyle(.plain)
                }

                Button {
                    Task { await auth.logout() }
                } label: {
                    Text("settings.logout.button", bundle: .module)
                        .nudgeFont(.inlineButtonLabel)
                        .foregroundStyle(Color.nudgeTextDim)
                }
                .buttonStyle(.plain)
            }
            .padding(.top, 32)

            Spacer(minLength: 40)
        }
        .frame(maxWidth: 420)
        .padding(.horizontal, 32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.nudgeBackground)
    }

    private func point(icon: String, key: LocalizedStringKey) -> some View {
        HStack(spacing: 10) {
            Image(systemName: icon)
                .foregroundStyle(Color.nudgePrimary)
            Text(key, bundle: .module)
                .nudgeFont(.rowBody)
                .foregroundStyle(Color.nudgeForeground)
        }
    }

    private var promoInput: some View {
        VStack(spacing: 6) {
            HStack(spacing: 8) {
                TextField(
                    nudgeLocalized("billing.redeem.placeholder", locale: locale),
                    text: $promoCode
                )
                .textFieldStyle(.roundedBorder)
                .frame(maxWidth: 200)
                Button {
                    redeemPromo()
                } label: {
                    Text("billing.redeem.button", bundle: .module)
                        .nudgeFont(.inlineButtonLabel)
                        .foregroundStyle(Color.nudgePrimary)
                }
                .buttonStyle(.plain)
                .disabled(promoBusy || promoCode.isEmpty)
            }
            if let promoMessage {
                Text(verbatim: promoMessage)
                    .nudgeFont(.errorMeta)
                    .foregroundStyle(promoFailed ? Color.nudgeDestructive : Color.nudgePrimary)
            }
        }
    }

    private func openCheckout() {
        guard !checkoutBusy else { return }
        checkoutBusy = true
        checkoutFailed = false
        Task {
            defer { checkoutBusy = false }
            do {
                let url = try await auth.requestCheckoutURL()
                #if os(macOS)
                NSWorkspace.shared.open(url)
                #else
                _ = url // iOS 此輪無結帳入口（Phase 2 IAP）
                #endif
            } catch {
                checkoutFailed = true
            }
        }
    }

    private func redeemPromo() {
        guard !promoBusy else { return }
        promoBusy = true
        promoMessage = nil
        Task {
            defer { promoBusy = false }
            do {
                let days = try await auth.redeemPromo(code: promoCode.trimmingCharacters(in: .whitespaces))
                promoFailed = false
                promoMessage = String(
                    format: nudgeLocalized("billing.redeem.success", locale: locale),
                    days
                )
            } catch {
                promoFailed = true
                promoMessage = nudgeLocalized("billing.redeem.failed", locale: locale)
            }
        }
    }
}

import SwiftUI
import AuthenticationServices
import NudgeCore

#if os(iOS)
import UIKit
#endif

public struct LoginView: View {
    @Environment(\.colorScheme) private var colorScheme
    @State private var isLoading = false
    @State private var errorMessage: String?
    #if os(iOS)
    // 自繪 Apple 按鈕手動起 ASAuthorizationController 的橋接（見 appleButton）。
    @State private var appleCoordinator = AppleSignInCoordinator()
    #endif

    /// Closure form 讓 platform target 注入自己的 Google SDK + AuthRepository。
    public var onLoginTapped: () async -> Result<Void, Error>
    /// Sign in with Apple：LoginView 取出 credential，把 identityToken（+ 首次
    /// 的名字/email）交給平台殼層換 token。
    public var onAppleLogin: (_ identityToken: String, _ fullName: String?, _ email: String?) async -> Result<Void, Error>
    /// macOS 的 web 中繼 Apple 登入 — 殼層完成整個流程（開瀏覽器→拿 app
    /// JWT→寫 auth state），View 只觸發。nil = 不顯示按鈕（iOS 用不到）。
    public var onAppleWebLogin: (() async -> Result<Void, Error>)?

    public init(
        onLoginTapped: @escaping () async -> Result<Void, Error>,
        onAppleLogin: @escaping (_ identityToken: String, _ fullName: String?, _ email: String?) async -> Result<Void, Error>,
        onAppleWebLogin: (() async -> Result<Void, Error>)? = nil
    ) {
        self.onLoginTapped = onLoginTapped
        self.onAppleLogin = onAppleLogin
        self.onAppleWebLogin = onAppleWebLogin
    }

    public var body: some View {
        VStack(spacing: 0) {
            Spacer(minLength: 24)

            // Brand block: icon + wordmark + tagline.
            // 三層紙＋N＋赭紅 icon 直接用 PNG（避免 SwiftUI render 跟原 asset 對不上）。
            VStack(spacing: 20) {
                Image("LoginIcon", bundle: .module)
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(width: 100, height: 100)
                    .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
                    .shadow(color: Color.nudgeForeground.opacity(0.08), radius: 12, x: 0, y: 6)

                VStack(spacing: 8) {
                    Text(verbatim: "Nudge")
                        .font(.largeTitle.weight(.semibold))
                        .foregroundStyle(Color.nudgeForeground)
                    // Geist Sans / SF — 現代無襯線。輕量字重 + tracking
                    // 拉開呼吸，避免跟上面 wordmark 撞密度。
                    Text("login.tagline", bundle: .module)
                        .font(.system(size: 15, weight: .light))
                        .tracking(0.6)
                        .foregroundStyle(Color.nudgeTextDim)
                }
            }

            Spacer()

            // Auth buttons. Google 在上（目前唯一可用的方式）；
            // Apple 在下、disabled + opacity 0.4 — 保留位置等之後 policy 啟用。
            //
            // Mac 視窗寬時 .frame(maxWidth: .infinity) 的 button 會被
            // 撐到視窗整條寬，看起來像 banner 而不是 button。限縮 400pt
            // max-width 並置中，回到「button」尺度；iOS 維持原本全寬
            // (扣 32pt padding)。
            VStack(spacing: 12) {
                googleButton
                // iOS：原生 SignInWithAppleButton（App Store 4.8）。
                // macOS：web 中繼流程的自訂按鈕（原生 SIWA 是 restricted
                // entitlement，Developer ID 分發會 AMFI SIGKILL → 改開瀏覽器
                // 走伺服器中繼，見 AppleSignInService+macOS）。
                #if os(iOS)
                appleButton
                #else
                if onAppleWebLogin != nil {
                    macAppleButton
                }
                #endif

                if let errorMessage {
                    Text(verbatim: errorMessage)
                        .font(.footnote)
                        .foregroundStyle(Color.nudgeDestructive)
                        .multilineTextAlignment(.center)
                        .padding(.top, 4)
                }
            }
            #if os(macOS)
            .frame(maxWidth: 400)
            .padding(.horizontal, 32)
            .frame(maxWidth: .infinity)
            #else
            .padding(.horizontal, 32)
            #endif

            Spacer().frame(height: 32)

            if let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String {
                Text(verbatim: "v\(version)")
                    .font(.caption2)
                    .foregroundStyle(Color.nudgeTextDim.opacity(0.7))
                    .padding(.bottom, 16)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .frame(minWidth: 360, minHeight: 480)
        .background(Color.nudgeBackground)
    }

    // MARK: - Buttons

    #if os(iOS)
    // 自繪 Apple 按鈕（非原生 SignInWithAppleButton）——原生是系統/UIKit 元件、
    // 不讀 SwiftUI environment，故不吃 in-app 注入的 `\.locale`（LocaleOverride
    // 只作用 SwiftUI view tree），換語言時文案不跟著變。改自繪、用
    // Text(.module) 才吃 i18n（與 Google 按鈕、macOS macAppleButton 一致）；
    // 點擊手動起 ASAuthorizationController 走 iOS 原生登入，credential 交回既有
    // handleAppleResult。樣式依 Apple HIG：淺色黑底白字、深色白底黑字、Capsule。
    private var appleButton: some View {
        Button(action: startAppleSignIn) {
            HStack(spacing: 10) {
                Image(systemName: "apple.logo")
                    .font(.system(size: 18, weight: .medium))
                Text("login.signInWithApple", bundle: .module)
                    .font(.body.weight(.medium))
            }
            // Apple HIG 品牌按鈕例外，不走 token。
            .foregroundStyle(colorScheme == .dark ? Color.black : Color.white) // nudge:allow-color
            .frame(maxWidth: .infinity)
            .frame(height: 50)
            .contentShape(Capsule())
            .background(
                Capsule().fill(colorScheme == .dark ? Color.white : Color.black) // nudge:allow-color
            )
        }
        .buttonStyle(.plain)
        .disabled(isLoading)
    }

    private func startAppleSignIn() {
        appleCoordinator.onResult = { result in
            handleAppleResult(result)
        }
        appleCoordinator.performRequest()
    }

    private func handleAppleResult(_ result: Result<ASAuthorization, any Error>) {
        switch result {
        case .failure(let error):
            // 使用者自己取消不算錯、不顯示紅字。
            if let asError = error as? ASAuthorizationError, asError.code == .canceled {
                return
            }
            errorMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        case .success(let authorization):
            guard
                let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
                let tokenData = credential.identityToken,
                let identityToken = String(data: tokenData, encoding: .utf8)
            else {
                errorMessage = nudgeLocalized("login.appleFailed", locale: .current)
                return
            }
            // 首次授權才有名字；用系統 formatter 組顯示名，空字串視為無。
            let fullName: String? = credential.fullName.flatMap { components in
                let formatted = PersonNameComponentsFormatter().string(from: components)
                return formatted.isEmpty ? nil : formatted
            }
            let email = credential.email
            Task {
                isLoading = true
                errorMessage = nil
                let r = await onAppleLogin(identityToken, fullName, email)
                isLoading = false
                if case .failure(let error) = r {
                    errorMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
                }
            }
        }
    }
    #endif

    #if os(macOS)
    private var macAppleButton: some View {
        Button {
            guard let onAppleWebLogin else { return }
            Task {
                isLoading = true
                errorMessage = nil
                let result = await onAppleWebLogin()
                isLoading = false
                if case .failure(let error) = result {
                    errorMessage = (error as? LocalizedError)?.errorDescription
                        ?? error.localizedDescription
                }
            }
        } label: {
            HStack(spacing: 10) {
                Image(systemName: "apple.logo")
                    .nudgeFont(.rowTitleEmphasized)
                Text("login.signInWithApple", bundle: .module)
                    .nudgeFont(.rowTitleEmphasized)
            }
            // Apple HIG 官方樣式：淺色模式黑底白字、深色模式白底黑字。
            // 品牌按鈕例外，不走 token。
            .foregroundStyle(colorScheme == .dark ? Color.black : Color.white) // nudge:allow-color
            .frame(maxWidth: .infinity)
            .frame(height: 50)
            .contentShape(Capsule())
            .background(
                Capsule().fill(colorScheme == .dark ? Color.white : Color.black) // nudge:allow-color
            )
        }
        .buttonStyle(.plain)
        .disabled(isLoading)
    }
    #endif

    private var googleButton: some View {
        Button(action: handleTap) {
            HStack(spacing: 10) {
                if isLoading {
                    ProgressView()
                        .scaleEffect(0.8)
                } else {
                    // 官方 Google G（xcassets 向量轉出的 1x/2x/3x），
                    // 與 web 登入頁同一份 SVG 來源。
                    Image("GoogleLogo", bundle: .module)
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .frame(width: 18, height: 18)
                }
                Text(isLoading ? "login.signingIn" : "login.signInWithGoogle", bundle: .module)
                    .font(.body.weight(.medium))
            }
            .foregroundStyle(Color.nudgeForeground)
            .frame(maxWidth: .infinity)
            .frame(height: 50)
            .contentShape(Capsule())
            .background(
                Capsule().stroke(Color.nudgeBorder, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .disabled(isLoading)
    }

    private func handleTap() {
        Task {
            isLoading = true
            errorMessage = nil
            let result = await onLoginTapped()
            isLoading = false
            if case .failure(let error) = result {
                errorMessage = (error as? LocalizedError)?.errorDescription
                    ?? error.localizedDescription
            }
        }
    }
}

#if os(iOS)
/// 自繪 Apple 按鈕改走的 iOS 原生 SIWA 流程橋接：起 ASAuthorizationController、
/// 把 delegate callback 轉成 Result 交回 View 的 handleAppleResult。
/// （原生 SignInWithAppleButton 不吃 in-app `\.locale`，故 LoginView 改自繪。）
final class AppleSignInCoordinator: NSObject, ASAuthorizationControllerDelegate,
    ASAuthorizationControllerPresentationContextProviding {
    var onResult: ((Result<ASAuthorization, any Error>) -> Void)?

    func performRequest() {
        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = [.fullName, .email]
        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = self
        controller.presentationContextProvider = self
        controller.performRequests()
    }

    func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithAuthorization authorization: ASAuthorization
    ) {
        onResult?(.success(authorization))
    }

    func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithError error: any Error
    ) {
        onResult?(.failure(error))
    }

    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        let keyWindow = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
            .first { $0.isKeyWindow }
        return keyWindow ?? ASPresentationAnchor()
    }
}
#endif


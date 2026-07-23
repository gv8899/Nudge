import SwiftUI
import AuthenticationServices
import NudgeCore

public struct LoginView: View {
    @Environment(\.colorScheme) private var colorScheme
    @State private var isLoading = false
    @State private var errorMessage: String?

    /// Closure form 讓 platform target 注入自己的 Google SDK + AuthRepository。
    public var onLoginTapped: () async -> Result<Void, Error>
    /// Sign in with Apple：LoginView 取出 credential，把 identityToken（+ 首次
    /// 的名字/email）交給平台殼層換 token。
    public var onAppleLogin: (_ identityToken: String, _ fullName: String?, _ email: String?) async -> Result<Void, Error>

    public init(
        onLoginTapped: @escaping () async -> Result<Void, Error>,
        onAppleLogin: @escaping (_ identityToken: String, _ fullName: String?, _ email: String?) async -> Result<Void, Error>
    ) {
        self.onLoginTapped = onLoginTapped
        self.onAppleLogin = onAppleLogin
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
                // Sign in with Apple 只在 iOS（App Store 4.8 要求）。macOS 走
                // Developer ID 分發、不受 App Store 審查、且 applesignin 是
                // restricted entitlement（要嵌 provisioning profile，否則 AMFI
                // launch SIGKILL）→ macOS 先不放，維持 Google 登入。
                #if os(iOS)
                appleButton
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
    private var appleButton: some View {
        // 官方 SignInWithAppleButton（AuthenticationServices）— 樣式符合 Apple
        // HIG（黑/白依 colorScheme）。onRequest 要 .fullName/.email（只有首次
        // 授權會真的回），onCompletion 取 identityToken 交給平台殼層換 token。
        SignInWithAppleButton(.signIn) { request in
            request.requestedScopes = [.fullName, .email]
        } onCompletion: { result in
            handleAppleResult(result)
        }
        .signInWithAppleButtonStyle(colorScheme == .dark ? .white : .black)
        .frame(height: 50)
        .clipShape(Capsule())
        .allowsHitTesting(!isLoading)
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


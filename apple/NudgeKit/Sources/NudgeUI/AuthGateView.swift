import SwiftUI
import NudgeCore

/// 根據 AuthRepository.status 切換顯示 LoginView 或 app 內容。
public struct AuthGateView<Content: View>: View {
    @Bindable var auth: AuthRepository
    @ViewBuilder let content: () -> Content
    let onLoginRequested: () async -> Result<Void, Error>
    /// Sign in with Apple：LoginView 取出 credential 後把 identityToken（+ 首次
    /// 的名字/email）交給平台殼層換 token。
    let onAppleLoginRequested: (_ identityToken: String, _ fullName: String?, _ email: String?) async -> Result<Void, Error>

    public init(
        auth: AuthRepository,
        onLoginRequested: @escaping () async -> Result<Void, Error>,
        onAppleLoginRequested: @escaping (_ identityToken: String, _ fullName: String?, _ email: String?) async -> Result<Void, Error>,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.auth = auth
        self.onLoginRequested = onLoginRequested
        self.onAppleLoginRequested = onAppleLoginRequested
        self.content = content
    }

    public var body: some View {
        switch auth.status {
        case .unknown:
            ProgressView()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        case .authenticated:
            content()
        case .unauthenticated:
            LoginView(
                onLoginTapped: onLoginRequested,
                onAppleLogin: onAppleLoginRequested
            )
        }
    }
}

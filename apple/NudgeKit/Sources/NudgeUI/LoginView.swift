import SwiftUI
import NudgeCore

public struct LoginView: View {
    @State private var isLoading = false
    @State private var errorMessage: String?

    /// Closure form 讓 platform target 注入自己的 Google SDK + AuthRepository。
    public var onLoginTapped: () async -> Result<Void, Error>

    public init(onLoginTapped: @escaping () async -> Result<Void, Error>) {
        self.onLoginTapped = onLoginTapped
    }

    public var body: some View {
        VStack(spacing: 24) {
            Spacer()
            Image(systemName: "checkmark.circle.fill")
                .resizable()
                .frame(width: 72, height: 72)
                .foregroundStyle(.tint)
            Text("Nudge")
                .font(.largeTitle.weight(.semibold))
            Text("Sign in to get started")
                .foregroundStyle(.secondary)
            Spacer()
            Button(action: handleTap) {
                HStack {
                    if isLoading {
                        ProgressView()
                            .scaleEffect(0.8)
                    }
                    Text(isLoading ? "Signing in…" : "Sign in with Google")
                        .font(.body.weight(.medium))
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(Color.secondary.opacity(0.4), lineWidth: 1)
                )
            }
            .buttonStyle(.plain)
            .disabled(isLoading)
            .padding(.horizontal, 40)

            if let errorMessage {
                Text(errorMessage)
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 40)
            }

            Spacer().frame(height: 40)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .frame(minWidth: 360, minHeight: 480)
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

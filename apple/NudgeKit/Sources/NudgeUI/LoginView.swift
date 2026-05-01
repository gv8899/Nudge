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
                appleButton

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

    private var appleButton: some View {
        Button(action: {}) {
            HStack(spacing: 8) {
                Image(systemName: "apple.logo")
                    .font(.body.weight(.medium))
                Text("login.signInWithApple", bundle: .module)
                    .font(.body.weight(.medium))
            }
            .foregroundStyle(Color.nudgePrimaryForeground)
            .frame(maxWidth: .infinity)
            .frame(height: 50)
            .contentShape(Capsule())
            .background(
                Capsule().fill(Color.nudgeForeground)
            )
        }
        .buttonStyle(.plain)
        .opacity(0.4)
        .disabled(true)
    }

    private var googleButton: some View {
        Button(action: handleTap) {
            HStack(spacing: 10) {
                if isLoading {
                    ProgressView()
                        .scaleEffect(0.8)
                } else {
                    GoogleGMark()
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

/// Google G mark — 4 色弧 + 中央橫條。SwiftUI Canvas 拼出來，
/// 不靠 SF Symbol 也不需要額外圖檔。色值維持 Google brand guideline →
/// 加 `nudge:allow-color` 跳過 token lint。
private struct GoogleGMark: View {
    // SwiftUI Angle: 0° = 東、90° = 南（順時針）。
    private let blue   = Color(red:  66 / 255, green: 133 / 255, blue: 244 / 255) // nudge:allow-color
    private let red    = Color(red: 234 / 255, green:  67 / 255, blue:  53 / 255) // nudge:allow-color
    private let yellow = Color(red: 251 / 255, green: 188 / 255, blue:   4 / 255) // nudge:allow-color
    private let green  = Color(red:  52 / 255, green: 168 / 255, blue:  83 / 255) // nudge:allow-color

    var body: some View {
        Canvas { ctx, size in
            let w = size.width
            let h = size.height
            let strokeW = w * 0.22
            let center = CGPoint(x: w / 2, y: h / 2)
            let radius = (w - strokeW) / 2

            let segments: [(start: Angle, end: Angle, color: Color)] = [
                (.degrees(-20),  .degrees(90),  green),
                (.degrees(90),   .degrees(200), yellow),
                (.degrees(200),  .degrees(310), red),
                (.degrees(310),  .degrees(360), blue)
            ]

            for seg in segments {
                var path = Path()
                path.addArc(
                    center: center,
                    radius: radius,
                    startAngle: seg.start,
                    endAngle: seg.end,
                    clockwise: false
                )
                ctx.stroke(path, with: .color(seg.color), style: StrokeStyle(lineWidth: strokeW, lineCap: .butt))
            }

            // 中央橫條（藍）— 從圓心往右接到弧內緣。
            let barHeight = strokeW * 0.95
            let barRect = CGRect(
                x: w / 2,
                y: h / 2 - barHeight / 2,
                width: w / 2 - strokeW / 2 + 0.5,
                height: barHeight
            )
            ctx.fill(Path(barRect), with: .color(blue))
        }
    }
}

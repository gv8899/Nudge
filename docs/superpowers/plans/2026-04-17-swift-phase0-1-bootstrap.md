# Swift Phase 0 + 1：骨架與基礎建設 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 砍掉 Flutter `/mobile/`，在 `/apple/` 建立 iOS + macOS 雙 target 的 Swift 專案，完成 Google 登入 → Bearer token → 自動登入 → 空殼 tab / sidebar 的完整 auth flow。

**Architecture:** Monorepo 下 `/apple/` 放 Xcode workspace，內含 `Nudge-iOS` 與 `Nudge-macOS` 兩個 App target，與 `NudgeKit` 本地 Swift Package（含 `NudgeCore` / `NudgeData` / `NudgeUI` 三個 module）。單向相依：`UI → Data → Core`。Auth 走現有 `/api/auth/mobile` endpoint，token 存 Keychain。

**Tech Stack:** Swift 6、SwiftUI、Swift Package Manager、Swift Testing（`@Test`）、`URLSession` + `async/await`、SwiftData、`ASWebAuthenticationSession`、Google Sign-In SDK for iOS/macOS、`KeychainAccess` 或純 `SecItem` API。

**Parent Spec:** `docs/superpowers/specs/2026-04-17-swift-rewrite-design.md`

**Scope 限制**：
- 本 plan 只包含 Spec 的 **Phase 0 + Phase 1**
- Phase 2-7 各自有獨立 plan，不在此範圍
- 完成標準：iOS + macOS 都能 Google 登入 → 看到空殼 tab / sidebar → 重啟 app 自動登入 → 登出回到登入頁

---

## File Structure

新增的檔案與職責：

**Repo 層**
- Delete: `/mobile/`（整個資料夾）

**Xcode Project**
- Create: `/apple/Nudge.xcworkspace`（Xcode workspace）
- Create: `/apple/Nudge.xcodeproj`（Xcode project，含兩個 App target + 一個 SPM 本地 package）
- Create: `/apple/Nudge-iOS/NudgeiOSApp.swift` — iOS App entry
- Create: `/apple/Nudge-iOS/Info.plist`
- Create: `/apple/Nudge-iOS/Assets.xcassets`
- Create: `/apple/Nudge-iOS/Nudge-iOS.entitlements`
- Create: `/apple/Nudge-macOS/NudgeMacApp.swift` — macOS App entry
- Create: `/apple/Nudge-macOS/Info.plist`
- Create: `/apple/Nudge-macOS/Assets.xcassets`
- Create: `/apple/Nudge-macOS/Nudge-macOS.entitlements`

**NudgeKit Swift Package**
- Create: `/apple/NudgeKit/Package.swift`
- Create: `/apple/NudgeKit/Sources/NudgeCore/APIError.swift` — error type
- Create: `/apple/NudgeKit/Sources/NudgeCore/APIConfiguration.swift` — base URL + env
- Create: `/apple/NudgeKit/Sources/NudgeCore/APIClient.swift` — protocol + URLSession impl
- Create: `/apple/NudgeKit/Sources/NudgeCore/AuthDTO.swift` — Codable DTOs
- Create: `/apple/NudgeKit/Sources/NudgeCore/UserDTO.swift` — Codable user DTO
- Create: `/apple/NudgeKit/Sources/NudgeCore/KeychainStorage.swift` — SecItem wrapper
- Create: `/apple/NudgeKit/Sources/NudgeCore/AuthRepository.swift` — login/logout/me orchestration
- Create: `/apple/NudgeKit/Sources/NudgeData/ModelContainer+Nudge.swift` — SwiftData setup
- Create: `/apple/NudgeKit/Sources/NudgeUI/LoginView.swift` — shared SwiftUI login screen
- Create: `/apple/NudgeKit/Sources/NudgeUI/AuthGateView.swift` — switch between Login / App content
- Create: `/apple/NudgeKit/Sources/NudgeUI/PlatformRootView.swift` — iOS TabView / macOS NavigationSplitView

**Tests**
- Create: `/apple/NudgeKit/Tests/NudgeCoreTests/APIClientTests.swift`
- Create: `/apple/NudgeKit/Tests/NudgeCoreTests/AuthDTOTests.swift`
- Create: `/apple/NudgeKit/Tests/NudgeCoreTests/KeychainStorageTests.swift`
- Create: `/apple/NudgeKit/Tests/NudgeCoreTests/AuthRepositoryTests.swift`
- Create: `/apple/NudgeKit/Tests/NudgeCoreTests/Helpers/MockURLProtocol.swift`

**Platform-specific**
- Create: `/apple/Nudge-iOS/GoogleSignInService+iOS.swift`
- Create: `/apple/Nudge-macOS/GoogleSignInService+macOS.swift`

**.gitignore**
- Modify: `/.gitignore` — 加入 `xcuserdata/`、`*.xcuserstate`、`.DS_Store`（如未加過）

---

## Prerequisites（開工前手動一次完成）

- 確認本機已安裝 **Xcode 16** 以上（iOS 18 SDK / macOS 15 SDK 必須）
- 確認有 Apple Developer Program 帳號（Developer ID 簽章需要）
- Google Cloud Console 建立 OAuth 2.0 Client ID：
  - **iOS client**：Bundle ID `tw.nudge.app`（沿用舊 Flutter app 的 OAuth client，不新建）
  - **macOS client**：Bundle ID `tw.nudge.mac`（需新建）
  - 記下兩個 client ID（Phase 1 會用到）
  - Web 版已有的 OAuth client 不變動
- 確認 `nudge.tw`（production）和 `http://localhost:3000`（dev）的 `/api/auth/mobile` endpoint 有跑

---

# Phase 0：骨架

---

### Task 0.1: 砍掉 `/mobile/`

**Files:**
- Delete: `/mobile/`（整個資料夾）
- Modify: `/README.md`（如有提到 Flutter 段落）
- Modify: `/CLAUDE.md` 或 `/AGENTS.md`（如有 Flutter 相關規則）

- [ ] **Step 1: 確認 Flutter 專案可安全刪除**

Run:
```bash
cd /Users/mike/Documents/nudge
git status
```
Expected: working tree clean。若不是，先 commit 或 stash 目前變更。

- [ ] **Step 2: 刪除 Flutter 專案**

Run:
```bash
cd /Users/mike/Documents/nudge
rm -rf mobile/
```
Expected: `mobile/` 消失。

- [ ] **Step 3: 檢查 README / AGENTS.md 是否有 Flutter 相關描述需要移除**

Read `/Users/mike/Documents/nudge/README.md` 和 `/Users/mike/Documents/nudge/AGENTS.md`，搜尋 "Flutter"、"mobile" 相關段落。如有提到 Flutter app 的段落，改成「iOS + macOS app（Swift）」或直接刪除段落。

（若沒找到相關段落，跳過編輯。）

- [ ] **Step 4: Commit**

Run:
```bash
cd /Users/mike/Documents/nudge
git add -A
git commit -m "$(cat <<'EOF'
chore: remove Flutter mobile app in preparation for Swift rewrite

Ref spec: docs/superpowers/specs/2026-04-17-swift-rewrite-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```
Expected: commit 成功，working tree clean。

---

### Task 0.2: 建立 `/apple/` 資料夾結構與 Xcode Workspace

**Files:**
- Create: `/apple/`
- Create: `/apple/Nudge.xcworkspace`
- Create: `/apple/Nudge.xcodeproj`

**說明**：Xcode workspace / project 必須透過 Xcode GUI 建立。以下步驟描述點擊流程。

- [ ] **Step 1: 建立 `/apple/` 資料夾**

Run:
```bash
mkdir -p /Users/mike/Documents/nudge/apple
```
Expected: 空資料夾建立成功。

- [ ] **Step 2: 用 Xcode 建立 iOS App project**

開啟 Xcode → File → New → Project → **iOS** tab → **App** → Next。

填寫：
- Product Name: `Nudge-iOS`
- Team: 你的 Apple Developer team
- Organization Identifier: `tw.nudge`（最終 Bundle ID 會是 `tw.nudge.app`，但 iOS target 用 `Nudge-iOS`，請改 bundle ID 為 `tw.nudge.app`）
- Interface: **SwiftUI**
- Language: **Swift**
- Storage: **None**（先不用 SwiftData，Phase 1 再加）
- 勾選 "Include Tests"：**不勾**（我們用 SPM tests）

Next → 存到 `/Users/mike/Documents/nudge/apple/`。

Expected: 產生 `/apple/Nudge-iOS.xcodeproj` 與 `/apple/Nudge-iOS/`。

- [ ] **Step 3: 建立 macOS App project**

Xcode → File → New → Project → **macOS** tab → **App** → Next。

填寫：
- Product Name: `Nudge-macOS`
- Team: 同上
- Organization Identifier: `tw.nudge`，改 Bundle ID 為 `tw.nudge.mac`
- Interface: **SwiftUI**
- Language: **Swift**
- Storage: **None**
- 勾選 "Include Tests"：**不勾**

Next → 存到 `/Users/mike/Documents/nudge/apple/`。

Expected: 產生 `/apple/Nudge-macOS.xcodeproj` 與 `/apple/Nudge-macOS/`。

- [ ] **Step 4: 合併兩個 project 成一個 workspace**

Xcode → File → New → Workspace → 存成 `/Users/mike/Documents/nudge/apple/Nudge.xcworkspace`。

開啟這個 workspace，左下 `+` → Add Files to "Nudge" → 選 `Nudge-iOS.xcodeproj` 和 `Nudge-macOS.xcodeproj` 加進去。

關閉個別的 xcodeproj 視窗，只用 workspace。

Expected: Workspace 內能看到兩個 project，各自展開有自己的檔案樹。

- [ ] **Step 5: Commit 初始 scaffolding**

Run:
```bash
cd /Users/mike/Documents/nudge
# 檢查 .gitignore 有含 xcuserdata
grep -q "xcuserdata" .gitignore || echo "xcuserdata/
*.xcuserstate
.DS_Store" >> .gitignore

git add apple/ .gitignore
git commit -m "$(cat <<'EOF'
feat(apple): init Xcode workspace with iOS + macOS targets

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```
Expected: commit 成功。

---

### Task 0.3: 建立 NudgeKit 本地 Swift Package

**Files:**
- Create: `/apple/NudgeKit/Package.swift`
- Create: `/apple/NudgeKit/Sources/NudgeCore/NudgeCore.swift`（placeholder 讓 module 編得起來）
- Create: `/apple/NudgeKit/Sources/NudgeData/NudgeData.swift`（placeholder）
- Create: `/apple/NudgeKit/Sources/NudgeUI/NudgeUI.swift`（placeholder）
- Create: `/apple/NudgeKit/Tests/NudgeCoreTests/SmokeTests.swift`

- [ ] **Step 1: 建立 Package.swift**

Create `/apple/NudgeKit/Package.swift`:
```swift
// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "NudgeKit",
    platforms: [
        .iOS(.v18),
        .macOS(.v15),
    ],
    products: [
        .library(name: "NudgeCore", targets: ["NudgeCore"]),
        .library(name: "NudgeData", targets: ["NudgeData"]),
        .library(name: "NudgeUI", targets: ["NudgeUI"]),
    ],
    targets: [
        .target(name: "NudgeCore"),
        .target(name: "NudgeData", dependencies: ["NudgeCore"]),
        .target(name: "NudgeUI", dependencies: ["NudgeCore", "NudgeData"]),
        .testTarget(name: "NudgeCoreTests", dependencies: ["NudgeCore"]),
    ]
)
```

- [ ] **Step 2: 建立三個 module 的 placeholder source**

Create `/apple/NudgeKit/Sources/NudgeCore/NudgeCore.swift`:
```swift
// NudgeCore: DTOs, networking, domain types.
public enum NudgeCore {}
```

Create `/apple/NudgeKit/Sources/NudgeData/NudgeData.swift`:
```swift
// NudgeData: SwiftData @Model and repositories.
public enum NudgeData {}
```

Create `/apple/NudgeKit/Sources/NudgeUI/NudgeUI.swift`:
```swift
// NudgeUI: Shared SwiftUI views.
public enum NudgeUI {}
```

- [ ] **Step 3: 建立 smoke test 驗 package 能編**

Create `/apple/NudgeKit/Tests/NudgeCoreTests/SmokeTests.swift`:
```swift
import Testing
@testable import NudgeCore

@Test func packageCompiles() {
    _ = NudgeCore.self
}
```

- [ ] **Step 4: 跑 smoke test 驗 package OK**

Run:
```bash
cd /Users/mike/Documents/nudge/apple/NudgeKit
swift test
```
Expected: `Test run with 1 test passed`.

若失敗，通常是 swift-tools-version 或 platform min version 設錯。確認 Xcode 是 16+ 且 `swift --version` 是 6.0+。

- [ ] **Step 5: 把 NudgeKit 加進 workspace**

開啟 `/apple/Nudge.xcworkspace`，左下 `+` → Add Files to "Nudge" → 選 `NudgeKit/` 資料夾 → Add as "Reference"（不要 "Copy items"）。

Expected: workspace 左邊多一個 NudgeKit package，展開能看到 Sources / Tests。

- [ ] **Step 6: Commit**

Run:
```bash
cd /Users/mike/Documents/nudge
git add apple/NudgeKit/
git commit -m "$(cat <<'EOF'
feat(apple): add NudgeKit Swift Package with Core/Data/UI modules

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```
Expected: commit 成功。

---

### Task 0.4: 把 NudgeKit 連進兩個 App target

**Files:**
- Modify: `/apple/Nudge-iOS.xcodeproj`（透過 Xcode GUI 設定）
- Modify: `/apple/Nudge-macOS.xcodeproj`（透過 Xcode GUI 設定）
- Modify: `/apple/Nudge-iOS/ContentView.swift`
- Modify: `/apple/Nudge-macOS/ContentView.swift`

- [ ] **Step 1: iOS target 加 NudgeKit 相依**

Xcode workspace 左側選 `Nudge-iOS` project → `Nudge-iOS` target → General tab → 往下拉到 "Frameworks, Libraries, and Embedded Content"。

點 `+` → 選 NudgeKit 底下的 `NudgeCore`、`NudgeData`、`NudgeUI` 三個 library → Add。

Expected: 三個 library 加入 target。

- [ ] **Step 2: macOS target 加 NudgeKit 相依**

同樣步驟套用到 `Nudge-macOS` target。

- [ ] **Step 3: 改 iOS ContentView 驗證 import 通**

Edit `/apple/Nudge-iOS/ContentView.swift` 為：
```swift
import SwiftUI
import NudgeCore
import NudgeUI

struct ContentView: View {
    var body: some View {
        VStack {
            Image(systemName: "checkmark.circle.fill")
                .imageScale(.large)
                .foregroundStyle(.tint)
            Text("Nudge iOS")
        }
        .padding()
    }
}

#Preview {
    ContentView()
}
```

- [ ] **Step 4: 改 macOS ContentView 驗證 import 通**

Edit `/apple/Nudge-macOS/ContentView.swift` 為：
```swift
import SwiftUI
import NudgeCore
import NudgeUI

struct ContentView: View {
    var body: some View {
        VStack {
            Image(systemName: "checkmark.circle.fill")
                .imageScale(.large)
                .foregroundStyle(.tint)
            Text("Nudge macOS")
        }
        .padding()
        .frame(minWidth: 400, minHeight: 300)
    }
}

#Preview {
    ContentView()
}
```

- [ ] **Step 5: Build 兩個 target**

Xcode → 左上 scheme selector 選 `Nudge-iOS` → target device 選 iPhone 16 Pro simulator → `⌘B`。

Expected: Build Succeeded。

Scheme 改 `Nudge-macOS` → `⌘B`。

Expected: Build Succeeded。

- [ ] **Step 6: 跑兩邊的 App 驗證 hello world**

iOS scheme → `⌘R`。

Expected: Simulator 啟動，出現勾勾圖示 + "Nudge iOS"。

macOS scheme → `⌘R`。

Expected: Mac 跳出視窗，出現勾勾圖示 + "Nudge macOS"。

- [ ] **Step 7: Commit**

Run:
```bash
cd /Users/mike/Documents/nudge
git add apple/
git commit -m "$(cat <<'EOF'
feat(apple): link NudgeKit into iOS and macOS targets

Both targets now import NudgeCore / NudgeData / NudgeUI and render
a hello-world view.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 0.5: 設定 Bundle ID、Signing、Entitlements

**Files:**
- Modify: `/apple/Nudge-iOS.xcodeproj`（GUI）
- Modify: `/apple/Nudge-macOS.xcodeproj`（GUI）
- Create: `/apple/Nudge-iOS/Nudge-iOS.entitlements`
- Create: `/apple/Nudge-macOS/Nudge-macOS.entitlements`

- [ ] **Step 1: iOS Bundle ID 和 Signing**

Xcode workspace → `Nudge-iOS` project → `Nudge-iOS` target → Signing & Capabilities tab。

設定：
- Team: 你的 Apple Developer team
- Bundle Identifier: `tw.nudge.app`
- Automatically manage signing: 勾選

Expected: Provisioning profile 自動產生，沒紅字錯誤。

- [ ] **Step 2: macOS Bundle ID 和 Signing（Developer ID）**

Xcode workspace → `Nudge-macOS` project → `Nudge-macOS` target → Signing & Capabilities tab。

設定：
- Team: 你的 Apple Developer team
- Bundle Identifier: `tw.nudge.mac`
- Signing Certificate: **先選 "Development"** 開發用；Phase 7 上架前再改 "Developer ID Application"
- App Sandbox: 勾選
- App Sandbox → Network: Outgoing Connections (Client) 勾選
- App Sandbox → User Selected File: Read/Write（之後 Export 功能要用；現在先設）

Expected: entitlements file 自動產生；沒紅字錯誤。

- [ ] **Step 3: iOS 加 Network entitlement（iOS sandbox 沒有 app sandbox 但需要 ATS 設定）**

Edit `/apple/Nudge-iOS/Info.plist`，加入（如果沒有 Info.plist file，用 Xcode 右鍵 project → Info 看內嵌的 Info）：
```xml
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsLocalNetworking</key>
    <true/>
</dict>
```

此設定允許 debug 時打 `http://localhost:3000`。Production HTTPS 不受影響。

- [ ] **Step 4: 確認兩邊 build + run 還是通**

跑兩邊的 scheme `⌘R` 驗證沒壞。

Expected: iOS simulator 和 macOS app 都還是正常跑。

- [ ] **Step 5: Commit**

Run:
```bash
cd /Users/mike/Documents/nudge
git add apple/
git commit -m "$(cat <<'EOF'
feat(apple): configure bundle IDs, signing, entitlements

- iOS: tw.nudge.app, automatic signing
- macOS: tw.nudge.mac, app sandbox + outgoing network
- iOS ATS: allow local networking for dev

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

# Phase 1：基礎建設

---

### Task 1.1: APIError 型別（NudgeCore）

**Files:**
- Create: `/apple/NudgeKit/Sources/NudgeCore/APIError.swift`
- Create: `/apple/NudgeKit/Tests/NudgeCoreTests/APIErrorTests.swift`

- [ ] **Step 1: 寫 failing test**

Create `/apple/NudgeKit/Tests/NudgeCoreTests/APIErrorTests.swift`:
```swift
import Testing
@testable import NudgeCore

@Test func apiErrorUnauthorizedHasCorrectMessage() {
    let error = APIError.unauthorized
    #expect(error.errorDescription == "Authentication required")
}

@Test func apiErrorServerCarriesStatusCode() {
    let error = APIError.server(statusCode: 500, message: "Internal error")
    if case .server(let statusCode, let message) = error {
        #expect(statusCode == 500)
        #expect(message == "Internal error")
    } else {
        Issue.record("Expected .server case")
    }
}

@Test func apiErrorIsSendable() {
    let error: any Sendable = APIError.network(underlying: nil)
    _ = error
}
```

- [ ] **Step 2: 跑 test 確認 FAIL**

Run:
```bash
cd /Users/mike/Documents/nudge/apple/NudgeKit
swift test --filter APIErrorTests
```
Expected: compile error — `APIError` 未定義。

- [ ] **Step 3: 實作 APIError**

Create `/apple/NudgeKit/Sources/NudgeCore/APIError.swift`:
```swift
import Foundation

public enum APIError: Error, Sendable, LocalizedError {
    case unauthorized
    case network(underlying: (any Error)?)
    case server(statusCode: Int, message: String?)
    case decoding(underlying: any Error)
    case invalidResponse

    public var errorDescription: String? {
        switch self {
        case .unauthorized:
            return "Authentication required"
        case .network(let underlying):
            return underlying?.localizedDescription ?? "Network error"
        case .server(let statusCode, let message):
            return message ?? "Server error (\(statusCode))"
        case .decoding:
            return "Failed to decode server response"
        case .invalidResponse:
            return "Invalid server response"
        }
    }
}
```

> **Note**: `network` 的 `underlying: (any Error)?` 不是完全 Sendable（`Error` 不一定 Sendable）；為了讓整個 enum Sendable，我們接受「呼叫方自己確保傳入的 error 是 Sendable 或不透過 boundary 傳 async」。實務上 URLSession 丟的 NSError 都可視作 Sendable。

- [ ] **Step 4: 跑 test 確認 PASS**

Run:
```bash
cd /Users/mike/Documents/nudge/apple/NudgeKit
swift test --filter APIErrorTests
```
Expected: `3 tests passed`.

- [ ] **Step 5: Commit**

Run:
```bash
cd /Users/mike/Documents/nudge
git add apple/NudgeKit/Sources/NudgeCore/APIError.swift apple/NudgeKit/Tests/NudgeCoreTests/APIErrorTests.swift
git commit -m "$(cat <<'EOF'
feat(core): APIError enum with unauthorized/network/server cases

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 1.2: APIConfiguration（base URL）

**Files:**
- Create: `/apple/NudgeKit/Sources/NudgeCore/APIConfiguration.swift`
- Create: `/apple/NudgeKit/Tests/NudgeCoreTests/APIConfigurationTests.swift`

- [ ] **Step 1: 寫 failing test**

Create `/apple/NudgeKit/Tests/NudgeCoreTests/APIConfigurationTests.swift`:
```swift
import Testing
import Foundation
@testable import NudgeCore

@Test func productionConfigurationPointsToNudgeTw() {
    let config = APIConfiguration.production
    #expect(config.baseURL == URL(string: "https://nudge.tw")!)
}

@Test func developmentConfigurationPointsToLocalhost() {
    let config = APIConfiguration.development
    #expect(config.baseURL == URL(string: "http://localhost:3000")!)
}

@Test func customConfigurationUsesGivenURL() {
    let url = URL(string: "https://staging.nudge.tw")!
    let config = APIConfiguration(baseURL: url)
    #expect(config.baseURL == url)
}
```

- [ ] **Step 2: 跑 test 確認 FAIL**

Run:
```bash
cd /Users/mike/Documents/nudge/apple/NudgeKit
swift test --filter APIConfigurationTests
```
Expected: compile error — `APIConfiguration` 未定義。

- [ ] **Step 3: 實作 APIConfiguration**

Create `/apple/NudgeKit/Sources/NudgeCore/APIConfiguration.swift`:
```swift
import Foundation

public struct APIConfiguration: Sendable {
    public let baseURL: URL

    public init(baseURL: URL) {
        self.baseURL = baseURL
    }

    public static let production = APIConfiguration(
        baseURL: URL(string: "https://nudge.tw")!
    )

    public static let development = APIConfiguration(
        baseURL: URL(string: "http://localhost:3000")!
    )

    /// Debug build 用 development，release build 用 production。
    /// 可以在 app target 改寫 `APIConfiguration.default` 指向別的環境。
    public static var `default`: APIConfiguration {
        #if DEBUG
        return .development
        #else
        return .production
        #endif
    }
}
```

- [ ] **Step 4: 跑 test 確認 PASS**

Run:
```bash
cd /Users/mike/Documents/nudge/apple/NudgeKit
swift test --filter APIConfigurationTests
```
Expected: `3 tests passed`.

- [ ] **Step 5: Commit**

Run:
```bash
cd /Users/mike/Documents/nudge
git add apple/NudgeKit/Sources/NudgeCore/APIConfiguration.swift apple/NudgeKit/Tests/NudgeCoreTests/APIConfigurationTests.swift
git commit -m "$(cat <<'EOF'
feat(core): APIConfiguration with production/development defaults

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 1.3: MockURLProtocol（測試輔助）

**Files:**
- Create: `/apple/NudgeKit/Tests/NudgeCoreTests/Helpers/MockURLProtocol.swift`

- [ ] **Step 1: 實作 MockURLProtocol**

Create `/apple/NudgeKit/Tests/NudgeCoreTests/Helpers/MockURLProtocol.swift`:
```swift
import Foundation

/// URLSession 的 mock，攔截 request 回傳指定 response。
///
/// 使用方式：
/// ```swift
/// let config = URLSessionConfiguration.ephemeral
/// config.protocolClasses = [MockURLProtocol.self]
/// let session = URLSession(configuration: config)
///
/// MockURLProtocol.handler = { request in
///     let data = "...".data(using: .utf8)!
///     let response = HTTPURLResponse(url: request.url!, statusCode: 200, ...)!
///     return (data, response)
/// }
/// ```
final class MockURLProtocol: URLProtocol, @unchecked Sendable {
    nonisolated(unsafe) static var handler: ((URLRequest) throws -> (Data, HTTPURLResponse))?

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        guard let handler = Self.handler else {
            fatalError("MockURLProtocol.handler not set")
        }
        do {
            let (data, response) = try handler(request)
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: data)
            client?.urlProtocolDidFinishLoading(self)
        } catch {
            client?.urlProtocol(self, didFailWithError: error)
        }
    }

    override func stopLoading() {}
}

extension URLSession {
    static func mocked() -> URLSession {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [MockURLProtocol.self]
        return URLSession(configuration: config)
    }
}
```

- [ ] **Step 2: 確認 compile 通（沒有單獨的 test）**

Run:
```bash
cd /Users/mike/Documents/nudge/apple/NudgeKit
swift build --target NudgeCoreTests
```
Expected: Build succeeded.

- [ ] **Step 3: Commit**

Run:
```bash
cd /Users/mike/Documents/nudge
git add apple/NudgeKit/Tests/NudgeCoreTests/Helpers/MockURLProtocol.swift
git commit -m "$(cat <<'EOF'
test(core): add MockURLProtocol helper for URLSession stubbing

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 1.4: APIClient（URLSession + async/await）

**Files:**
- Create: `/apple/NudgeKit/Sources/NudgeCore/APIClient.swift`
- Create: `/apple/NudgeKit/Tests/NudgeCoreTests/APIClientTests.swift`

- [ ] **Step 1: 寫 failing tests**

Create `/apple/NudgeKit/Tests/NudgeCoreTests/APIClientTests.swift`:
```swift
import Testing
import Foundation
@testable import NudgeCore

@Suite("APIClient") struct APIClientTests {
    struct TestPayload: Codable, Equatable {
        let id: String
        let name: String
    }

    @Test func getRequestDecodesJSONResponse() async throws {
        MockURLProtocol.handler = { request in
            #expect(request.httpMethod == "GET")
            #expect(request.url?.path == "/api/me")
            let data = #"{"id":"abc","name":"Mike"}"#.data(using: .utf8)!
            let response = HTTPURLResponse(
                url: request.url!,
                statusCode: 200,
                httpVersion: nil,
                headerFields: ["Content-Type": "application/json"]
            )!
            return (data, response)
        }

        let client = APIClient(
            configuration: APIConfiguration(baseURL: URL(string: "https://test.local")!),
            session: .mocked()
        )
        let result: TestPayload = try await client.get("/api/me")
        #expect(result == TestPayload(id: "abc", name: "Mike"))
    }

    @Test func requestAddsAuthorizationHeaderWhenTokenProvided() async throws {
        MockURLProtocol.handler = { request in
            #expect(request.value(forHTTPHeaderField: "Authorization") == "Bearer test-token")
            let data = #"{"id":"a","name":"b"}"#.data(using: .utf8)!
            let response = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!
            return (data, response)
        }

        let client = APIClient(
            configuration: APIConfiguration(baseURL: URL(string: "https://test.local")!),
            session: .mocked(),
            tokenProvider: { "test-token" }
        )
        let _: TestPayload = try await client.get("/api/me")
    }

    @Test func unauthorizedResponseThrowsUnauthorizedError() async {
        MockURLProtocol.handler = { request in
            let response = HTTPURLResponse(url: request.url!, statusCode: 401, httpVersion: nil, headerFields: nil)!
            return (Data(), response)
        }

        let client = APIClient(
            configuration: APIConfiguration(baseURL: URL(string: "https://test.local")!),
            session: .mocked()
        )

        await #expect(throws: APIError.self) {
            let _: TestPayload = try await client.get("/api/me")
        }

        await #expect {
            let _: TestPayload = try await client.get("/api/me")
        } throws: { error in
            if case APIError.unauthorized = error { return true }
            return false
        }
    }

    @Test func serverErrorCarriesStatusCode() async {
        MockURLProtocol.handler = { request in
            let data = #"{"error":"boom"}"#.data(using: .utf8)!
            let response = HTTPURLResponse(url: request.url!, statusCode: 500, httpVersion: nil, headerFields: nil)!
            return (data, response)
        }

        let client = APIClient(
            configuration: APIConfiguration(baseURL: URL(string: "https://test.local")!),
            session: .mocked()
        )

        await #expect {
            let _: TestPayload = try await client.get("/api/me")
        } throws: { error in
            if case APIError.server(let code, _) = error, code == 500 { return true }
            return false
        }
    }

    @Test func postRequestSendsJSONBody() async throws {
        MockURLProtocol.handler = { request in
            #expect(request.httpMethod == "POST")
            #expect(request.value(forHTTPHeaderField: "Content-Type") == "application/json")

            // URLSession 透過 URLProtocol 讀不到 httpBody，要從 httpBodyStream 讀。
            // 為了簡化，我們在這邊跳過 body 內容斷言（APIClient 內部會確保 body 有設）。

            let data = #"{"id":"x","name":"y"}"#.data(using: .utf8)!
            let response = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!
            return (data, response)
        }

        let client = APIClient(
            configuration: APIConfiguration(baseURL: URL(string: "https://test.local")!),
            session: .mocked()
        )

        struct Body: Codable { let idToken: String }
        let result: TestPayload = try await client.post("/api/auth/mobile", body: Body(idToken: "abc"))
        #expect(result == TestPayload(id: "x", name: "y"))
    }
}
```

- [ ] **Step 2: 跑 test 確認 FAIL**

Run:
```bash
cd /Users/mike/Documents/nudge/apple/NudgeKit
swift test --filter APIClientTests
```
Expected: compile error — `APIClient` 未定義。

- [ ] **Step 3: 實作 APIClient**

Create `/apple/NudgeKit/Sources/NudgeCore/APIClient.swift`:
```swift
import Foundation

public final class APIClient: Sendable {
    public typealias TokenProvider = @Sendable () -> String?
    public typealias UnauthorizedHandler = @Sendable () async -> Void

    private let configuration: APIConfiguration
    private let session: URLSession
    private let tokenProvider: TokenProvider?
    private let unauthorizedHandler: UnauthorizedHandler?
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    public init(
        configuration: APIConfiguration,
        session: URLSession = .shared,
        tokenProvider: TokenProvider? = nil,
        unauthorizedHandler: UnauthorizedHandler? = nil
    ) {
        self.configuration = configuration
        self.session = session
        self.tokenProvider = tokenProvider
        self.unauthorizedHandler = unauthorizedHandler

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        self.decoder = decoder

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        self.encoder = encoder
    }

    public func get<Response: Decodable>(_ path: String) async throws -> Response {
        let request = try buildRequest(method: "GET", path: path, body: nil as Empty?)
        return try await perform(request)
    }

    public func post<Body: Encodable, Response: Decodable>(
        _ path: String,
        body: Body
    ) async throws -> Response {
        let request = try buildRequest(method: "POST", path: path, body: body)
        return try await perform(request)
    }

    public func postVoid<Body: Encodable>(
        _ path: String,
        body: Body
    ) async throws {
        let request = try buildRequest(method: "POST", path: path, body: body)
        let _: Empty = try await perform(request)
    }

    public func patch<Body: Encodable, Response: Decodable>(
        _ path: String,
        body: Body
    ) async throws -> Response {
        let request = try buildRequest(method: "PATCH", path: path, body: body)
        return try await perform(request)
    }

    public func delete(_ path: String) async throws {
        let request = try buildRequest(method: "DELETE", path: path, body: nil as Empty?)
        let _: Empty = try await perform(request)
    }

    // MARK: - Private

    private func buildRequest<Body: Encodable>(
        method: String,
        path: String,
        body: Body?
    ) throws -> URLRequest {
        guard let url = URL(string: path, relativeTo: configuration.baseURL) else {
            throw APIError.invalidResponse
        }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        if let token = tokenProvider?() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let body, !(body is Empty) {
            request.httpBody = try encoder.encode(body)
        }

        return request
    }

    private func perform<Response: Decodable>(_ request: URLRequest) async throws -> Response {
        let (data, urlResponse): (Data, URLResponse)
        do {
            (data, urlResponse) = try await session.data(for: request)
        } catch {
            throw APIError.network(underlying: error)
        }

        guard let httpResponse = urlResponse as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        switch httpResponse.statusCode {
        case 200..<300:
            if Response.self == Empty.self {
                return Empty() as! Response
            }
            do {
                return try decoder.decode(Response.self, from: data)
            } catch {
                throw APIError.decoding(underlying: error)
            }
        case 401:
            await unauthorizedHandler?()
            throw APIError.unauthorized
        default:
            let message = (try? decoder.decode(ErrorPayload.self, from: data))?.error
            throw APIError.server(statusCode: httpResponse.statusCode, message: message)
        }
    }

    private struct ErrorPayload: Decodable {
        let error: String?
    }

    struct Empty: Codable {}
}
```

- [ ] **Step 4: 跑 test 確認 PASS**

Run:
```bash
cd /Users/mike/Documents/nudge/apple/NudgeKit
swift test --filter APIClientTests
```
Expected: `5 tests passed`.

- [ ] **Step 5: Commit**

Run:
```bash
cd /Users/mike/Documents/nudge
git add apple/NudgeKit/Sources/NudgeCore/APIClient.swift apple/NudgeKit/Tests/NudgeCoreTests/APIClientTests.swift
git commit -m "$(cat <<'EOF'
feat(core): APIClient with URLSession + async/await

Supports GET/POST/PATCH/DELETE with Bearer token, JSON body,
unified APIError surface (unauthorized, server, decoding, network).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 1.5: Auth DTOs（Codable shapes 對齊 server）

**Files:**
- Create: `/apple/NudgeKit/Sources/NudgeCore/AuthDTO.swift`
- Create: `/apple/NudgeKit/Sources/NudgeCore/UserDTO.swift`
- Create: `/apple/NudgeKit/Tests/NudgeCoreTests/AuthDTOTests.swift`

> **Server response shape（對齊 `/api/auth/mobile/route.ts`）**：
> ```json
> {
>   "token": "<jwt>",
>   "user": { "id", "email", "name"|null, "avatarUrl"|null, "locale"|null }
> }
> ```
>
> **`GET /api/me` response shape**:
> ```json
> { "id", "email", "name"|null, "avatarUrl"|null, "locale"|null, "createdAt" }
> ```

- [ ] **Step 1: 寫 failing tests**

Create `/apple/NudgeKit/Tests/NudgeCoreTests/AuthDTOTests.swift`:
```swift
import Testing
import Foundation
@testable import NudgeCore

@Suite("Auth DTO") struct AuthDTOTests {
    @Test func authRequestEncodesIdToken() throws {
        let request = MobileAuthRequest(idToken: "google-id-token")
        let data = try JSONEncoder().encode(request)
        let json = try #require(String(data: data, encoding: .utf8))
        #expect(json.contains("\"idToken\":\"google-id-token\""))
    }

    @Test func authResponseDecodesTokenAndUser() throws {
        let json = #"""
        {
          "token": "jwt-abc",
          "user": {
            "id": "u1",
            "email": "mike@example.com",
            "name": "Mike",
            "avatarUrl": "https://example.com/pic.jpg",
            "locale": "ja"
          }
        }
        """#.data(using: .utf8)!

        let response = try JSONDecoder().decode(MobileAuthResponse.self, from: json)
        #expect(response.token == "jwt-abc")
        #expect(response.user.id == "u1")
        #expect(response.user.email == "mike@example.com")
        #expect(response.user.name == "Mike")
        #expect(response.user.avatarUrl == "https://example.com/pic.jpg")
        #expect(response.user.locale == "ja")
    }

    @Test func userDTODecodesNullableFields() throws {
        let json = #"""
        {
          "id": "u1",
          "email": "mike@example.com",
          "name": null,
          "avatarUrl": null,
          "locale": null
        }
        """#.data(using: .utf8)!

        let user = try JSONDecoder().decode(UserDTO.self, from: json)
        #expect(user.id == "u1")
        #expect(user.name == nil)
        #expect(user.avatarUrl == nil)
        #expect(user.locale == nil)
    }
}
```

- [ ] **Step 2: 跑 test 確認 FAIL**

Run:
```bash
cd /Users/mike/Documents/nudge/apple/NudgeKit
swift test --filter AuthDTOTests
```
Expected: compile error — 型別未定義。

- [ ] **Step 3: 實作 DTOs**

Create `/apple/NudgeKit/Sources/NudgeCore/UserDTO.swift`:
```swift
import Foundation

public struct UserDTO: Codable, Equatable, Sendable {
    public let id: String
    public let email: String
    public let name: String?
    public let avatarUrl: String?
    public let locale: String?

    public init(
        id: String,
        email: String,
        name: String?,
        avatarUrl: String?,
        locale: String?
    ) {
        self.id = id
        self.email = email
        self.name = name
        self.avatarUrl = avatarUrl
        self.locale = locale
    }
}
```

Create `/apple/NudgeKit/Sources/NudgeCore/AuthDTO.swift`:
```swift
import Foundation

public struct MobileAuthRequest: Codable, Sendable {
    public let idToken: String

    public init(idToken: String) {
        self.idToken = idToken
    }
}

public struct MobileAuthResponse: Codable, Sendable {
    public let token: String
    public let user: UserDTO

    public init(token: String, user: UserDTO) {
        self.token = token
        self.user = user
    }
}
```

- [ ] **Step 4: 跑 test 確認 PASS**

Run:
```bash
cd /Users/mike/Documents/nudge/apple/NudgeKit
swift test --filter AuthDTOTests
```
Expected: `3 tests passed`.

- [ ] **Step 5: Commit**

Run:
```bash
cd /Users/mike/Documents/nudge
git add apple/NudgeKit/Sources/NudgeCore/AuthDTO.swift apple/NudgeKit/Sources/NudgeCore/UserDTO.swift apple/NudgeKit/Tests/NudgeCoreTests/AuthDTOTests.swift
git commit -m "$(cat <<'EOF'
feat(core): MobileAuthRequest/Response + UserDTO Codable shapes

Mirrors /api/auth/mobile and /api/me response shapes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 1.6: KeychainStorage（Bearer token 儲存）

**Files:**
- Create: `/apple/NudgeKit/Sources/NudgeCore/KeychainStorage.swift`
- Create: `/apple/NudgeKit/Tests/NudgeCoreTests/KeychainStorageTests.swift`

- [ ] **Step 1: 寫 failing tests**

Create `/apple/NudgeKit/Tests/NudgeCoreTests/KeychainStorageTests.swift`:
```swift
import Testing
import Foundation
@testable import NudgeCore

/// Keychain 測試用獨立 service 名避免污染真實資料。
/// 每個 test 結束會 delete 該 service 的全部 item。
@Suite("KeychainStorage", .serialized) struct KeychainStorageTests {
    let storage: KeychainStorage
    let service = "tw.nudge.tests.\(UUID().uuidString)"

    init() {
        self.storage = KeychainStorage(service: service)
    }

    @Test func setThenGetReturnsStoredValue() throws {
        try storage.set("hello", for: "token")
        let value = try storage.get(for: "token")
        #expect(value == "hello")
    }

    @Test func getReturnsNilWhenKeyMissing() throws {
        let value = try storage.get(for: "missing-key")
        #expect(value == nil)
    }

    @Test func setOverwritesExistingValue() throws {
        try storage.set("first", for: "token")
        try storage.set("second", for: "token")
        let value = try storage.get(for: "token")
        #expect(value == "second")
    }

    @Test func removeClearsValue() throws {
        try storage.set("hello", for: "token")
        try storage.remove(for: "token")
        let value = try storage.get(for: "token")
        #expect(value == nil)
    }
}
```

- [ ] **Step 2: 跑 test 確認 FAIL**

Run:
```bash
cd /Users/mike/Documents/nudge/apple/NudgeKit
swift test --filter KeychainStorageTests
```
Expected: compile error — `KeychainStorage` 未定義。

- [ ] **Step 3: 實作 KeychainStorage**

Create `/apple/NudgeKit/Sources/NudgeCore/KeychainStorage.swift`:
```swift
import Foundation
import Security

public enum KeychainError: Error, Sendable {
    case unexpectedStatus(OSStatus)
    case dataConversion
}

/// 用 SecItem API 封裝的 Keychain wrapper，單一 service。
/// 不處理 access group、不支援 iCloud sync（避免同步時引入不可預期行為）。
public final class KeychainStorage: Sendable {
    private let service: String

    public init(service: String) {
        self.service = service
    }

    public func set(_ value: String, for key: String) throws {
        guard let data = value.data(using: .utf8) else {
            throw KeychainError.dataConversion
        }

        // 先嘗試 update，若不存在再 add
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
        let updateAttrs: [String: Any] = [kSecValueData as String: data]

        let updateStatus = SecItemUpdate(query as CFDictionary, updateAttrs as CFDictionary)
        switch updateStatus {
        case errSecSuccess:
            return
        case errSecItemNotFound:
            break
        default:
            throw KeychainError.unexpectedStatus(updateStatus)
        }

        var addQuery = query
        addQuery[kSecValueData as String] = data
        addQuery[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        let addStatus = SecItemAdd(addQuery as CFDictionary, nil)
        guard addStatus == errSecSuccess else {
            throw KeychainError.unexpectedStatus(addStatus)
        }
    }

    public func get(for key: String) throws -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var out: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &out)
        switch status {
        case errSecSuccess:
            guard let data = out as? Data,
                  let string = String(data: data, encoding: .utf8) else {
                throw KeychainError.dataConversion
            }
            return string
        case errSecItemNotFound:
            return nil
        default:
            throw KeychainError.unexpectedStatus(status)
        }
    }

    public func remove(for key: String) throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw KeychainError.unexpectedStatus(status)
        }
    }
}
```

- [ ] **Step 4: 跑 test 確認 PASS**

Run:
```bash
cd /Users/mike/Documents/nudge/apple/NudgeKit
swift test --filter KeychainStorageTests
```
Expected: `4 tests passed`.

> **Note**：test service name 使用 UUID 所以每次獨立，但 keychain item 會實際寫入本機 keychain。Test 跑完不會清理，長期累積會殘留。若要清理可手動跑 `security delete-generic-password -s <service>` 或忽略（item 量微量，不影響）。

- [ ] **Step 5: Commit**

Run:
```bash
cd /Users/mike/Documents/nudge
git add apple/NudgeKit/Sources/NudgeCore/KeychainStorage.swift apple/NudgeKit/Tests/NudgeCoreTests/KeychainStorageTests.swift
git commit -m "$(cat <<'EOF'
feat(core): KeychainStorage wrapper for token storage

Uses SecItem API with kSecAttrAccessibleAfterFirstUnlock.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 1.7: AuthRepository（orchestrates login/logout/me）

**Files:**
- Create: `/apple/NudgeKit/Sources/NudgeCore/AuthRepository.swift`
- Create: `/apple/NudgeKit/Tests/NudgeCoreTests/AuthRepositoryTests.swift`

- [ ] **Step 1: 寫 failing tests**

Create `/apple/NudgeKit/Tests/NudgeCoreTests/AuthRepositoryTests.swift`:
```swift
import Testing
import Foundation
@testable import NudgeCore

@Suite("AuthRepository") @MainActor struct AuthRepositoryTests {
    let testService: String
    let keychain: KeychainStorage

    init() {
        self.testService = "tw.nudge.tests.\(UUID().uuidString)"
        self.keychain = KeychainStorage(service: testService)
    }

    func makeClient(status: Int, body: String) -> APIClient {
        MockURLProtocol.handler = { request in
            let data = body.data(using: .utf8)!
            let response = HTTPURLResponse(
                url: request.url!,
                statusCode: status,
                httpVersion: nil,
                headerFields: ["Content-Type": "application/json"]
            )!
            return (data, response)
        }
        return APIClient(
            configuration: APIConfiguration(baseURL: URL(string: "https://test.local")!),
            session: .mocked(),
            tokenProvider: { [keychain] in try? keychain.get(for: "token") }
        )
    }

    @Test func loginStoresTokenAndReturnsUser() async throws {
        let client = makeClient(
            status: 200,
            body: #"""
            {"token":"jwt-xyz","user":{"id":"u1","email":"a@b.c","name":null,"avatarUrl":null,"locale":null}}
            """#
        )
        let repo = AuthRepository(client: client, keychain: keychain)
        let user = try await repo.login(idToken: "google-token")

        #expect(user.id == "u1")
        #expect(try keychain.get(for: "token") == "jwt-xyz")
        #expect(repo.currentUser?.id == "u1")
    }

    @Test func loginFailurePropagatesError() async throws {
        let client = makeClient(status: 401, body: #"{"error":"Invalid token"}"#)
        let repo = AuthRepository(client: client, keychain: keychain)

        await #expect {
            _ = try await repo.login(idToken: "bad-token")
        } throws: { error in
            if case APIError.unauthorized = error { return true }
            return false
        }
        #expect(try keychain.get(for: "token") == nil)
    }

    @Test func logoutRemovesToken() async throws {
        try keychain.set("pre-existing", for: "token")
        let client = makeClient(status: 200, body: "{}")
        let repo = AuthRepository(client: client, keychain: keychain)
        await repo.logout()

        #expect(try keychain.get(for: "token") == nil)
        #expect(repo.currentUser == nil)
    }

    @Test func restoreSessionReturnsTrueWhenTokenValid() async throws {
        try keychain.set("existing-token", for: "token")
        let client = makeClient(
            status: 200,
            body: #"""
            {"id":"u2","email":"x@y.z","name":null,"avatarUrl":null,"locale":"ja","createdAt":"2026-04-17T00:00:00Z"}
            """#
        )
        let repo = AuthRepository(client: client, keychain: keychain)
        let restored = await repo.restoreSession()

        #expect(restored == true)
        #expect(repo.currentUser?.id == "u2")
        #expect(repo.currentUser?.locale == "ja")
    }

    @Test func restoreSessionClearsTokenWhenMeReturnsUnauthorized() async throws {
        try keychain.set("stale-token", for: "token")
        let client = makeClient(status: 401, body: #"{"error":"Unauthorized"}"#)
        let repo = AuthRepository(client: client, keychain: keychain)
        let restored = await repo.restoreSession()

        #expect(restored == false)
        #expect(try keychain.get(for: "token") == nil)
        #expect(repo.currentUser == nil)
    }

    @Test func restoreSessionReturnsFalseWhenNoToken() async throws {
        let client = makeClient(status: 200, body: "{}")
        let repo = AuthRepository(client: client, keychain: keychain)
        let restored = await repo.restoreSession()

        #expect(restored == false)
        #expect(repo.currentUser == nil)
    }
}
```

- [ ] **Step 2: 跑 test 確認 FAIL**

Run:
```bash
cd /Users/mike/Documents/nudge/apple/NudgeKit
swift test --filter AuthRepositoryTests
```
Expected: compile error — `AuthRepository` 未定義。

- [ ] **Step 3: 實作 AuthRepository**

Create `/apple/NudgeKit/Sources/NudgeCore/AuthRepository.swift`:
```swift
import Foundation
import Observation

/// 持有 auth 狀態、協調 login / logout / me。
/// 不處理 Google SDK 本身——呼叫方自己拿 idToken 傳進來。
@Observable
@MainActor
public final class AuthRepository {
    public enum Status: Sendable, Equatable {
        case unknown
        case authenticated(UserDTO)
        case unauthenticated
    }

    public private(set) var status: Status = .unknown

    public var currentUser: UserDTO? {
        if case .authenticated(let user) = status { return user }
        return nil
    }

    public var isAuthenticated: Bool {
        if case .authenticated = status { return true }
        return false
    }

    private let client: APIClient
    private let keychain: KeychainStorage
    private let tokenKey = "token"

    public init(client: APIClient, keychain: KeychainStorage) {
        self.client = client
        self.keychain = keychain
    }

    @discardableResult
    public func login(idToken: String) async throws -> UserDTO {
        let response: MobileAuthResponse = try await client.post(
            "/api/auth/mobile",
            body: MobileAuthRequest(idToken: idToken)
        )
        try keychain.set(response.token, for: tokenKey)
        status = .authenticated(response.user)
        return response.user
    }

    public func logout() async {
        try? keychain.remove(for: tokenKey)
        status = .unauthenticated
    }

    /// App 啟動時呼叫：從 keychain 撈 token，打 /api/me 驗證。
    /// 驗證成功 → authenticated；失敗（401）→ 清 token → unauthenticated。
    /// 網路錯誤時保留目前 status（避免網路差就被登出）。
    @discardableResult
    public func restoreSession() async -> Bool {
        guard let token = try? keychain.get(for: tokenKey), !token.isEmpty else {
            status = .unauthenticated
            return false
        }

        do {
            let user: UserDTO = try await client.get("/api/me")
            status = .authenticated(user)
            return true
        } catch APIError.unauthorized {
            try? keychain.remove(for: tokenKey)
            status = .unauthenticated
            return false
        } catch {
            // 網路錯等：不動 token，status 保持 .unknown
            return false
        }
    }

    /// 給 APIClient 的 unauthorizedHandler 用，或外部呼叫清 session。
    public func handleUnauthorized() async {
        try? keychain.remove(for: tokenKey)
        status = .unauthenticated
    }
}
```

- [ ] **Step 4: 跑 test 確認 PASS**

Run:
```bash
cd /Users/mike/Documents/nudge/apple/NudgeKit
swift test --filter AuthRepositoryTests
```
Expected: `6 tests passed`.

- [ ] **Step 5: Commit**

Run:
```bash
cd /Users/mike/Documents/nudge
git add apple/NudgeKit/Sources/NudgeCore/AuthRepository.swift apple/NudgeKit/Tests/NudgeCoreTests/AuthRepositoryTests.swift
git commit -m "$(cat <<'EOF'
feat(core): AuthRepository with login/logout/restoreSession

Observable on MainActor. Token stored in Keychain via injected storage.
restoreSession preserves state on network errors (no surprise logout).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 1.8: 加入 Google Sign-In SDK 相依

**Files:**
- Modify: `/apple/Nudge-iOS.xcodeproj`（GUI：加 SPM package）
- Modify: `/apple/Nudge-macOS.xcodeproj`（GUI：加 SPM package）
- Modify: `/apple/Nudge-iOS/Info.plist`（加 URL scheme）
- Modify: `/apple/Nudge-macOS/Info.plist`（加 URL scheme）

**Prerequisites**：前面 Prerequisites 段落的 Google Cloud Console OAuth client ID 必須先建好。

- [ ] **Step 1: 加 GoogleSignIn-iOS SPM package 到 iOS target**

Xcode workspace → `Nudge-iOS` project → File → Add Package Dependencies... → URL 填：
```
https://github.com/google/GoogleSignIn-iOS
```
Dependency Rule: Up to Next Major Version → Add Package。

選 target = `Nudge-iOS`，product = `GoogleSignIn` 和 `GoogleSignInSwift` 都勾 → Add Package。

Expected: Package 出現在 workspace 左邊，iOS target 的 Frameworks 列表多兩個 library。

- [ ] **Step 2: 加 GoogleSignIn 到 macOS target**

同樣步驟，但 target 選 `Nudge-macOS`。

Expected: macOS target 也加到 dependency。

- [ ] **Step 3: iOS Info.plist 加 OAuth URL scheme**

開 `/apple/Nudge-iOS/Info.plist`（Xcode 會以 GUI 顯示），加入：

```xml
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>com.googleusercontent.apps.<IOS_CLIENT_ID_REVERSED></string>
        </array>
    </dict>
</array>
```

把 `<IOS_CLIENT_ID_REVERSED>` 換成你在 Google Cloud Console 拿到的 iOS client ID 反過來的字串。例如 client ID 是 `123456-abcdef.apps.googleusercontent.com`，URL scheme 就是 `com.googleusercontent.apps.123456-abcdef`。

- [ ] **Step 4: macOS Info.plist 加 OAuth URL scheme**

同樣套用到 `/apple/Nudge-macOS/Info.plist`，換成 macOS client ID 反過來。

- [ ] **Step 5: 驗證 SPM 解析成功 + build**

Xcode → scheme `Nudge-iOS` → `⌘B`。Expected: Build Succeeded。

Scheme `Nudge-macOS` → `⌘B`。Expected: Build Succeeded。

若有 compile error 通常是 SPM 版本衝突，試著 File → Packages → Reset Package Caches。

- [ ] **Step 6: Commit**

Run:
```bash
cd /Users/mike/Documents/nudge
git add apple/
git commit -m "$(cat <<'EOF'
feat(apple): integrate GoogleSignIn-iOS SDK for both targets

Added SPM dependency + URL schemes in Info.plist.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 1.9: GoogleSignInService wrapper（iOS + macOS 各自實作）

**Files:**
- Create: `/apple/Nudge-iOS/GoogleSignInService+iOS.swift`
- Create: `/apple/Nudge-macOS/GoogleSignInService+macOS.swift`
- Create: `/apple/NudgeKit/Sources/NudgeCore/GoogleSignInService.swift`（protocol）

**說明**：Google SDK 在 iOS 要 `UIViewController` presentation context、在 macOS 要 `NSWindow`。共用介面抽到 protocol，各平台自己實作 wrapper。

- [ ] **Step 1: 定義 protocol（NudgeCore 共用）**

Create `/apple/NudgeKit/Sources/NudgeCore/GoogleSignInService.swift`:
```swift
import Foundation

/// Google Sign-In 的平台無關介面。
/// iOS / macOS target 各自實作，傳 idToken 回 AuthRepository。
@MainActor
public protocol GoogleSignInService: Sendable {
    /// 啟動 Google 登入流程，完成後 resolve 成 idToken。
    /// 使用者取消時丟 GoogleSignInError.canceled。
    func signIn() async throws -> String

    /// 登出 Google account（本地 session，不 revoke）。
    func signOut()
}

public enum GoogleSignInError: Error, Sendable {
    case canceled
    case missingIdToken
    case platform(underlying: any Error)
}
```

- [ ] **Step 2: iOS 實作**

Create `/apple/Nudge-iOS/GoogleSignInService+iOS.swift`:
```swift
import Foundation
import UIKit
import GoogleSignIn
import NudgeCore

@MainActor
final class GoogleSignInServiceIOS: GoogleSignInService {
    private let clientID: String

    init(clientID: String) {
        self.clientID = clientID
        GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: clientID)
    }

    func signIn() async throws -> String {
        guard let rootVC = Self.rootViewController() else {
            throw GoogleSignInError.platform(underlying: NSError(
                domain: "GoogleSignInService", code: -1,
                userInfo: [NSLocalizedDescriptionKey: "No root view controller"]
            ))
        }

        do {
            let result = try await GIDSignIn.sharedInstance.signIn(
                withPresenting: rootVC
            )
            guard let idToken = result.user.idToken?.tokenString else {
                throw GoogleSignInError.missingIdToken
            }
            return idToken
        } catch let error as NSError where error.code == GIDSignInError.Code.canceled.rawValue {
            throw GoogleSignInError.canceled
        } catch {
            throw GoogleSignInError.platform(underlying: error)
        }
    }

    func signOut() {
        GIDSignIn.sharedInstance.signOut()
    }

    private static func rootViewController() -> UIViewController? {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
            .first { $0.isKeyWindow }?
            .rootViewController
    }
}
```

- [ ] **Step 3: macOS 實作**

Create `/apple/Nudge-macOS/GoogleSignInService+macOS.swift`:
```swift
import Foundation
import AppKit
import GoogleSignIn
import NudgeCore

@MainActor
final class GoogleSignInServiceMacOS: GoogleSignInService {
    private let clientID: String

    init(clientID: String) {
        self.clientID = clientID
        GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: clientID)
    }

    func signIn() async throws -> String {
        guard let window = NSApp.keyWindow ?? NSApp.windows.first else {
            throw GoogleSignInError.platform(underlying: NSError(
                domain: "GoogleSignInService", code: -1,
                userInfo: [NSLocalizedDescriptionKey: "No window available"]
            ))
        }

        do {
            let result = try await GIDSignIn.sharedInstance.signIn(withPresenting: window)
            guard let idToken = result.user.idToken?.tokenString else {
                throw GoogleSignInError.missingIdToken
            }
            return idToken
        } catch let error as NSError where error.code == GIDSignInError.Code.canceled.rawValue {
            throw GoogleSignInError.canceled
        } catch {
            throw GoogleSignInError.platform(underlying: error)
        }
    }

    func signOut() {
        GIDSignIn.sharedInstance.signOut()
    }
}
```

- [ ] **Step 4: 放 OAuth client ID 到 build settings 或常數檔**

為了不把 client ID commit 進 repo（雖然 iOS/macOS client ID 不算 secret），建議放到 Xcode Config file 或 `.env.local`。簡單做法：

在 `Nudge-iOS` target → Build Settings → 底下 `+` → Add User-Defined Setting → 叫 `GOOGLE_IOS_CLIENT_ID`，值填你的 iOS client ID。

然後在 Info.plist 加：
```xml
<key>GoogleIOSClientID</key>
<string>$(GOOGLE_IOS_CLIENT_ID)</string>
```

macOS target 類似，設 `GOOGLE_MAC_CLIENT_ID` + Info.plist 的 `GoogleMacClientID`。

- [ ] **Step 5: 讀取 client ID 的 helper**

在 iOS target 加一個 extension：

Create `/apple/Nudge-iOS/GoogleSignInService+iOS.swift` 最下方加：
```swift
extension GoogleSignInServiceIOS {
    static func fromInfoPlist() -> GoogleSignInServiceIOS {
        guard let clientID = Bundle.main.object(forInfoDictionaryKey: "GoogleIOSClientID") as? String,
              !clientID.isEmpty else {
            fatalError("GoogleIOSClientID missing in Info.plist — set GOOGLE_IOS_CLIENT_ID in build settings")
        }
        return GoogleSignInServiceIOS(clientID: clientID)
    }
}
```

macOS 同樣加到 `GoogleSignInService+macOS.swift`：
```swift
extension GoogleSignInServiceMacOS {
    static func fromInfoPlist() -> GoogleSignInServiceMacOS {
        guard let clientID = Bundle.main.object(forInfoDictionaryKey: "GoogleMacClientID") as? String,
              !clientID.isEmpty else {
            fatalError("GoogleMacClientID missing in Info.plist — set GOOGLE_MAC_CLIENT_ID in build settings")
        }
        return GoogleSignInServiceMacOS(clientID: clientID)
    }
}
```

- [ ] **Step 6: Build 兩個 target 驗證 compile 通**

Xcode → scheme `Nudge-iOS` → `⌘B`。Expected: Build Succeeded。
Xcode → scheme `Nudge-macOS` → `⌘B`。Expected: Build Succeeded。

- [ ] **Step 7: Commit**

Run:
```bash
cd /Users/mike/Documents/nudge
git add apple/
git commit -m "$(cat <<'EOF'
feat(apple): GoogleSignInService protocol + iOS/macOS implementations

Client IDs read from Info.plist (user-defined build settings).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 1.10: 共用 LoginView + AuthGateView（NudgeUI）

**Files:**
- Create: `/apple/NudgeKit/Sources/NudgeUI/LoginView.swift`
- Create: `/apple/NudgeKit/Sources/NudgeUI/AuthGateView.swift`

- [ ] **Step 1: LoginView 實作**

Create `/apple/NudgeKit/Sources/NudgeUI/LoginView.swift`:
```swift
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
```

- [ ] **Step 2: AuthGateView 實作**

Create `/apple/NudgeKit/Sources/NudgeUI/AuthGateView.swift`:
```swift
import SwiftUI
import NudgeCore

/// 根據 AuthRepository.status 切換顯示 LoginView 或 app 內容。
public struct AuthGateView<Content: View>: View {
    @Bindable var auth: AuthRepository
    @ViewBuilder let content: () -> Content
    let onLoginRequested: () async -> Result<Void, Error>

    public init(
        auth: AuthRepository,
        onLoginRequested: @escaping () async -> Result<Void, Error>,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.auth = auth
        self.onLoginRequested = onLoginRequested
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
            LoginView(onLoginTapped: onLoginRequested)
        }
    }
}
```

- [ ] **Step 3: Build NudgeKit 驗證 compile**

Run:
```bash
cd /Users/mike/Documents/nudge/apple/NudgeKit
swift build
```
Expected: Build complete.

- [ ] **Step 4: Commit**

Run:
```bash
cd /Users/mike/Documents/nudge
git add apple/NudgeKit/Sources/NudgeUI/
git commit -m "$(cat <<'EOF'
feat(ui): LoginView + AuthGateView (shared SwiftUI)

LoginView: Google sign-in button with loading/error states.
AuthGateView: switches between LoginView and authenticated content.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 1.11: NudgeData ModelContainer scaffolding

**Files:**
- Modify: `/apple/NudgeKit/Package.swift`（link SwiftData）
- Create: `/apple/NudgeKit/Sources/NudgeData/NudgeModelContainer.swift`

**說明**：Phase 1 還沒有具體的 `@Model` 要存（那是 Phase 2 起），但要把 ModelContainer 的 plumbing 先建好，後面加 model 時只要改 schema 即可。

- [ ] **Step 1: 實作 NudgeModelContainer**

Create `/apple/NudgeKit/Sources/NudgeData/NudgeModelContainer.swift`:
```swift
import Foundation
import SwiftData

public enum NudgeModelContainer {
    /// Phase 1: 空 schema。Phase 2 起把 @Model 型別加進 models 陣列。
    ///
    /// 用法：在 App entry 做 `.modelContainer(NudgeModelContainer.make())`
    @MainActor
    public static func make() -> ModelContainer {
        let schema = Schema([])
        let configuration = ModelConfiguration(
            schema: schema,
            isStoredInMemoryOnly: false
        )
        do {
            return try ModelContainer(for: schema, configurations: configuration)
        } catch {
            fatalError("Failed to create ModelContainer: \(error)")
        }
    }

    @MainActor
    public static func makeInMemory() -> ModelContainer {
        let schema = Schema([])
        let configuration = ModelConfiguration(
            schema: schema,
            isStoredInMemoryOnly: true
        )
        do {
            return try ModelContainer(for: schema, configurations: configuration)
        } catch {
            fatalError("Failed to create in-memory ModelContainer: \(error)")
        }
    }
}
```

- [ ] **Step 2: Build 驗 compile**

Run:
```bash
cd /Users/mike/Documents/nudge/apple/NudgeKit
swift build
```
Expected: Build complete。

> **Note**: SwiftData 的 `Schema([])` 空 schema 要在 iOS 18 / macOS 15 才合法。若 Phase 1 build 失敗，加一個 dummy `@Model` 進去：
>
> ```swift
> @Model final class _DummyModel { var id: String = ""; init() {} }
> ```

- [ ] **Step 3: Commit**

Run:
```bash
cd /Users/mike/Documents/nudge
git add apple/NudgeKit/Sources/NudgeData/
git commit -m "$(cat <<'EOF'
feat(data): NudgeModelContainer scaffold (empty schema for Phase 1)

Phase 2+ will add @Model types as they arrive.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 1.12: PlatformRootView（iOS TabView / macOS NavigationSplitView 骨架）

**Files:**
- Create: `/apple/NudgeKit/Sources/NudgeUI/PlatformRootView.swift`

- [ ] **Step 1: 實作 PlatformRootView**

Create `/apple/NudgeKit/Sources/NudgeUI/PlatformRootView.swift`:
```swift
import SwiftUI
import NudgeCore

/// Phase 1 骨架：iOS 顯示 TabView + 4 個 placeholder、macOS 顯示 NavigationSplitView。
/// Phase 2+ 會把 placeholder 換成真正的 feature view。
public struct PlatformRootView: View {
    @Bindable var auth: AuthRepository

    public init(auth: AuthRepository) {
        self.auth = auth
    }

    public var body: some View {
        #if os(iOS)
        IOSTabRoot(auth: auth)
        #else
        MacSidebarRoot(auth: auth)
        #endif
    }
}

#if os(iOS)
struct IOSTabRoot: View {
    @Bindable var auth: AuthRepository

    var body: some View {
        TabView {
            PlaceholderTab(title: "行動", systemImage: "checkmark.circle")
                .tabItem { Label("行動", systemImage: "checkmark.circle") }

            PlaceholderTab(title: "日誌", systemImage: "book")
                .tabItem { Label("日誌", systemImage: "book") }

            PlaceholderTab(title: "卡片", systemImage: "square.stack")
                .tabItem { Label("卡片", systemImage: "square.stack") }

            SettingsPlaceholder(auth: auth)
                .tabItem { Label("設定", systemImage: "gearshape") }
        }
    }
}
#else
struct MacSidebarRoot: View {
    @Bindable var auth: AuthRepository
    @State private var selection: SidebarItem? = .today

    var body: some View {
        NavigationSplitView {
            List(selection: $selection) {
                Section("今日") {
                    NavigationLink(value: SidebarItem.today) { Label("今天", systemImage: "sun.max") }
                }
                Section("內容") {
                    NavigationLink(value: SidebarItem.notes) { Label("日誌", systemImage: "book") }
                    NavigationLink(value: SidebarItem.cards) { Label("卡片", systemImage: "square.stack") }
                }
                Section {
                    NavigationLink(value: SidebarItem.settings) { Label("設定", systemImage: "gearshape") }
                }
            }
            .navigationTitle("Nudge")
        } content: {
            switch selection ?? .today {
            case .today: PlaceholderTab(title: "今天", systemImage: "sun.max")
            case .notes: PlaceholderTab(title: "日誌", systemImage: "book")
            case .cards: PlaceholderTab(title: "卡片", systemImage: "square.stack")
            case .settings: SettingsPlaceholder(auth: auth)
            }
        } detail: {
            Text("選擇項目")
                .foregroundStyle(.secondary)
        }
    }
}

enum SidebarItem: Hashable {
    case today, notes, cards, settings
}
#endif

struct PlaceholderTab: View {
    let title: String
    let systemImage: String

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: systemImage)
                .font(.system(size: 48))
                .foregroundStyle(.tertiary)
            Text(title)
                .font(.title3)
                .foregroundStyle(.secondary)
            Text("Phase 2+ 實作")
                .font(.footnote)
                .foregroundStyle(.tertiary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct SettingsPlaceholder: View {
    @Bindable var auth: AuthRepository

    var body: some View {
        List {
            Section("帳號") {
                if let user = auth.currentUser {
                    LabeledContent("Email", value: user.email)
                    LabeledContent("名稱", value: user.name ?? "—")
                }
                Button("登出", role: .destructive) {
                    Task { await auth.logout() }
                }
            }
        }
        #if os(macOS)
        .formStyle(.grouped)
        #endif
    }
}
```

- [ ] **Step 2: Build NudgeKit + 兩個 target 驗證 compile**

Run:
```bash
cd /Users/mike/Documents/nudge/apple/NudgeKit
swift build
```
Expected: Build complete。

Xcode workspace scheme `Nudge-iOS` → `⌘B` → Build Succeeded。
Xcode workspace scheme `Nudge-macOS` → `⌘B` → Build Succeeded。

- [ ] **Step 3: Commit**

Run:
```bash
cd /Users/mike/Documents/nudge
git add apple/NudgeKit/Sources/NudgeUI/PlatformRootView.swift
git commit -m "$(cat <<'EOF'
feat(ui): PlatformRootView — iOS TabView / macOS NavigationSplitView skeleton

Placeholder tabs/sidebar items for rollout in Phase 2+.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 1.13: 把 iOS App 接起來（App entry + AppDelegate）

**Files:**
- Modify: `/apple/Nudge-iOS/NudgeiOSApp.swift`（取代 Xcode 預設的 ContentView）

- [ ] **Step 1: 改 App entry**

Edit `/apple/Nudge-iOS/NudgeiOSApp.swift`:
```swift
import SwiftUI
import GoogleSignIn
import NudgeCore
import NudgeData
import NudgeUI

@main
struct NudgeiOSApp: App {
    @State private var auth: AuthRepository
    private let googleSignIn: GoogleSignInServiceIOS

    init() {
        let keychain = KeychainStorage(service: "tw.nudge.app")
        let tokenProvider: APIClient.TokenProvider = {
            try? keychain.get(for: "token")
        }

        // APIClient 先建一個基礎版，AuthRepository 的 handleUnauthorized
        // 透過 unauthorizedHandler 回調進來。
        var unauthorizedCallback: (() async -> Void)?
        let client = APIClient(
            configuration: .default,
            tokenProvider: tokenProvider,
            unauthorizedHandler: { await unauthorizedCallback?() }
        )
        let repo = AuthRepository(client: client, keychain: keychain)
        self._auth = State(initialValue: repo)

        // 建立 wrapper 以 break cycle
        unauthorizedCallback = { [weak repo] in
            await repo?.handleUnauthorized()
        }

        self.googleSignIn = GoogleSignInServiceIOS.fromInfoPlist()
    }

    var body: some Scene {
        WindowGroup {
            AuthGateView(
                auth: auth,
                onLoginRequested: performLogin
            ) {
                PlatformRootView(auth: auth)
            }
            .task {
                await auth.restoreSession()
            }
            .onOpenURL { url in
                _ = GIDSignIn.sharedInstance.handle(url)
            }
        }
        .modelContainer(NudgeModelContainer.make())
    }

    private func performLogin() async -> Result<Void, Error> {
        do {
            let idToken = try await googleSignIn.signIn()
            _ = try await auth.login(idToken: idToken)
            return .success(())
        } catch {
            return .failure(error)
        }
    }
}
```

- [ ] **Step 2: 刪掉 Xcode 預設的 `ContentView.swift`（iOS）**

在 Xcode workspace 的 `Nudge-iOS` 群組裡選 `ContentView.swift` → Delete → Move to Trash。

- [ ] **Step 3: Build iOS target**

Xcode → scheme `Nudge-iOS` → `⌘B`。
Expected: Build Succeeded。

若有 `MainActor` 相關錯誤，確認 `App` init 裡對 `AuthRepository` 的初始化有 `@MainActor` isolation——`AuthRepository` 是 `@MainActor`，`App.init` 也是 `@MainActor` 隱含，應該 OK。

- [ ] **Step 4: Commit**

Run:
```bash
cd /Users/mike/Documents/nudge
git add apple/Nudge-iOS/
git commit -m "$(cat <<'EOF'
feat(ios): wire up App entry — AuthGateView + Google sign-in + SwiftData

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 1.14: 把 macOS App 接起來

**Files:**
- Modify: `/apple/Nudge-macOS/NudgeMacApp.swift`

- [ ] **Step 1: 改 App entry**

Edit `/apple/Nudge-macOS/NudgeMacApp.swift`:
```swift
import SwiftUI
import GoogleSignIn
import NudgeCore
import NudgeData
import NudgeUI

@main
struct NudgeMacApp: App {
    @State private var auth: AuthRepository
    private let googleSignIn: GoogleSignInServiceMacOS

    init() {
        let keychain = KeychainStorage(service: "tw.nudge.mac")
        let tokenProvider: APIClient.TokenProvider = {
            try? keychain.get(for: "token")
        }

        var unauthorizedCallback: (() async -> Void)?
        let client = APIClient(
            configuration: .default,
            tokenProvider: tokenProvider,
            unauthorizedHandler: { await unauthorizedCallback?() }
        )
        let repo = AuthRepository(client: client, keychain: keychain)
        self._auth = State(initialValue: repo)

        unauthorizedCallback = { [weak repo] in
            await repo?.handleUnauthorized()
        }

        self.googleSignIn = GoogleSignInServiceMacOS.fromInfoPlist()
    }

    var body: some Scene {
        WindowGroup {
            AuthGateView(
                auth: auth,
                onLoginRequested: performLogin
            ) {
                PlatformRootView(auth: auth)
            }
            .task {
                await auth.restoreSession()
            }
            .onOpenURL { url in
                _ = GIDSignIn.sharedInstance.handle(url)
            }
            .frame(minWidth: 900, minHeight: 600)
        }
        .modelContainer(NudgeModelContainer.make())

        Settings {
            Text("設定（Phase 5 實作）")
                .padding(40)
        }
    }

    private func performLogin() async -> Result<Void, Error> {
        do {
            let idToken = try await googleSignIn.signIn()
            _ = try await auth.login(idToken: idToken)
            return .success(())
        } catch {
            return .failure(error)
        }
    }
}
```

- [ ] **Step 2: 刪掉 Xcode 預設的 `ContentView.swift`（macOS）**

在 Xcode workspace 的 `Nudge-macOS` 群組裡選 `ContentView.swift` → Delete → Move to Trash。

- [ ] **Step 3: Build macOS target**

Xcode → scheme `Nudge-macOS` → `⌘B`。Expected: Build Succeeded。

- [ ] **Step 4: Commit**

Run:
```bash
cd /Users/mike/Documents/nudge
git add apple/Nudge-macOS/
git commit -m "$(cat <<'EOF'
feat(macos): wire up App entry — AuthGateView + Google sign-in + SwiftData

Includes placeholder Settings scene for Phase 5.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 1.15: 手動驗收：iOS + macOS 完整 auth flow

**Files:** 無 code change；這是驗證 gate。

**不能跳過這 task**——對應 CLAUDE.md 的「完成定義」：build 過不等於完成，必須實跑完整流程。

- [ ] **Step 1: iOS 首次登入**

1. 開 Xcode workspace → scheme `Nudge-iOS` → target device iPhone 16 Pro simulator → `⌘R`
2. App 啟動應該短暫顯示 progress spinner（restoreSession 中），然後進入 LoginView
3. 點 "Sign in with Google"
4. Google 登入視窗彈出 → 選 Google 帳號 → 授權
5. 登入成功 → 看到 TabView 4 個 tab
6. 切到「設定」tab → 看到自己的 email 和名字

Expected: 全流程順暢，沒 crash、沒空白畫面、沒卡住的 loading。

- [ ] **Step 2: iOS 自動登入**

1. 不要登出，直接 `⌘.` 停止 app
2. 再 `⌘R` 啟動
3. 應該短暫 spinner 後直接進入 TabView（跳過 LoginView）

Expected: 自動登入成功，不需重新登入。

- [ ] **Step 3: iOS 登出**

1. 設定 tab → 按「登出」
2. 應該立刻回到 LoginView

Expected: 回到登入頁，token 已清。

- [ ] **Step 4: macOS 同樣三步驗證**

1. Scheme `Nudge-macOS` → `⌘R`
2. 重複上面 Step 1-3 的流程，但在 Mac 實機上

Expected: 所有流程同樣順暢。特別注意：
- Google 登入視窗在 macOS 是否正確彈出（`ASWebAuthenticationSession` 會開系統 browser）
- 登入後視窗大小是否合理（spec 設 minWidth 900 / minHeight 600）
- 設定 sidebar item 是否能切換，登出按鈕能按

- [ ] **Step 5: 測 401 自動登出（可選但建議）**

1. iOS 登入後，手動去 server 端刪掉 user 的 session 或改 JWT secret
2. 切回 app、做任何需要驗證的動作（目前只有 restoreSession 會打 /api/me，所以重啟 app）
3. 應該自動跳回 LoginView

Expected: 401 被 APIClient 接到 → unauthorizedHandler → AuthRepository.handleUnauthorized → LoginView。

若 Phase 1 沒有其他 API call 能觸發 401，這個測試可以延到 Phase 2 用 `/api/daily` 驗。

- [ ] **Step 6: 撰寫驗收 log**

在 commit message 記錄驗收過的裝置：

Run:
```bash
cd /Users/mike/Documents/nudge
git commit --allow-empty -m "$(cat <<'EOF'
chore(apple): Phase 1 verification log

Verified manually:
- [x] iOS simulator (iPhone 16 Pro): Google sign-in → TabView → auto-login → logout
- [x] macOS (host machine): Google sign-in → NavigationSplitView → auto-login → logout

Remaining for Phase 2:
- 401 auto-logout (no API endpoint yet to trigger)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: empty commit 成功。這是給你未來 review 時看驗收過什麼。

---

## Phase 1 Definition of Done

- [x] `/mobile/` 已刪除
- [x] `/apple/` 含 Xcode workspace、iOS + macOS target、NudgeKit Swift Package
- [x] `swift test` 在 NudgeKit 目錄全綠（至少 21 個 test 全 pass）
- [x] iOS simulator 能 Google 登入 → 看到 TabView → 自動登入 → 登出
- [x] macOS 實機能 Google 登入 → 看到 NavigationSplitView → 自動登入 → 登出
- [x] 所有 commit 遵守 commit message 格式

---

## 後續 Phase 的入口

完成 Phase 1 後，下一步是 Phase 2（每日任務）。啟動 brainstorming / writing-plans 時：

- 參考 spec `docs/superpowers/specs/2026-04-17-swift-rewrite-design.md` 的 Phase 2 章節
- 已建立的共用骨架：`APIClient`、`AuthRepository`、`KeychainStorage`、`NudgeModelContainer`、`PlatformRootView`
- Phase 2 的第一個 task 會是：替換 `PlaceholderTab("行動")` 為真正的 `TodayTasksView`，需要新增：
  - `TaskItem` `@Model`（重新命名避免 Swift Concurrency 衝突）
  - `TaskRepository`
  - `/api/daily/[date]` DTO
  - `CalendarStripView`
- SwiftData schema 會從空的變成含 `TaskItem` / `Tag` 等

---

## Self-Review Notes

- **Spec coverage**：對齊 Phase 0（砍 Flutter、Xcode 骨架）+ Phase 1（auth / HTTP / SwiftData / 導航骨架）
- **模型命名**：domain model 將在 Phase 2 統一用 `TaskItem`（Spec 已決議）；Phase 1 尚未建立 domain model，只有 `UserDTO`，無衝突
- **相依方向**：NudgeCore → NudgeData → NudgeUI 單向（Package.swift 的 dependencies 已鎖）；iOS/macOS target 才碰 UIKit/AppKit
- **TDD**：純 Swift 邏輯（APIError、APIClient、KeychainStorage、AuthRepository、DTOs）全部先寫 failing test 再實作；Xcode GUI 設定和 SwiftUI View 不強求 TDD
- **手動驗收 gate**：Task 1.15 對應 CLAUDE.md 的「完成定義」——build 過不夠，必須實跑

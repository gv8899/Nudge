# Nudge Apple（iOS + macOS）

這個目錄是 Nudge 的 Swift app——iOS 與 macOS 共用 SwiftUI codebase。

## 首次 checkout 後設定

Xcode project 是從 `project.yml` 動態產生的（不 commit 進 repo）。首次 clone 後跑：

```bash
brew install xcodegen                  # 一次性安裝
cd apple
xcodegen generate                       # 產 Nudge.xcodeproj
open Nudge.xcodeproj                    # Xcode 開啟
```

## 改到 target 設定時

修改 `apple/project.yml`，然後 `xcodegen generate` 重新產生。**不要直接在 Xcode GUI 改 target 設定**——會被下次 generate 蓋掉。

Source 檔案（`.swift`、`.entitlements`）直接編輯即可；xcodegen 用 synchronized folder 自動吃進去。

## 結構

```
apple/
├── project.yml                 ← xcodegen 設定（source of truth）
├── Nudge.xcodeproj             ← generated（.gitignore）
├── Nudge-iOS/                  ← iOS target source
├── Nudge-macOS/                ← macOS target source
└── NudgeKit/                   ← 共用 SPM package（Core / Data / UI）
    ├── Package.swift
    ├── Sources/
    └── Tests/
```

## 常用指令

```bash
# 跑 NudgeKit unit tests
cd apple/NudgeKit && swift test --no-parallel

# Build iOS target（command-line）
cd apple && xcodebuild -project Nudge.xcodeproj -scheme Nudge-iOS -destination 'generic/platform=iOS Simulator' build

# Build macOS target
cd apple && xcodebuild -project Nudge.xcodeproj -scheme Nudge-macOS build
```

## OAuth client IDs

存在 Info.plist 的 user-defined keys：
- `GoogleIOSClientID`: iOS OAuth client（Bundle ID `tw.nudge.app`）
- `GoogleMacClientID`: macOS OAuth client（Bundle ID `tw.nudge.mac`）

URL schemes 也在 Info.plist 的 `CFBundleURLTypes`。兩者都是 `project.yml` 裡直接寫。

Client IDs 不算 secret（只綁 bundle ID + code signing），放進 repo 是 OK 的。

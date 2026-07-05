# Nudge

輕量的個人任務 / 日誌 app。每天知道該做什麼、做了什麼，工具等你不是追你。

跨平台：**Web (Next.js)** + **iOS (SwiftUI)** + **macOS (SwiftUI)**，三邊共用同一個後端 + 同一份 i18n string。Apple 端的 rich-text editor 跟 Web 共用 TipTap source（透過 WKWebView bundle），確保體驗一致。

## Repo 結構

```
nudge/
├── src/                 ← Next.js web + API routes (App Router)
├── drizzle/             ← Postgres migrations (drizzle-orm)
├── apple/               ← Swift app (iOS + macOS + NudgeKit shared package + Widget)
│   └── NudgeEditor/     ← TipTap bundle (Vite) for WKWebView
├── i18n/                ← Canonical translation source + sync tool
└── docs/superpowers/    ← Feature specs + implementation plans
```

各子系統都有自己的 README：
- [`apple/README.md`](apple/README.md) — Swift app bootstrap, xcodegen, build 指令
- [`apple/NudgeEditor/README.md`](apple/NudgeEditor/README.md) — TipTap bundle build / dev 流程
- [`i18n/README.md`](i18n/README.md) — 對話式翻譯 workflow（不需 API key）
- [`AGENTS.md`](AGENTS.md) — Web + Apple 的設計系統規則（color tokens / i18n / 元件慣例）

## Quick Start (Web + API)

需要 Node.js 20+ 跟 Postgres 16+。

```bash
npm install
cp .env.example .env.local      # 填 DATABASE_URL / AUTH_GOOGLE_* / AUTH_SECRET / CALENDAR_TOKEN_KEY
npm run dev                     # http://localhost:3000
```

跑 migration：

```bash
psql "$DATABASE_URL" -f drizzle/0000_freezing_master_mold.sql
# ... 依序跑到最新一支 SQL
```

> ⚠️ **Dev / prod 共用同一個 Postgres** 時做 migration，先確保新 code 已經 deploy（避免 schema 領先 code 的危險窗口）。

## Apple App

```bash
brew install xcodegen
cd apple && xcodegen generate
open Nudge.xcodeproj
```

iOS Debug build 預設打 `http://localhost:3000`（DEBUG = development），Release / TestFlight 打 `https://nudge.tw`（看 `apple/NudgeKit/Sources/NudgeCore/APIConfiguration.swift`）。

詳細 build / archive / TestFlight 流程看 [`apple/README.md`](apple/README.md)。

## Stack

| 層 | 技術 |
|---|---|
| Web UI | Next.js 16 (App Router) + React 19 + Tailwind + shadcn/ui-style tokens |
| API | Next.js Route Handlers + auth.js (Google OAuth) |
| DB | Postgres + drizzle-orm |
| 即時同步 | 30s polling + ETag conditional GET (304 短路) |
| Editor | TipTap 3 (Web 用 React adapter；iOS/macOS 用 Vite bundle 跑在 WKWebView) |
| iOS / macOS | Swift 6 + SwiftUI（iOS 18 / macOS 15 deployment target；glassEffect 走 `#available(iOS 26)` 降級）+ WidgetKit + SwiftData cache |
| i18n | 自製 sync tool，canonical zh-TW + LLM 生成 en/ja → 鏡像到 web `src/messages` 與 Apple xcstrings |
| Deploy | Zeabur（Next.js + Postgres）+ TestFlight (iOS) |

## 主要功能

- 每日任務清單（per-day assignments，獨立於 task entity，可重複歸日）
- 「前幾天」未完成任務 rollup（overdue 區塊）
- 重複任務（每日 / 每週 / 每月，含「跳過這次」menu）
- 智慧通知（早上 / 晚上時間點 + per-task 提醒）
- Daily note（每天一段自由文字）
- 三平台 rich-text editor（task description / daily note）
- iOS Widget v1（home screen 顯示今日任務 + 跨日切換邏輯）
- Google Calendar 整合（顯示今日 events）
- 三語介面（zh-TW / en / ja）

## Branch / 部署流程

- `main` 是部署 branch；Zeabur 偵測 push 自動 build + deploy
- branch protection：禁止直 push main，所有改動走 PR
- TestFlight：bump `apple/project.yml` 的 `CURRENT_PROJECT_VERSION` → PR → merge → `xcodebuild archive` → Organizer upload

> 細節看 `docs/superpowers/specs/` 和 `docs/superpowers/plans/`，每個 feature 都有對應 spec + plan markdown。

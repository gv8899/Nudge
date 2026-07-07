<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# 專案速覽 & 常用指令

三邊共用同一後端 + 同一份 i18n source：**Web (Next.js / `src/`)**、**iOS + macOS (SwiftUI / `apple/`)**、**Flutter mobile (`mobile/`)**。各子系統細節看自己的 README（`apple/README.md`、`apple/NudgeEditor/README.md`、`i18n/README.md`）；這份只記「跨檔開發時最容易漏」的規則。

| 任務 | 指令 |
| --- | --- |
| Web dev server | `npm run dev` |
| Web build（語法驗證） | `npx next build` |
| 單元測試（vitest） | `npm test`（單檔：`npx vitest run <path>`） |
| Lint | `npm run lint` |
| i18n 同步 | `npm run i18n:sync`（CI 檢查：`npm run i18n:check`） |
| Apple 重生 xcodeproj | `cd apple && xcodegen generate`（改 `project.yml` 後必跑；`.xcodeproj` 不進 git） |
| Mac DMG 打包 | `./apple/scripts/build-dmg.sh` |
| 裝 pre-commit hook | `./scripts/install-git-hooks.sh`（一次性，掛 Swift token lint + commit 時自動增量更新 codebase 圖譜） |
| 裝 codebase 圖譜 MCP | `./scripts/setup-codebase-memory.sh`（新 clone / 新機器一次性，裝 binary + 註冊 MCP + 建索引） |

- **測試慣例**：vitest，測試檔跟 source 同層放 `*.test.ts`。純邏輯（`recurrence`、`schedule-validation`、i18n transpile）都有測試 — 改這些先補 / 跑測試（紅→綠）。
- **pre-commit hook**：`scripts/install-git-hooks.sh` 會掛 `lint-swift-tokens.sh`，commit 時擋硬編碼 Swift 色；同時**增量更新 codebase 圖譜**（sub-second、non-fatal、沒裝 MCP 就自動跳過），讓架構圖永遠跟 commit 同步。新 clone 記得跑一次，不然 token 違規會漏出去。

# 設計系統

寫任何 UI 之前，先參考既有設計系統，**不要憑空挑顏色或樣式**：

## Web (Next.js / src/)

- **Design tokens**：定義在 `src/app/globals.css`（CSS 變數）。可用的語義 token 包含 `background`、`foreground`、`muted`、`muted-foreground`、`primary`、`destructive`、`border`、`text-dim`、`text-faint`、`surface-hover`、`weekend`、以及 `chart-1`～`chart-5`（語義配色）
- **Tailwind 對應**：用 `bg-*`、`text-*`、`border-*` + token 名（例：`text-chart-2` 對應警告/橘黃，`text-text-dim` 對應次要文字）
- **狀態色**：定義在 `src/lib/constants.ts` 的 `TASK_STATUSES`，每個狀態都有 `color` 和 `bgColor`
- **既有元件對齊**：新元件的 layout、間距、checkbox 樣式應參考相似既有元件（如新任務元件先讀 `src/components/task/task-card.tsx`），不要自己另起一套
- **禁止**：硬編碼 hex 色、隨意挑 Tailwind 預設色（`amber-400`、`blue-500` 等都不可），所有顏色必須來自 design system token
- **i18n（重要 — 來源已換）**：UI 字串的**唯一 source 是 `i18n/canonical/zh-TW.json`**（巢狀 JSON + ICU MessageFormat）。`src/messages/*.json` 是 `npm run i18n:sync` 的**生成檔**，**不要手改**，手改會被下次 sync 蓋掉。新增 / 改 key：改 `canonical/zh-TW.json` → 跑 `npm run i18n:sync`（en/ja 待翻譯會列進 `i18n/.pending-translations.md`，在對話裡請我翻）→ 再 sync 一次轉檔到 web (`src/messages`) + flutter (`mobile/lib/l10n/*.arb`)。詳見 `i18n/README.md`。

## Apple (apple/ — iOS + macOS / SwiftUI)

- **Color tokens**：只准用 `Color.nudgeXxx`（看 `apple/NudgeKit/Sources/NudgeUI/Tokens/Color+Nudge.swift`）。語義層：`nudgeDestructive` / `nudgeSuccess` / `nudgeWarning` / `nudgeInfo`。元件層：`nudgeBackground` / `nudgeForeground` / `nudgePrimary` / `nudgePrimaryForeground` / `nudgeBorder` / `nudgeBorderLight` / `nudgeTextDim`。圖表層：`nudgeChart1..5` 只給資料視覺化用，不當狀態色挪用。
- **禁止 Swift 色**：`Color.blue` / `.red` / `.gray` / `.accentColor` / `Color(red:green:blue:)` / `"#RRGGBB"` 都不准。pre-commit hook (`scripts/lint-swift-tokens.sh`) 會擋；真需要 literal（tag hex parser 類）加 `// nudge:allow-color` 逐行白名單。
- **i18n**：`Text("key", bundle: .module)`，`bundle: .module` 一定要帶；key 存在 `apple/NudgeKit/Sources/NudgeUI/Resources/Localizable.xcstrings`。**注意：xcstrings 不在 `i18n:sync` 範圍內，仍要手動鏡像** — 先確認 canonical (`i18n/canonical/zh-TW.json`) 有該 key（沒有就先按上面 Web i18n 流程加進 canonical 並 sync），再把同名 key + 翻譯補進 xcstrings。不要直接在 xcstrings 憑空生 key。
- **Icon-only 按鈕**：一律用 `IconButton(systemName: accessibilityLabel: action:)`（44×44 + a11y label 已 bake 進去），不要自己組 `Button { Image(...) }`。
- **Checkbox**：`NudgeCheckbox(isChecked: accessibilityLabel: action:)`。
- **主要 action button**：`NudgeButton("common.xxx", variant: .primary/.secondary/.destructive, action:)`。
- **系統元件初始化**：iOS 的 TabBar / NavigationBar 預設吃系統藍灰，靠 `NudgeAppearance.configure()` 在 App init 一次性套 token；加新系統元件（toolbar、searchbar 等）時擴充該檔而不是每個 view 自己 tint。
- **i18n 鏡像原則**：`common.edit` / `common.confirm` 這類「通用按鈕」如果還沒有，**先加到 `i18n/canonical/zh-TW.json` 並 `npm run i18n:sync`**（生成 Web messages），再把 key 補到 xcstrings。三邊（iOS / macOS / Web）key 名與翻譯對齊。
- **Definition of Done**：SwiftUI 寫完 `swift build` 過不等於好，**必須另外跑 `xcodebuild -scheme Nudge-iOS ... build`**（SwiftUI modifier 很多只在 full target build 才報錯，例如 `Label(text:systemImage:)` 不存在這種）。iOS/macOS 互動功能必須在模擬器實測。

# 資料庫 & migration

- Schema source = `src/lib/db/schema.ts`（drizzle-orm）。Migration SQL 在 `drizzle/`，**依序手動跑**：`psql "$DATABASE_URL" -f drizzle/000X_xxx.sql`。package.json **沒有** `drizzle-kit push/migrate`，不要假設有自動 migrate。
- 改 schema 流程：改 `schema.ts` → `npx drizzle-kit generate` 產新 SQL → 人工檢視 → 依序跑。
- **部署順序雷**：production 與 dev 可能共用同一個 Postgres。跑 migration 前先確保「依賴新欄位的 code」已經上線，否則還在跑舊 code 的進程會撞到 schema 不一致。加欄位優先用 nullable / default，必要時分兩段部署（先上相容 code，再跑 migration）。

# Codebase 知識圖譜 (codebase-memory MCP)

本專案已建 codebase 知識圖譜（user-scope MCP `codebase-memory-mcp`，專案名 `Users-huangyujia-Documents-Nudge`）。以下情境**先查圖、不要只 grep**：

- **改共用純邏輯前**（`recurrence.ts` / `RecurrenceCalculator.swift`、`schedule-validation` 等）→ 用 `trace_path(direction=inbound)` 抓完整 caller / route 衝擊面，確認回歸範圍（例：改 `occurs` 會牽動 `/api/daily/[date]`、`/api/daily/week`、`PUT`/`DELETE /api/tasks/[id]/recurrence` 等多條 route）。
- **問「誰呼叫 X / 改 X 會炸到誰 / X 的資料怎麼流」** → `trace_path`（modes: `calls` / `data_flow` / `cross_service`），勝過 grep。
- **找定義、跨 TS/Swift 鏡像** → `search_graph`（BM25 + 語意），一次撈兩邊同名函式。
- **找效能瓶頸 / 該重構的複雜函式** → `query_graph` Cypher 查 complexity 屬性（`cognitive` / `transitive_loop_depth` / `linear_scan_in_loop`）。⚠️ 過濾掉 `Resources.Editor`（打包過的第三方 bundle，是雜訊）。

工具是 deferred，用前先 `ToolSearch` 載入。**圖是快照** —— code 改過後先跑 `detect_changes` 增量更新，圖才跟得上。3D 視覺化：`codebase-memory-mcp --ui=true` 後開 `http://localhost:9749/`。

> **新機器 / 新 clone**：binary、MCP 註冊、索引都是本機專屬、**不跟著帳號同步**，跑一次 `./scripts/setup-codebase-memory.sh` 補齊（idempotent，可重跑），然後重啟 Claude Code。

# 架構備忘（容易踩雷的設計）

## 重複任務 (recurrence) = lazy materialization

- 規則存 `task_recurrences`；判斷某天是否 occur 的純邏輯在 `src/lib/recurrence.ts` 的 `occurs()`，**鏡像**在 iOS `NudgeCore/RecurrenceCalculator.swift`（給 local notification 排程）。**改一邊，兩邊測試都要過。**
- occurrence 不是預先全展開：`GET /api/daily/[date]` 在被要求那天才用 `occurs()` + `ON CONFLICT DO NOTHING` 把當天 row 補進 `daily_task_assignments`。週檢視 (`/api/daily/week`) 只算虛擬圓點、**不寫 DB**。
- **孤兒雷（這條最常炸）**：`daily_task_assignments` 沒有欄位區分「規則自動展開」vs「使用者手動排的」。所以把規則改窄 / 刪規則時，舊規則展開、現在落在窗外的未來 row 會變孤兒（永遠卡 overdue，或日期=今天時誤現在「今天」清單）。`PUT` / `DELETE /api/tasks/[id]/recurrence` 必須用 `assignmentsToReap()` 對帳回收 —— 只回收 `date > today && !isCompleted && !isSkipped && 落在新規則窗外`；過去 / 今天 / 已完成 / 已跳過一律保留。**動這條 API 時別把對帳邏輯拿掉。**
- `/api/daily` 走 ETag 條件式 GET；ETag 計算要把 `task_recurrences` 一起算進去，否則改規則後會 304 假陽性（見 commit `0bd4f98`）。

# 完成定義 (Definition of Done)

**不能僅依靠 `next build` 成功就宣稱任務完成**。Build 只證明語法正確，不證明邏輯可用。對於任何互動功能，必須**完整走過使用者流程**後才能回報完成。

## 強制檢查清單

修改或新增任何「互動功能」時，必須在回報前逐項確認：

- [ ] **Build 通過**（`npx next build` 無錯）
- [ ] **實際操作整條路徑**：從「使用者第一次看到這個功能」到「達成目的」的完整流程，每一步都跑過
- [ ] **邊界情況**：hover → click、hover → 移到另一個元素、mouse leave、focus + blur、鍵盤導覽等
- [ ] **重新整理後的狀態**：若有持久化，reload 後還能看到正確結果
- [ ] **沒 race condition**：async 操作完成後 UI 正確同步

## 特別容易漏的場景（歷史血淚）

- **拖放（drag-and-drop）**：hover 看到 handle ≠ 能拖。必須實際點住、拖到目標、放開、驗證節點真的移動。滑鼠從觸發區（文字）移到 handle（padding）時，handle 不能消失。
- **Popover / 浮動選單**：顯示 ≠ 能點。移動滑鼠離開觸發區時，元素可能瞬間消失。
- **自動儲存**：debounce 完成、fetch 完成、SWR cache 失效、其他頁面看得到更新 — 全部都要確認。
- **Keyboard trap / focus 還原**：Modal 開關後 focus 要回到觸發元素。
- **Mobile 響應式**：桌機看對 ≠ 手機正確（觸控目標、hover 失效等）。

## 禁止的行為

- ❌「build 過了我看起來應該 OK」
- ❌「這邏輯看起來對所以應該 work」
- ❌ 改了互動功能卻只 run build 就 commit

## 當無法親自測試

若我無法親自操作（沒有瀏覽器、環境限制等），**必須明確告訴使用者「我只驗證了 build 語法正確，實際互動流程沒有跑過，請幫我測試以下步驟：...」**，並列出具體的測試步驟讓使用者代跑。

**不要預設「應該 OK」而直接報完成**。

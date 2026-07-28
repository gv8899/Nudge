# 交接：Mac app 三個 UI 小問題

> 換另一台電腦接手用。這份是自足文件 —— 新機器開一個新的 Claude Code session，把這份丟給它即可續作。

## 0. 環境 / git 狀態（新機器先做）

- 分支 **`main`**，已 push、乾淨。新機器 `git pull` 即可。
- **codebase-memory MCP 不跟帳號同步**：新機器跑一次 `./scripts/setup-codebase-memory.sh`（idempotent），再重啟 Claude Code，`search_graph` / `trace_path` 才可用。
- **Mac 前端依賴**：`node_modules` 若舊，先 `npm install`（本輪修過一次 pull 後缺 `@paddle/paddle-node-sdk`）。改 `apple/project.yml` 要 `cd apple && xcodegen generate`。
- 目前 Mac build = **128**（`apple/project.yml` `CURRENT_PROJECT_VERSION: "128"`）。

## 1. 任務（使用者原話，全部是 **macOS app**，不是 Web）

1. 任務頁點擊任務彈出 modal 時：(a) 光標要出現在標題（autofocus）、(b) 光標顏色要主色；(c) 點擊展開時要出現在（行動頁的）右側區域，**不管有沒有內文都要出現**——實測後釐清真正 bug 是「**展開後右側面板沒換成新卡片、停在舊的**」。
2. 卡片詳細頁的標題出現**藍色光標**、打中文時 **IME 底線也是藍色** → 要變主色。

## 2. 關鍵前提（省得走冤枉路）

- 這些都在 **`apple/NudgeKit/Sources/NudgeUI/`**，不是 Web。（曾一路在 nudge.tw 上測，被糾正。見記憶 `feedback_ui-bug-default-mac.md`。）
- **macOS 的 TextField 光標(caret) 與中文 IME 底線不吃 SwiftUI `.tint`**，跟隨系統 accent 色（使用者系統 accent 是藍）。`CardDetailView.swift:314` 早就有 `.tint(Color.nudgePrimary)`（PR #22 加的，遠早於 build 128）仍是藍 → 證實 `.tint` 無效，**要 AppKit 層改 `insertionPointColor`**。
- **Claude 無法自己跑 Mac app / 看光標色** → 每項改完都要**使用者 build & 實測**。DoD：`swift build` 不夠，要 `xcodebuild -scheme Nudge-iOS ... build` + 模擬器/實機（AGENTS.md）。

## 3. 逐項：定位 + 修法

### 1(c) 展開後右側面板停在舊卡片（建議先做，影響最大）
- **根因候選（強）**：`DailyHostView.swift:1050 dashboardCardsColumnDetail(_ card:)` 渲染 `DashboardColumnCardDetail(card:...)` **沒有 `.id(card.id)`** → 切換卡片時不重 mount，內部 `@State` 停在舊卡。
- **對照（可用的正確 pattern）**：`CardsHostView.swift:302` 全頁 detail 有 `.id(card.id)`（註解：「讓切換卡片時 CardDetailView 重 mount、@State 重灌」）。
- **修法**：在 `dashboardCardsColumnDetail` 的 `DashboardColumnCardDetail(...)` 後加 `.id(card.id)`。（或確認 `DashboardColumnCardDetail` 內部有無 `@State` 種子只灌一次。）
- **待驗證**：確認「任務彈窗 → 展開」這條路徑最終是設 `dashboardCardDetailCard`（該 state 設值點：`DailyHostView.swift:964 / 1034 / 1261`）。若展開走的是另一條 present，改對應那條的重 mount。
- 相關 state：`@State dashboardCardDetailCard: CardDTO?`（`DailyHostView.swift:76`）；渲染分支 `dashboardCardsColumn`（:975）。

### 1(a) 任務詳情開啟時標題 autofocus
- `CardDetailView.swift:299` 已有 `@FocusState private var titleFocused`，`:315 .focused($titleFocused)`，但**沒有在出現時設 `titleFocused = true`**。
- **修法**：在該詳情作為「彈窗/詳情」呈現時 `.onAppear { titleFocused = true }`（注意只在 modal/popup 情境，別讓全頁瀏覽也強搶焦點——確認呈現路徑）。
- 可參考 working 範例：`CardSearchComponents.swift:34-35`（`.tint(nudgePrimary)` + `.focused` 一起）、`dashboardCardsSearchField` 的 `.onAppear { ...Focused = true }`（`DailyHostView.swift` 內）。

### 1(b) + 2 光標 / 中文 IME 底線變主色（最需迭代、Claude 無法自驗）
- 位置：`CardDetailView.swift:304-323 macHeader` 的標題 `TextField`（已 `.tint(nudgePrimary)` 但 macOS 無效）。
- **修法方向（AppKit）**：把標題 `TextField` 換成 `NSViewRepresentable` 包的 `NSTextField`，在其 field editor 設 `insertionPointColor = NSColor(Color.nudgePrimary)`；IME marked-text 底線亦跟隨 field editor 的 insertion point / accent，一併處理。
  - 備選：全域 `NSTextView` 外觀覆寫，或設 app AccentColor asset（但**系統 accent 會覆蓋 app accent**，故不可靠，優先走 per-field NSTextField 覆寫）。
- 同樣問題可能存在於**內文編輯器**：內文是 `RichTextEditor.swift`（WKWebView + TipTap），caret 由**網頁 CSS** 控制（非 AppKit）→ 若內文 caret 也藍，改 editor 的 web 端 `caret-color`（`Resources.Editor` 打包 bundle / TipTap 樣式），與標題兩套機制不同，分開處理。
- **一定要使用者截圖回報**改後光標/底線色。

## 4. 建議順序
1(c)（狀態 bug，最有感、最好驗） → 1(a)（autofocus，簡單） → 1(b)/2（AppKit caret，需來回測）。

## 5. 相關檔案速查
- `apple/NudgeKit/Sources/NudgeUI/Cards/CardDetailView.swift`（標題 macHeader、tint、titleFocused、onExpand）
- `apple/NudgeKit/Sources/NudgeUI/Daily/DailyHostView.swift`（dashboardCardDetailCard、dashboardCardsColumnDetail、右側面板）
- `apple/NudgeKit/Sources/NudgeUI/Cards/CardsHostView.swift`（正確的 `.id(card.id)` 重 mount pattern：302）
- `apple/NudgeKit/Sources/NudgeUI/Cards/CardDetailLoader.swift`（依 id fetch CardDTO 再呈現 CardDetailView）
- Design token：`apple/NudgeKit/Sources/NudgeUI/Tokens/Color+Nudge.swift`（`Color.nudgePrimary`）
- 對照 Web（鏡像，非本次目標）：`src/components/task/task-detail-modal.tsx`、`src/components/cards/card-detail.tsx`、`src/components/daily/daily-view.tsx`（web 這條展開切換是好的，可當行為對照）

## 6. 本 session 其它已完成（背景，別重做）
- Web 的 `Failed to find Server Action` 已修：`next.config.ts` 設 `deploymentId` + `Dockerfile` builder 加 `ARG ZEABUR_GIT_COMMIT_SHA`，已 push、已部署、已驗（asset 帶 `?dpl=<SHA>`）。與本 Mac UI 任務無關。
- 記憶檔（本機 `~/.claude/.../memory/`，**不跟同步**，新機器沒有）：`feedback_ui-bug-default-mac.md`、`project_zeabur-ops.md`。新機器可視需要重建。

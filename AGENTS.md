<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# 設計系統

寫任何 UI 之前，先參考既有設計系統，**不要憑空挑顏色或樣式**：

## Web (Next.js / src/)

- **Design tokens**：定義在 `src/app/globals.css`（CSS 變數）。可用的語義 token 包含 `background`、`foreground`、`muted`、`muted-foreground`、`primary`、`destructive`、`border`、`text-dim`、`text-faint`、`surface-hover`、`weekend`、以及 `chart-1`～`chart-5`（語義配色）
- **Tailwind 對應**：用 `bg-*`、`text-*`、`border-*` + token 名（例：`text-chart-2` 對應警告/橘黃，`text-text-dim` 對應次要文字）
- **狀態色**：定義在 `src/lib/constants.ts` 的 `TASK_STATUSES`，每個狀態都有 `color` 和 `bgColor`
- **既有元件對齊**：新元件的 layout、間距、checkbox 樣式應參考相似既有元件（如新任務元件先讀 `src/components/task/task-card.tsx`），不要自己另起一套
- **禁止**：硬編碼 hex 色、隨意挑 Tailwind 預設色（`amber-400`、`blue-500` 等都不可），所有顏色必須來自 design system token

## Apple (apple/ — iOS + macOS / SwiftUI)

- **Color tokens**：只准用 `Color.nudgeXxx`（看 `apple/NudgeKit/Sources/NudgeUI/Tokens/Color+Nudge.swift`）。語義層：`nudgeDestructive` / `nudgeSuccess` / `nudgeWarning` / `nudgeInfo`。元件層：`nudgeBackground` / `nudgeForeground` / `nudgePrimary` / `nudgePrimaryForeground` / `nudgeBorder` / `nudgeBorderLight` / `nudgeTextDim`。圖表層：`nudgeChart1..5` 只給資料視覺化用，不當狀態色挪用。
- **禁止 Swift 色**：`Color.blue` / `.red` / `.gray` / `.accentColor` / `Color(red:green:blue:)` / `"#RRGGBB"` 都不准。pre-commit hook (`scripts/lint-swift-tokens.sh`) 會擋；真需要 literal（tag hex parser 類）加 `// nudge:allow-color` 逐行白名單。
- **i18n**：`Text("key", bundle: .module)`，`bundle: .module` 一定要帶；key 來自 `apple/NudgeKit/Sources/NudgeUI/Resources/Localizable.xcstrings`，鏡像 Web `src/messages/*.json`。**先查 Web 有沒有；有就沿用，沒有才在 Web 新增再 mirror**，不要直接在 xcstrings 生 key。
- **Icon-only 按鈕**：一律用 `IconButton(systemName: accessibilityLabel: action:)`（44×44 + a11y label 已 bake 進去），不要自己組 `Button { Image(...) }`。
- **Checkbox**：`NudgeCheckbox(isChecked: accessibilityLabel: action:)`。
- **主要 action button**：`NudgeButton("common.xxx", variant: .primary/.secondary/.destructive, action:)`。
- **系統元件初始化**：iOS 的 TabBar / NavigationBar 預設吃系統藍灰，靠 `NudgeAppearance.configure()` 在 App init 一次性套 token；加新系統元件（toolbar、searchbar 等）時擴充該檔而不是每個 view 自己 tint。
- **i18n 鏡像原則**：`common.edit` / `common.confirm` 這類「通用按鈕」如果 Web 沒有，**先加到 Web messages**，再補到 xcstrings。三邊（iOS / macOS / Web）key 名與翻譯對齊。
- **Definition of Done**：SwiftUI 寫完 `swift build` 過不等於好，**必須另外跑 `xcodebuild -scheme Nudge-iOS ... build`**（SwiftUI modifier 很多只在 full target build 才報錯，例如 `Label(text:systemImage:)` 不存在這種）。iOS/macOS 互動功能必須在模擬器實測。

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

# Nudge Landing Page 改版設計（淺色暖米 · Apple 產品頁風格）

**日期**：2026-06-13
**分支**：`feat/homepage-marketing`（平行 worktree）
**狀態**：設計定案，待寫實作計畫

## 目標

把現有的首頁 landing page 從「深色 + 粗黑體 + 手繪塗鴉」改成 **Apple 官網產品頁** 的質感：大量留白、精緻克制的排版、產品為主角、subtle scroll 動態。

## 定位（影響全頁主軸）

- **主打 Mac App**。受眾是辦公室上班族，主要在電腦上工作。
- **iOS 為輔助**，定位成「隨身查看」的延伸。
- 主 CTA = **下載 Mac 版（DMG）**；次 CTA = **iPhone 版 · App Store**。
- Web 登入已停用（現況），新版不做 web sign-in，純導向 App 下載。

## 視覺基底

- **色調**：淺色暖米，**鎖定不跟隨系統 dark**。沿用品牌暖色 token：
  - 背景：`#efe9d4` → 白米漸層（區塊間用 `#fffdf6` / `#f6f1e0` 製造層次）
  - 文字：`#1c1b18`，次要文字暖灰 `#6b6354`
  - 主色（accent）：棕金 `#a87a45`，只當點綴（eyebrow、按鈕、連結）
  - 暗區塊：暖深 `#1c1b18`（哲學金句段用，製造明暗對比節奏）
- **字體**：Apple 字體邏輯 — `-apple-system, "PingFang TC", "Helvetica Neue", sans-serif`。
  - 標題改 **semibold (600)**、大字級、緊 tracking（`-0.02em`）。**移除現有 `font-black` 黑體風**。
- **移除手繪元素**：`landing-doodles.tsx`（圈圈、箭頭、墨點）整個拿掉，不符 Apple 風。
- **Scroll-reveal**：區塊進場淡入 + 輕微上移（translateY），subtle。必須尊重 `prefers-reduced-motion`（關閉動態時直接顯示）。

## 區塊結構（由上到下）

採「經典 Apple 產品頁」長捲軸敘事（先前 wireframe 方案 A）：

1. **Nav** — frosted 半透明 sticky bar：Nudge 字標（左）、錨點連結（功能 / 哲學）、右側「下載」按鈕。捲動時加細底線/背景模糊。
2. **Hero** — 標題「每天，輕鬆推進一點」+ 副標 + **雙下載鈕（Mac 主 / iOS 次）** + **Mac app 視窗主視覺**（不是 iPhone）。
3. **哲學金句**（暖深色 `#1c1b18` 全幅區塊）— 「工具該等你，不是追你」。明暗對比節點。
4. **① 每日任務** — 大 mockup + 標題，帶三點：自動延續 / 重新排程 / 任務狀態。
5. **② 日誌** — 左文右圖。
6. **③ 卡片** — 大 mockup + markdown 卡片詳情。
7. **跨平台同步** — Mac 為主角、iPhone/iPad 為延伸（文案：「在桌機規劃，手機隨身查看」）。
8. **Bento 小功能格** — 次要亮點（重複任務、標籤、日曆檢視、搜尋…）。
9. **結尾大 CTA** — 全幅下載收尾，重申 Mac 主 / iOS 次。
10. **Footer** — Privacy / Terms（沿用現有 `/privacy`、`/terms` 路由）+ 版權。

## 元件結構（`src/components/landing/`）

重寫 / 新增：

| 元件 | 角色 | 備註 |
| --- | --- | --- |
| `landing-page.tsx` | 編排 + 暖色淺色主題 wrapper | 移除 `dark` class；**移除 `signInAction` prop** |
| `landing-nav.tsx` | frosted sticky nav + 下載鈕 | 加錨點連結、捲動樣式 |
| `landing-hero.tsx` | 標題 / 副標 / 雙下載鈕 / Mac 主視覺 | 不再用 `SignInForm` |
| `download-buttons.tsx` | **新增** 共用下載鈕（Mac DMG 主 + App Store 次） | 連結走 constants placeholder |
| `landing-philosophy.tsx` | 暖深色金句區 | 拿掉 InkSparkle 墨點 |
| `landing-feature-tasks.tsx` | ① 每日任務段 | 由現 `landing-features` 拆出 |
| `landing-feature-notes.tsx` | ② 日誌段 | |
| `landing-feature-cards.tsx` | ③ 卡片段 | |
| `landing-platforms.tsx` | **新增** 跨平台（Mac 主） | |
| `landing-highlights.tsx` | **新增** Bento 小功能格 | |
| `landing-footer-cta.tsx` | 結尾 CTA + footer | 改用 `download-buttons`，移除 `SignInForm` |
| `scroll-reveal.tsx` 或 `use-scroll-reveal.ts` | **新增** IntersectionObserver 進場動態 | 尊重 reduced-motion |

**沿用並重新上淺色妝**的既有 mockup 元件：`mockup-tasks` / `mockup-notes` / `mockup-cards` / `mockup-card-detail` / `mini-mockups`（目前是深色，要改成暖米淺色版）。

**移除**：`landing-doodles.tsx`、`sign-in-form.tsx`（landing 不再用；確認無其他引用後再刪）。

## 下載連結（placeholder）

App Store URL 與 Mac DMG 託管位置**尚未確定**。先在 constants（例如 `src/lib/landing-links.ts`）放 placeholder：

```ts
export const DOWNLOAD_LINKS = {
  mac: "#",      // TODO: Mac DMG 託管 URL
  ios: "#",      // TODO: App Store URL
};
```

之後拿到正式連結只改這一處。

## 真實截圖（hybrid 策略）

採「圖片槽」設計：Hero 的 Mac 視窗、跨平台區可之後直接換上真實 iOS/Mac 截圖。**在拿到截圖前，先用重新上妝的 CSS mockup 撐版**，不阻塞開發。截圖為後續內容依賴，非開發 blocker。

## i18n

- 所有 UI 文案進 `i18n/canonical/zh-TW.json` 的 **`landing.*` namespace**（巢狀 + ICU）。
- 跑 `npm run i18n:sync` 生成 `src/messages/*.json`（**不手改生成檔**）。
- en / ja 待翻會列進 `i18n/.pending-translations.md`，在對話裡請使用者翻。
- landing 頁面在 `(landing)` route group，需確認 next-intl 在此 route 取得 zh-TW messages 的方式（沿用專案既有作法）。

## 主題隔離

landing 頁強制淺色暖米，與 app 內主題系統互不影響。作法：在 `src/app/globals.css` 用 `[data-landing]` scope 覆寫一組暖色 CSS 變數（`--background`、`--foreground`、`--primary`、暖灰次要文字等），`landing-page.tsx` 帶 `data-landing` 屬性（現已有）。移除目前強制的 `dark` class。

## 動態與無障礙

- Scroll-reveal 用 IntersectionObserver，一次性觸發（進場後不再隱藏）。
- `prefers-reduced-motion: reduce` 時，全部動態關閉、內容直接可見。
- Nav 下載鈕、錨點連結具鍵盤可達性與 focus 樣式。
- 下載按鈕用 `<a>`（語意正確），placeholder 期間 `href="#"`。

## 測試 / 完成定義

- `npx next build` 通過（語法）。
- `npm run lint` 通過（含硬編碼色檢查——所有顏色走 token，不可硬編 hex / 隨意 Tailwind 預設色）。
- `npm run i18n:check` 通過。
- **實際走過互動流程**（依專案 Definition of Done）：
  - sticky nav 捲動行為、錨點跳轉
  - scroll-reveal 進場（含 reduced-motion 開關）
  - 下載按鈕 hover / focus / 點擊（placeholder 期間不導頁）
  - 響應式：桌機 / 平板 / 手機（觸控目標、區塊堆疊）
  - reload 後狀態正確
- 互動驗證若無法本機親跑，明確告知使用者代測步驟，不預設「應該 OK」。

## 不做（YAGNI / 範圍外）

- 不做 web 登入 / sign-in（已停用）。
- 不動 `src/api/*` 共用後端。
- 不做 blog / 多頁行銷站，只做單頁 landing + 既有 Privacy/Terms。
- 真實截圖製作不在本次開發範圍（內容依賴，後補）。

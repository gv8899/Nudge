# HERO Landing 頁面設計

## 摘要

未登入訪客進入 `/` 時，看到一個完整的行銷 landing page 介紹 nudge。採用 Apple product page 風格（大字、深空間、每個功能自成一 section），配合既有的墨水紙張 dark 色系。目的是讓「分享 URL 給朋友看」時能完整呈現產品概念、功能、哲學與視覺識別。

## 核心決策

| 項目 | 決定 |
|------|------|
| 路由 | `/` 未登入渲染 landing、已登入 redirect 到 `/day/{today}` |
| `/login` | 保留作為後備直接登入入口 |
| 主題 | 強制 dark mode（`.dark` class），不受使用者偏好影響 |
| 紙質感紋理 | **不啟用**，landing 頁保持乾淨 |
| Light mode | 不支援（本版 scope 內） |
| Sidebar | 不顯示（landing 與 app 分開） |
| Mockup | 用 CSS 重現 UI 概念，不使用截圖（永遠跟 UI 同步） |
| 區塊數 | 5 段：Nav / Hero / Features / 哲學 / 底部 CTA |

## 主文案

### 主標語
> 每天，輕鬆推進一點

其中「輕鬆」二字用 `--primary` (sepia amber) 色強調。

### 副標
> 讓任務和日常，在不打擾的節奏裡前進

### 底部 CTA 主標
> 你的日子 值得更安靜的工具

### 哲學引言
> "我想要一個不催促的工具，  
> 它在我打開的時候才存在。"

## 頁面結構

### Section 1：頂部 Nav Bar

極簡固定頂部 bar：
- **左**：`nudge` text logo（font-semibold，text-lg，`--foreground` 色）
- **右**：GitHub icon（lucide `Github`，連到 repo，若無連結先 hidden）
- 背景：透明；`position: fixed; top: 0; left: 0; right: 0`
- 高度：56px
- 內部 padding：與頁面內容同樣的 `max-w-6xl` + `px-6 md:px-8`
- 捲動時不變更樣式（保持透明）

### Section 2：Hero

佈局：左靠，非對稱。容器 `max-w-6xl mx-auto px-6 md:px-12 pt-40 pb-32`。

- **Eyebrow**：`NUDGE`，`text-xs font-bold tracking-[0.25em] uppercase text-primary mb-7`
- **主標**：
  - `text-[84px] font-black leading-[0.95] tracking-[-0.04em] max-w-[800px] mb-9`
  - 字串：`每天，` + `<span class="text-primary">輕鬆</span>` + `推進一點`
  - Mobile 上降到 `text-5xl`（48px）
- **副標**：
  - `text-lg md:text-xl text-text-dim max-w-[560px] leading-relaxed mb-10`
  - `讓任務和日常，在不打擾的節奏裡前進`
- **CTA**：
  - 外框按鈕：`inline-flex items-center gap-2 px-7 py-3.5 rounded-xl border border-foreground text-foreground text-sm font-semibold hover:bg-foreground/5 transition-colors`
  - 文字：`使用 Google 帳號登入 →`
  - `form action` 觸發 NextAuth `signIn("google", { redirectTo: "/" })`

### Section 3：Features（Apple-style 大區塊）

三個 feature 各自一個 full-screen section，`max-w-6xl mx-auto`。

#### 3.1 行動（置中佈局）

```
<section className="py-24 md:py-32 px-6 md:px-12 border-t border-border">
  <div class="text-center mb-16">
    <div className="eyebrow">行動</div>
    <h2>專注在<br>今天要做的事</h2>
    <p className="sub">每日任務清單，不多不少，剛好是你今天能推進的量。</p>
  </div>
  <div className="mockup">{<TasksMockup />}</div>
</section>
```

- **Eyebrow**：`text-xs font-bold tracking-[0.25em] uppercase text-primary mb-6`
- **h2**：`text-5xl md:text-7xl font-black leading-[0.95] tracking-[-0.035em] max-w-[900px] mx-auto mb-6`
- **sub**：`text-lg md:text-xl text-text-dim max-w-[600px] mx-auto leading-relaxed mb-14`
- **mockup**：置中，`max-w-[720px] mx-auto`，陰影 `shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6)]`，`rounded-2xl border border-border`

#### 3.2 日誌（alt layout 左文右圖）

```
<section className="py-24 md:py-32 px-6 md:px-12 border-t border-border">
  <div className="grid md:grid-cols-2 gap-16 items-center max-w-6xl mx-auto">
    <div>
      <div className="eyebrow">日誌</div>
      <h2>紀錄<br>每一個當下</h2>
      <p className="sub">在任務旁邊寫下感受，累積成時間軸式的個人日記。</p>
    </div>
    <div className="mockup">{<NotesMockup />}</div>
  </div>
</section>
```

- h2 降到 `text-5xl md:text-6xl`
- mockup 高度 `h-[320px] md:h-[400px]`
- Mobile 上改為垂直堆疊（`grid-cols-1`）

#### 3.3 卡片（置中佈局，同 3.1）

- **Eyebrow**：卡片
- **h2**：`回顧<br>你的 second brain`
- **sub**：有內容的任務自動變成可搜尋的卡片。未來翻找時一次攤開所有脈絡。
- mockup：同 3.1

### Section 4：哲學（宣言式引言）

置中，大 serif 引言。`py-32 md:py-40 px-6 md:px-12 border-t border-border text-center`

```
<section>
  <div className="text-[80px] leading-[0.5] text-primary font-serif mb-5">"</div>
  <blockquote className="quote">
    我想要一個不催促的工具，<br />
    它在我打開的時候才存在。
  </blockquote>
  <div className="signature">— NUDGE 的設計哲學</div>
</section>
```

- **引號符號**：`font-family: Georgia, serif; font-size: 80px;`
- **blockquote**：
  - `font-family: Georgia, "Times New Roman", serif`
  - `text-[32px] md:text-[42px] font-medium italic leading-[1.3]`
  - `max-w-[760px] mx-auto text-foreground`
- **signature**：`mt-8 text-xs tracking-[0.15em] uppercase text-text-dim`

### Section 5：底部 CTA（深色漸層）

```
<section className="relative py-32 md:py-40 px-6 md:px-12 border-t border-border"
         style={{background: "linear-gradient(180deg, #1c1b18 0%, #0d0d0b 100%)"}}>
  <div className="max-w-4xl mx-auto text-center">
    <div className="eyebrow">NUDGE</div>
    <h2>你的日子<br />值得更安靜的工具</h2>
    <form action={signInAction}>
      <button className="sepia-btn">使用 Google 帳號登入 →</button>
    </form>
  </div>
  <footer className="mt-24 pt-8 border-t border-foreground/8 flex justify-between text-xs text-text-dim max-w-4xl mx-auto">
    <span>© 2026 Nudge · 個人作品</span>
    <a href="GITHUB_URL" className="hover:text-foreground transition-colors">GitHub</a>
  </footer>
</section>
```

- **h2**：`text-5xl md:text-6xl font-black leading-[1.05] tracking-[-0.03em] mb-10`
- **sepia button**：
  - `inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity`

## CSS Mockups 細節

三個 mockup 都是純 CSS，不使用真實資料。放在 `src/components/landing/landing-mockups.tsx` 內。

### TasksMockup
模擬 daily view 的核心元素：
- 假的 DateHeading：「行動」小標題 + 「Thursday / 4/10, 2026」
- 過期區塊：1-2 個假任務，`text-primary`
- 3-4 個假的 task rows，每個有 grip + checkbox + title + file icon + calendar icon + status dot（不同顏色）
- 一個已勾選的 task（劃線、dim）

### NotesMockup
模擬 notes feed 的時間軸：
- 假的「日誌」標題
- 2-3 個 entry，每個有：左側 dot + vertical line、大數字日期、月份/星期 label
- Entry 內容：1-2 行純文字模擬

### CardsMockup
模擬 cards feed：
- 頂部：「卡片 +」標題 + 假的 view toggle + search bar
- 下方：3-4 張假的 list item（標題 + preview line + 日期 + status badge）

所有 mockup 禁止互動（`pointer-events: none`），只展示視覺。

## 資料流與認證

### `/` 路由變更

原本 `src/app/page.tsx`：
```tsx
export default async function Home() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const today = format(new Date(), "yyyy-MM-dd");
  redirect(`/day/${today}`);
}
```

改為：
```tsx
import { auth, signIn } from "@/lib/auth";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { LandingPage } from "@/components/landing/landing-page";

export default async function Home() {
  const session = await auth();
  if (session?.user) {
    const today = format(new Date(), "yyyy-MM-dd");
    redirect(`/day/${today}`);
  }

  async function handleSignIn() {
    "use server";
    await signIn("google", { redirectTo: "/" });
  }

  return <LandingPage onSignIn={handleSignIn} />;
}
```

### `LandingPage` 接收 server action

`handleSignIn` 是 server action，透過 `<form action={onSignIn}>` 傳入按鈕。兩處 CTA（Hero + Footer）都使用這個 action。

### `/login` 保留

作為後備直接入口。不在 landing nav 中連結，但可以手動輸入或從 NextAuth 錯誤頁面 fallback。

## 主題強制

landing page 必須以 **dark mode** 呈現，即使使用者 cookie 是 light。做法：
- 在 `LandingPage` 元件最外層套 `className="dark"`（包住整個 page 根 div），覆蓋 `<html>` 的主題 class
- 或在 `/page.tsx` 的 server component 中用 `document.documentElement.classList.add('dark')` — **不行**，server 端沒有 document
- 採用第一個做法：landing root 自帶 `dark` class

```tsx
<div className="dark min-h-screen bg-background text-foreground">
  ...
</div>
```

透過 Tailwind 的 `@custom-variant dark (&:is(.dark *))` 讓這個 scope 內的元素都用 dark 色。

## 紙質感排除

landing page 的 `<div className="bg-background">` 不應套用紙質感紋理。由於 `.paper-texture` class 是在 `<html>` 上，且 CSS rule 是 `html.paper-texture .bg-background`，我們需要排除 landing 的 bg-background。

做法：在 globals.css 的排除清單再加一條：
```css
html.paper-texture [data-landing] .bg-background {
  background-image: none;
  background-blend-mode: normal;
}
```

landing root 加 `data-landing` 屬性。

## 響應式

| 斷點 | 行為 |
|------|------|
| `≥1024px` (lg) | 完整尺寸：Hero h1 84px、features h2 72px |
| `768-1023px` (md) | 字級縮一級：Hero 56px、features 48px |
| `<768px` | 再縮：Hero 36px、features 32px；alternating rows 全改垂直堆疊；nav 更簡化 |

Mobile 也要能完整呈現整個流程，CTA 按鈕佔更多寬度（`w-full sm:w-auto`）。

## 不在範圍內

- Light mode 支援
- 登入以外的互動（subscribe form / pricing）
- 實際產品截圖（用 CSS mockup）
- 翻譯 / 多語言
- SEO meta / OG image（之後另做）
- 動畫（scroll-triggered 等，先靜態版）
- 影片 / GIF 展示

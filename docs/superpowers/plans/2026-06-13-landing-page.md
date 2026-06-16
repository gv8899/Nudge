# Nudge Landing Page 改版 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把首頁 landing page 改成淺色暖米的 Apple 產品頁風格，主打 Mac App、iOS 為輔，走 i18n。

**Architecture:** 單頁 `(landing)` route group（root `/`），10 個堆疊區塊。淺色暖米主題用 `[data-landing]` scope 覆寫 CSS 變數隔離。文案進 `i18n/canonical/zh-TW.json` 的 `landing.*` namespace，`(landing)/layout.tsx` 以 `NextIntlClientProvider` 強制 zh-TW locale 供給 messages，section 元件用 `useTranslations('landing')`。互動（sticky nav、scroll-reveal）為 client island。

**Tech Stack:** Next.js (App Router) + Tailwind v4 (CSS-first tokens) + next-intl + TypeScript。

**測試慣例註記：** 依 `AGENTS.md`，vitest TDD 適用「純邏輯」（recurrence / schedule-validation / i18n transpile）。本計畫為**展示型 UI**，無純邏輯單元，故驗證以 `npx next build`（語法）+ `npm run lint`（含硬編碼色 lint）+ `npm run i18n:check` + **實際互動流程**為準，不為 presentational 元件寫低價值單元測試。唯一帶測試的是 i18n key 是否齊全（靠 `i18n:check`）。

---

## File Structure

**Create:**
- `src/lib/landing-links.ts` — 下載連結 constants（placeholder）
- `src/components/landing/download-buttons.tsx` — 共用下載鈕（Mac 主 / iOS 次）
- `src/components/landing/use-scroll-reveal.ts` — IntersectionObserver 進場 hook（client）
- `src/components/landing/reveal.tsx` — 包裝 scroll-reveal 的 client wrapper
- `src/components/landing/landing-feature-tasks.tsx` — ① 每日任務段
- `src/components/landing/landing-feature-notes.tsx` — ② 日誌段
- `src/components/landing/landing-feature-cards.tsx` — ③ 卡片段
- `src/components/landing/landing-platforms.tsx` — 跨平台（Mac 主）
- `src/components/landing/landing-highlights.tsx` — Bento 小功能格

**Modify:**
- `i18n/canonical/zh-TW.json` — 加 `landing.*` namespace
- `src/app/(landing)/layout.tsx` — 加 NextIntlClientProvider（強制 zh-TW）
- `src/app/(landing)/page.tsx` — 移除 signIn 相關，純 render LandingPage
- `src/app/globals.css` — `[data-landing]` 暖色淺色 token override + Apple 字體 + scroll-reveal 基礎樣式
- `src/components/landing/landing-page.tsx` — 移除 `dark` / `signInAction`，編排新區塊
- `src/components/landing/landing-nav.tsx` — frosted sticky + 錨點 + 下載鈕（client）
- `src/components/landing/landing-hero.tsx` — Mac 主視覺 + 雙下載鈕
- `src/components/landing/landing-philosophy.tsx` — 暖深色金句、移除墨點
- `src/components/landing/landing-footer-cta.tsx` — 改用 download-buttons、移除 SignInForm
- `src/components/landing/mockup-tasks.tsx` / `mockup-notes.tsx` / `mockup-cards.tsx` / `mockup-card-detail.tsx` / `mini-mockups.tsx` — 重新上淺色暖米妝

**Delete（確認無其他引用後）:**
- `src/components/landing/landing-doodles.tsx`
- `src/components/landing/sign-in-form.tsx`
- `src/components/landing/landing-features.tsx`（拆成三個 feature 檔後移除）

---

## Task 1: 淺色暖米主題 token + Apple 字體（globals.css）

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: 在 globals.css 末端加入 `[data-landing]` scope override**

在檔案最後加入（值取自品牌暖色 + Apple 中性層次）：

```css
/* ===== Landing page：強制淺色暖米，與 app 主題隔離 ===== */
[data-landing] {
  --background: #efe9d4;
  --foreground: #1c1b18;
  --primary: #a87a45;
  --primary-foreground: #efe9d4;
  --muted: #6b6354;            /* 次要暖灰文字 */
  --border: #e4dcc4;
  --surface: #fffdf6;          /* 卡片/裝置面 */
  --surface-alt: #f6f1e0;      /* 區塊交替底 */
  --ink: #1c1b18;              /* 暗區塊底（哲學金句） */
  --ink-foreground: #f3ecd8;

  /* Apple 字體邏輯 */
  --font-landing: -apple-system, BlinkMacSystemFont, "PingFang TC",
    "Helvetica Neue", "Noto Sans TC", sans-serif;
  color: var(--foreground);
  background: var(--background);
  font-family: var(--font-landing);
}

/* scroll-reveal 進場：預設隱藏、in-view 顯示 */
[data-landing] .reveal {
  opacity: 0;
  transform: translateY(24px);
  transition: opacity .7s cubic-bezier(.16,1,.3,1),
    transform .7s cubic-bezier(.16,1,.3,1);
  will-change: opacity, transform;
}
[data-landing] .reveal.is-visible {
  opacity: 1;
  transform: none;
}
@media (prefers-reduced-motion: reduce) {
  [data-landing] .reveal { opacity: 1; transform: none; transition: none; }
}
```

- [ ] **Step 2: 驗證 build**

Run: `npx next build`
Expected: 通過（CSS 變數新增不影響編譯）。

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(landing): 淺色暖米主題 token + Apple 字體 + scroll-reveal 基礎樣式"
```

---

## Task 2: 下載連結 constants + download-buttons 元件

**Files:**
- Create: `src/lib/landing-links.ts`
- Create: `src/components/landing/download-buttons.tsx`

- [ ] **Step 1: 建 constants**

`src/lib/landing-links.ts`：

```ts
// 下載連結尚未確定，先放 placeholder。拿到正式連結只改這裡。
export const DOWNLOAD_LINKS = {
  mac: "#", // TODO: Mac DMG 託管 URL
  ios: "#", // TODO: App Store URL
} as const;
```

- [ ] **Step 2: 建 download-buttons 元件**

`src/components/landing/download-buttons.tsx`（client，文案走 i18n；Mac 主、iOS 次）：

```tsx
"use client";

import { useTranslations } from "next-intl";
import { DOWNLOAD_LINKS } from "@/lib/landing-links";

interface DownloadButtonsProps {
  /** 主按鈕尺寸：hero 用 lg，nav 用 sm */
  size?: "sm" | "lg";
  className?: string;
}

export function DownloadButtons({ size = "lg", className = "" }: DownloadButtonsProps) {
  const t = useTranslations("landing");
  const pad = size === "lg" ? "px-7 py-3.5 text-base" : "px-4 py-2 text-sm";
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      <a
        href={DOWNLOAD_LINKS.mac}
        className={`inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground font-medium ${pad} transition-transform hover:scale-[1.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary`}
      >
        {t("download.mac")}
      </a>
      <a
        href={DOWNLOAD_LINKS.ios}
        className={`inline-flex items-center justify-center rounded-full font-medium text-primary ring-1 ring-primary/30 ${pad} transition-colors hover:bg-primary/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary`}
      >
        {t("download.ios")}
      </a>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/landing-links.ts src/components/landing/download-buttons.tsx
git commit -m "feat(landing): 下載連結 constants + download-buttons 元件（Mac 主 iOS 次）"
```

> 註：此步先不 build（依賴 i18n key，於 Task 12 補齊後整體驗證）。

---

## Task 3: scroll-reveal hook + wrapper

**Files:**
- Create: `src/components/landing/use-scroll-reveal.ts`
- Create: `src/components/landing/reveal.tsx`

- [ ] **Step 1: hook**

`src/components/landing/use-scroll-reveal.ts`：

```ts
"use client";

import { useEffect, useRef } from "react";

/** 進場一次性淡入上移；尊重 prefers-reduced-motion。 */
export function useScrollReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.classList.add("is-visible");
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}
```

- [ ] **Step 2: wrapper 元件**

`src/components/landing/reveal.tsx`：

```tsx
"use client";

import { useScrollReveal } from "./use-scroll-reveal";

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  /** 階梯延遲（秒），同段多元素錯落進場用 */
  delay?: number;
}

export function Reveal({ children, className = "", delay = 0 }: RevealProps) {
  const ref = useScrollReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`reveal ${className}`}
      style={delay ? { transitionDelay: `${delay}s` } : undefined}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/landing/use-scroll-reveal.ts src/components/landing/reveal.tsx
git commit -m "feat(landing): scroll-reveal hook + Reveal wrapper（尊重 reduced-motion）"
```

---

## Task 4: 重新上淺色暖米妝 — mockup 元件

**Files:**
- Modify: `src/components/landing/mockup-tasks.tsx`
- Modify: `src/components/landing/mockup-notes.tsx`
- Modify: `src/components/landing/mockup-cards.tsx`
- Modify: `src/components/landing/mockup-card-detail.tsx`
- Modify: `src/components/landing/mini-mockups.tsx`

- [ ] **Step 1: 先讀每個 mockup 檔，盤點寫死的深色 class**

Run: `git grep -nE "bg-(black|zinc|neutral|gray)|text-white|/\\[#" src/components/landing/mockup-*.tsx src/components/landing/mini-mockups.tsx`
盤點所有深色／硬編色，準備改成 token。

- [ ] **Step 2: 將深色面改為淺色暖米 token**

逐檔把容器底色改用 `bg-[var(--surface)]`、邊框 `border-[var(--border)]`、主文字 `text-foreground`、次文字 `text-[var(--muted)]`、強調用 `text-primary`/`bg-primary`。狀態色維持語意（沿用 `TASK_STATUSES` 的色，不在 landing 硬編）。**不可硬編 hex / 隨意 Tailwind 預設色**。裝置外框用 `bg-[var(--surface)]` + 細邊 + 柔和陰影 `shadow-[0_18px_50px_rgba(28,27,24,0.12)]`。

- [ ] **Step 3: 驗證 lint（硬編色檢查）**

Run: `npm run lint`
Expected: 無硬編色違規、無 unused。

- [ ] **Step 4: Commit**

```bash
git add src/components/landing/mockup-*.tsx src/components/landing/mini-mockups.tsx
git commit -m "feat(landing): mockup 元件改淺色暖米妝"
```

---

## Task 5: Nav（frosted sticky + 錨點 + 下載鈕）

**Files:**
- Modify: `src/components/landing/landing-nav.tsx`

- [ ] **Step 1: 重寫 nav 為 client、frosted、捲動加底**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { DownloadButtons } from "./download-buttons";

export function LandingNav() {
  const t = useTranslations("landing");
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <nav
      aria-label={t("nav.aria")}
      className={`fixed top-0 inset-x-0 z-50 h-14 transition-colors ${
        scrolled
          ? "bg-[var(--background)]/80 backdrop-blur-xl border-b border-[var(--border)]"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto max-w-6xl h-full px-6 md:px-8 flex items-center justify-between">
        <a href="#top" className="text-lg font-semibold text-foreground tracking-tight">
          Nudge
        </a>
        <div className="hidden md:flex items-center gap-7 text-sm text-[var(--muted)]">
          <a href="#features" className="hover:text-foreground transition-colors">{t("nav.features")}</a>
          <a href="#philosophy" className="hover:text-foreground transition-colors">{t("nav.philosophy")}</a>
        </div>
        <DownloadButtons size="sm" />
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/landing/landing-nav.tsx
git commit -m "feat(landing): frosted sticky nav + 錨點 + 下載鈕"
```

---

## Task 6: Hero（Mac 主視覺 + 雙下載鈕）

**Files:**
- Modify: `src/components/landing/landing-hero.tsx`

- [ ] **Step 1: 重寫 hero — 移除 SignInForm/doodles，Mac 視窗主視覺**

```tsx
import { DownloadButtons } from "./download-buttons";
import { Reveal } from "./reveal";
import { MockupTasks } from "./mockup-tasks";
import { getTranslations } from "next-intl/server";

export async function LandingHero() {
  const t = await getTranslations("landing");
  return (
    <section id="top" className="mx-auto max-w-5xl px-6 md:px-8 pt-32 pb-24 text-center">
      <Reveal>
        <p className="text-sm font-semibold text-primary mb-4">Nudge</p>
        <h1 className="text-5xl md:text-7xl font-semibold leading-[1.05] tracking-[-0.02em] text-foreground mb-6 whitespace-pre-line">
          {t("hero.title")}
        </h1>
        <p className="text-lg md:text-xl text-[var(--muted)] max-w-[560px] mx-auto leading-relaxed mb-9">
          {t("hero.subtitle")}
        </p>
        <DownloadButtons className="justify-center" />
        <p className="mt-4 text-xs text-[var(--muted)]">{t("hero.platformNote")}</p>
      </Reveal>
      <Reveal delay={0.1} className="mt-16">
        {/* Mac 視窗外框包住既有任務 mockup（圖片槽：之後可換真實 Mac 截圖） */}
        <div className="mx-auto max-w-[860px] rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-[0_30px_80px_rgba(28,27,24,0.18)] overflow-hidden">
          <div className="flex items-center gap-2 px-4 h-9 border-b border-[var(--border)]">
            <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
            <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
            <span className="w-3 h-3 rounded-full bg-[#28c840]" />
          </div>
          <div className="p-6 md:p-8">
            <MockupTasks />
          </div>
        </div>
      </Reveal>
    </section>
  );
}
```

> 紅綠燈 hex 為 macOS 標準視窗鈕、屬擬真裝置 chrome，加 `// nudge:allow-color` 註記豁免（若 web lint 有同規則）；web lint 僅擋 Swift 色，這裡 Tailwind 任意值不違規，無需豁免，但若 lint 報警則改用 inline style。

- [ ] **Step 2: Commit**

```bash
git add src/components/landing/landing-hero.tsx
git commit -m "feat(landing): Hero 改 Mac 視窗主視覺 + 雙下載鈕（Mac 主）"
```

---

## Task 7: 哲學金句段（暖深色）

**Files:**
- Modify: `src/components/landing/landing-philosophy.tsx`

- [ ] **Step 1: 重寫 — 暖深色全幅、移除 InkSparkle 墨點**

```tsx
import { Reveal } from "./reveal";
import { getTranslations } from "next-intl/server";

export async function LandingPhilosophy() {
  const t = await getTranslations("landing");
  return (
    <section
      id="philosophy"
      className="px-6 md:px-12 py-32 md:py-44 text-center bg-[var(--ink)]"
    >
      <Reveal>
        <blockquote className="text-3xl md:text-5xl font-semibold leading-[1.25] tracking-[-0.01em] max-w-[760px] mx-auto text-[var(--ink-foreground)] whitespace-pre-line">
          {t("philosophy.quote")}
        </blockquote>
        <div className="mt-8 text-sm text-[var(--ink-foreground)]/55">
          {t("philosophy.attribution")}
        </div>
      </Reveal>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/landing/landing-philosophy.tsx
git commit -m "feat(landing): 哲學金句改暖深色全幅、移除手繪墨點"
```

---

## Task 8: 三個功能段（任務 / 日誌 / 卡片）

**Files:**
- Create: `src/components/landing/landing-feature-tasks.tsx`
- Create: `src/components/landing/landing-feature-notes.tsx`
- Create: `src/components/landing/landing-feature-cards.tsx`

- [ ] **Step 1: 任務段**（置中大 mockup + 三點，沿用 mini-mockups）

`landing-feature-tasks.tsx`：

```tsx
import { getTranslations } from "next-intl/server";
import { Reveal } from "./reveal";
import { MockupTasks } from "./mockup-tasks";
import { MiniContinue, MiniReschedule, MiniStatuses } from "./mini-mockups";

export async function LandingFeatureTasks() {
  const t = await getTranslations("landing.tasks");
  const points = [
    { key: "continue", node: <MiniContinue /> },
    { key: "reschedule", node: <MiniReschedule /> },
    { key: "status", node: <MiniStatuses /> },
  ] as const;
  return (
    <section className="px-6 md:px-12 py-28 md:py-36 border-t border-[var(--border)]">
      <div className="max-w-5xl mx-auto">
        <Reveal className="text-center mb-16">
          <p className="text-sm font-semibold text-primary mb-4">{t("eyebrow")}</p>
          <h2 className="text-4xl md:text-6xl font-semibold leading-[1.08] tracking-[-0.02em] text-foreground mb-5 whitespace-pre-line">
            {t("title")}
          </h2>
          <p className="text-lg md:text-xl text-[var(--muted)] max-w-[600px] mx-auto leading-relaxed">
            {t("subtitle")}
          </p>
        </Reveal>
        <Reveal className="max-w-[720px] mx-auto mb-20">
          <MockupTasks />
        </Reveal>
        <div className="grid md:grid-cols-3 gap-10 md:gap-8 max-w-[1000px] mx-auto">
          {points.map((p, i) => (
            <Reveal key={p.key} delay={i * 0.08}>
              <div className="mb-5">{p.node}</div>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                {t(`points.${p.key}.title`)}
              </h3>
              <p className="text-[var(--muted)] leading-relaxed">
                {t(`points.${p.key}.desc`)}
              </p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: 日誌段**（左文右圖）

`landing-feature-notes.tsx`：

```tsx
import { getTranslations } from "next-intl/server";
import { Reveal } from "./reveal";
import { MockupNotes } from "./mockup-notes";

export async function LandingFeatureNotes() {
  const t = await getTranslations("landing.notes");
  return (
    <section className="px-6 md:px-12 py-28 md:py-36 border-t border-[var(--border)]">
      <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-14 items-center">
        <Reveal>
          <p className="text-sm font-semibold text-primary mb-4">{t("eyebrow")}</p>
          <h2 className="text-4xl md:text-5xl font-semibold leading-[1.08] tracking-[-0.02em] text-foreground mb-5 whitespace-pre-line">
            {t("title")}
          </h2>
          <p className="text-lg text-[var(--muted)] leading-relaxed">{t("subtitle")}</p>
        </Reveal>
        <Reveal delay={0.1}>
          <MockupNotes />
        </Reveal>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: 卡片段**（置中大 mockup + 詳情）

`landing-feature-cards.tsx`：

```tsx
import { getTranslations } from "next-intl/server";
import { Reveal } from "./reveal";
import { MockupCards } from "./mockup-cards";
import { MockupCardDetail } from "./mockup-card-detail";

export async function LandingFeatureCards() {
  const t = await getTranslations("landing.cards");
  return (
    <section className="px-6 md:px-12 py-28 md:py-36 border-t border-[var(--border)]">
      <div className="max-w-5xl mx-auto">
        <Reveal className="text-center mb-16">
          <p className="text-sm font-semibold text-primary mb-4">{t("eyebrow")}</p>
          <h2 className="text-4xl md:text-6xl font-semibold leading-[1.08] tracking-[-0.02em] text-foreground mb-5 whitespace-pre-line">
            {t("title")}
          </h2>
          <p className="text-lg md:text-xl text-[var(--muted)] max-w-[640px] mx-auto leading-relaxed whitespace-pre-line">
            {t("subtitle")}
          </p>
        </Reveal>
        <Reveal className="max-w-[720px] mx-auto mb-10">
          <MockupCards />
        </Reveal>
        <Reveal delay={0.1} className="max-w-[720px] mx-auto">
          <MockupCardDetail />
        </Reveal>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/landing/landing-feature-*.tsx
git commit -m "feat(landing): 拆出任務/日誌/卡片三個功能段（i18n + scroll-reveal）"
```

---

## Task 9: 跨平台段（Mac 主）

**Files:**
- Create: `src/components/landing/landing-platforms.tsx`

- [ ] **Step 1: 建段 — Mac 主角、iPhone 延伸**

```tsx
import { getTranslations } from "next-intl/server";
import { Reveal } from "./reveal";

export async function LandingPlatforms() {
  const t = await getTranslations("landing.platforms");
  return (
    <section className="px-6 md:px-12 py-28 md:py-36 border-t border-[var(--border)] bg-[var(--surface-alt)]">
      <div className="max-w-5xl mx-auto text-center">
        <Reveal>
          <p className="text-sm font-semibold text-primary mb-4">{t("eyebrow")}</p>
          <h2 className="text-4xl md:text-6xl font-semibold leading-[1.08] tracking-[-0.02em] text-foreground mb-5 whitespace-pre-line">
            {t("title")}
          </h2>
          <p className="text-lg md:text-xl text-[var(--muted)] max-w-[600px] mx-auto leading-relaxed">
            {t("subtitle")}
          </p>
        </Reveal>
        <Reveal delay={0.1} className="mt-16 flex items-end justify-center gap-6">
          {/* 圖片槽：之後可換真實 Mac + iPhone 截圖 */}
          <div className="w-full max-w-[560px] aspect-[16/10] rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-[0_24px_60px_rgba(28,27,24,0.16)] flex items-center justify-center text-[var(--muted)] text-sm">
            Mac
          </div>
          <div className="w-[120px] md:w-[150px] aspect-[9/19] rounded-[1.6rem] bg-[var(--surface)] border border-[var(--border)] shadow-[0_24px_60px_rgba(28,27,24,0.16)] flex items-center justify-center text-[var(--muted)] text-sm">
            iPhone
          </div>
        </Reveal>
      </div>
    </section>
  );
}
```

> 圖片槽以純色面 + 標籤呈現，待真實截圖換入。文案強調「在桌機規劃，手機隨身查看」。

- [ ] **Step 2: Commit**

```bash
git add src/components/landing/landing-platforms.tsx
git commit -m "feat(landing): 跨平台段（Mac 主角、iPhone 延伸，圖片槽待補截圖）"
```

---

## Task 10: Bento 小功能格

**Files:**
- Create: `src/components/landing/landing-highlights.tsx`

- [ ] **Step 1: 建 bento 格（重複任務 / 標籤 / 日曆 / 搜尋）**

```tsx
import { getTranslations } from "next-intl/server";
import { Reveal } from "./reveal";

const ITEMS = ["recurrence", "tags", "calendar", "search"] as const;

export async function LandingHighlights() {
  const t = await getTranslations("landing.highlights");
  return (
    <section id="features" className="px-6 md:px-12 py-28 md:py-36 border-t border-[var(--border)]">
      <div className="max-w-5xl mx-auto">
        <Reveal className="text-center mb-14">
          <h2 className="text-4xl md:text-5xl font-semibold tracking-[-0.02em] text-foreground">
            {t("title")}
          </h2>
        </Reveal>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {ITEMS.map((key, i) => (
            <Reveal key={key} delay={i * 0.06}>
              <div className="h-full rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-6">
                <h3 className="text-lg font-semibold text-foreground mb-2">{t(`items.${key}.title`)}</h3>
                <p className="text-sm text-[var(--muted)] leading-relaxed">{t(`items.${key}.desc`)}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/landing/landing-highlights.tsx
git commit -m "feat(landing): Bento 小功能格（重複任務/標籤/日曆/搜尋）"
```

---

## Task 11: 結尾 CTA + Footer

**Files:**
- Modify: `src/components/landing/landing-footer-cta.tsx`

- [ ] **Step 1: 重寫 — download-buttons、移除 SignInForm、淺色**

```tsx
import { getTranslations } from "next-intl/server";
import { Reveal } from "./reveal";
import { DownloadButtons } from "./download-buttons";

export async function LandingFooterCta() {
  const t = await getTranslations("landing");
  return (
    <section className="px-6 md:px-12 py-32 md:py-44 border-t border-[var(--border)] bg-[var(--surface-alt)]">
      <Reveal className="max-w-3xl mx-auto text-center">
        <p className="text-sm font-semibold text-primary mb-4">Nudge</p>
        <h2 className="text-4xl md:text-6xl font-semibold leading-[1.1] tracking-[-0.02em] text-foreground mb-9 whitespace-pre-line">
          {t("finalCta.title")}
        </h2>
        <DownloadButtons className="justify-center" />
        <p className="mt-4 text-xs text-[var(--muted)]">{t("hero.platformNote")}</p>
      </Reveal>
      <footer className="max-w-3xl mx-auto mt-24 pt-8 border-t border-[var(--border)] text-xs text-[var(--muted)] text-center flex items-center justify-center gap-4">
        <span>© 2026 Nudge</span>
        <span aria-hidden="true">·</span>
        <a href="/privacy" className="hover:text-foreground transition-colors">{t("footer.privacy")}</a>
        <span aria-hidden="true">·</span>
        <a href="/terms" className="hover:text-foreground transition-colors">{t("footer.terms")}</a>
      </footer>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/landing/landing-footer-cta.tsx
git commit -m "feat(landing): 結尾 CTA 改 download-buttons + 淺色 footer"
```

---

## Task 12: i18n — canonical `landing.*` + sync

**Files:**
- Modify: `i18n/canonical/zh-TW.json`

- [ ] **Step 1: 在 canonical 加 `landing` namespace**

在 `i18n/canonical/zh-TW.json` top-level 加入（與既有 key 同層、巢狀）：

```json
"landing": {
  "nav": { "aria": "主導覽", "features": "功能", "philosophy": "理念" },
  "download": { "mac": "下載 Mac 版", "ios": "iPhone 版 · App Store" },
  "hero": {
    "title": "每天，\n輕鬆推進一點",
    "subtitle": "讓任務和日常，在不打擾的節奏裡前進。",
    "platformNote": "為 Mac 打造，iPhone 隨身同步。"
  },
  "philosophy": {
    "quote": "工具該等你，\n不是追你。",
    "attribution": "— Nudge 的設計理念"
  },
  "tasks": {
    "eyebrow": "行動",
    "title": "專注在\n今天要做的事",
    "subtitle": "每日任務清單。不多、不雜，就是今天能推進的事。",
    "points": {
      "continue": { "title": "自動延續", "desc": "沒做完的任務不會消失。隔天打開時，會出現在頁首讓你繼續處理。" },
      "reschedule": { "title": "重新排程", "desc": "一鍵排入今天，或從日曆挑一個更合適的日子。不需要的就封存。" },
      "status": { "title": "任務狀態", "desc": "暫記、待排入、處理中、等待他人、完成。用顏色分類，一眼看出每個任務在哪一步。" }
    }
  },
  "notes": {
    "eyebrow": "日誌",
    "title": "紀錄\n每一個當下",
    "subtitle": "在任務旁邊隨手寫幾句。日復一日，就成了你自己的日記。"
  },
  "cards": {
    "eyebrow": "卡片",
    "title": "留下\n工作與生活的痕跡",
    "subtitle": "會議決策、讀書心得、旅行計畫、運動紀錄 —\n有內容的任務都會被留下來，要找的時候，它就在那裡。"
  },
  "platforms": {
    "eyebrow": "跨平台",
    "title": "在桌機規劃，\n手機隨身查看",
    "subtitle": "Mac、iPhone、iPad 即時同步。在哪台裝置都接得上同一個節奏。"
  },
  "highlights": {
    "title": "還有更多",
    "items": {
      "recurrence": { "title": "重複任務", "desc": "每天、每週、每月的例行事，設定一次自動出現。" },
      "tags": { "title": "標籤", "desc": "用標籤把相關任務歸類，快速聚焦。" },
      "calendar": { "title": "日曆檢視", "desc": "用日／週／月檢視，掌握整體節奏。" },
      "search": { "title": "搜尋", "desc": "任務與卡片全文搜尋，想找的隨手就到。" }
    }
  },
  "finalCta": { "title": "從今天\n開始輕鬆推進" },
  "footer": { "privacy": "隱私權政策", "terms": "服務條款" }
}
```

- [ ] **Step 2: 跑 sync**

Run: `npm run i18n:sync`
Expected: 生成 `src/messages/zh-TW.json` 含 landing key；en/ja 缺漏列進 `i18n/.pending-translations.md`。

- [ ] **Step 3: 驗證 i18n check**

Run: `npm run i18n:check`
Expected: 通過（或僅回報 en/ja pending，依專案 check 嚴格度；若 check 因缺翻譯 fail，於 Step 4 處理）。

- [ ] **Step 4: 若 en/ja 缺翻譯導致 check fail**

把 `i18n/.pending-translations.md` 內容回報給使用者請求翻譯；在取得前，landing 僅 render zh-TW（root layout `lang="zh-TW"`、layout 強制 zh-TW locale），不阻塞 zh-TW 上線。記錄於最終回報。

- [ ] **Step 5: Commit**

```bash
git add i18n/canonical/zh-TW.json src/messages/ mobile/lib/l10n/ i18n/.pending-translations.md
git commit -m "feat(landing): i18n landing.* namespace + sync"
```

---

## Task 13: 串接 — layout / page / landing-page，移除舊檔

**Files:**
- Modify: `src/app/(landing)/layout.tsx`
- Modify: `src/app/(landing)/page.tsx`
- Modify: `src/components/landing/landing-page.tsx`
- Delete: `src/components/landing/landing-doodles.tsx`, `sign-in-form.tsx`, `landing-features.tsx`

- [ ] **Step 1: layout 提供 zh-TW messages**

`src/app/(landing)/layout.tsx`：

```tsx
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";

export default async function LandingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  setRequestLocale("zh-TW");
  const messages = await getMessages({ locale: "zh-TW" });
  return (
    <NextIntlClientProvider locale="zh-TW" messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
```

> 若 `src/i18n/request.ts` 的 `getMessages` 不吃 `{locale}` 參數，改在此 layout 直接 import zh-TW messages JSON 傳入 provider。Step 5 build 會驗證。

- [ ] **Step 2: page 移除 signIn**

`src/app/(landing)/page.tsx`：

```tsx
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getToday } from "@/lib/today";
import { LandingPage } from "@/components/landing/landing-page";

export default async function Home() {
  const session = await auth();
  if (session?.user) {
    const today = await getToday();
    redirect(`/zh-TW/day/${today}`);
  }
  return <LandingPage />;
}
```

- [ ] **Step 3: landing-page 編排新區塊、移除 dark/signInAction**

`src/components/landing/landing-page.tsx`：

```tsx
import { LandingNav } from "./landing-nav";
import { LandingHero } from "./landing-hero";
import { LandingPhilosophy } from "./landing-philosophy";
import { LandingFeatureTasks } from "./landing-feature-tasks";
import { LandingFeatureNotes } from "./landing-feature-notes";
import { LandingFeatureCards } from "./landing-feature-cards";
import { LandingPlatforms } from "./landing-platforms";
import { LandingHighlights } from "./landing-highlights";
import { LandingFooterCta } from "./landing-footer-cta";

export function LandingPage() {
  return (
    <div data-landing className="min-h-screen bg-background text-foreground">
      <LandingNav />
      <LandingHero />
      <LandingPhilosophy />
      <LandingFeatureTasks />
      <LandingFeatureNotes />
      <LandingFeatureCards />
      <LandingPlatforms />
      <LandingHighlights />
      <LandingFooterCta />
    </div>
  );
}
```

- [ ] **Step 4: 確認無引用後刪舊檔**

Run: `git grep -nE "landing-doodles|sign-in-form|landing-features|signInAction|SignInForm|HandDrawn|InkSparkle" src`
Expected: 僅剩待刪檔自身。確認後：

```bash
git rm src/components/landing/landing-doodles.tsx src/components/landing/sign-in-form.tsx src/components/landing/landing-features.tsx
```

- [ ] **Step 5: 驗證 build**

Run: `npx next build`
Expected: 通過。若 `getMessages({locale})` 不支援，依 Step 1 註記改 import JSON 後再 build。

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(landing): 串接新區塊、(landing) 強制 zh-TW i18n、移除舊塗鴉/sign-in/features"
```

---

## Task 14: 全面驗證 + 完成定義

**Files:** 無（驗證）

- [ ] **Step 1: build / lint / i18n**

```bash
npx next build && npm run lint && npm run i18n:check
```
Expected: 三者皆過（i18n:check 若僅 en/ja pending 依 Task 12 Step 4 處置）。

- [ ] **Step 2: 啟 dev server 走互動流程**

Run: `npm run dev`，於瀏覽器 `http://localhost:3000/` 逐項確認：
- sticky nav 捲動加底/模糊、錨點（功能/理念）跳轉到對應段
- scroll-reveal：各段進場淡入上移；開系統「減少動態」後內容直接顯示、無動畫
- 下載按鈕 hover / focus-visible / 點擊（placeholder `#` 不導頁、不報錯）
- 響應式：桌機 / 平板 / 手機寬（區塊堆疊正確、觸控目標足夠、nav 在窄寬正常）
- footer Privacy / Terms 連到 `/privacy`、`/terms`
- 已登入者 reload `/` 會 redirect 到 `/zh-TW/day/...`（維持既有行為）

- [ ] **Step 3: 若無法本機親測**

依專案 Definition of Done：明確告知使用者「僅驗證 build/lint/i18n 語法層，互動未親跑」，並列出 Step 2 清單請使用者代測。

- [ ] **Step 4: 最終 commit（如有殘留調整）**

```bash
git add -A && git commit -m "chore(landing): 驗證後微調"
```

---

## Self-Review（撰寫者自查結果）

- **Spec coverage**：淺色暖米 token(Task1)、Apple 字體(Task1)、移除塗鴉(Task13)、scroll-reveal(Task1/3)、10 區塊(Task5–11/13)、Mac 主 CTA(Task2/6)、download placeholder(Task2)、hybrid 圖片槽(Task6/9)、i18n landing.*(Task12)、`[data-landing]` 隔離(Task1/13)、reduced-motion(Task1/3)、完成定義(Task14) — 皆有對應任務。
- **Placeholder scan**：下載連結 placeholder 為刻意設計（Task2）；圖片槽為刻意內容依賴（Task6/9）；其餘步驟均含完整程式碼／指令，無 TBD。
- **Type consistency**：`DownloadButtons({size,className})`、`Reveal({children,className,delay})`、`useScrollReveal<T>()`、`DOWNLOAD_LINKS.{mac,ios}` 跨任務一致；i18n key 與元件 `t(...)` 呼叫對齊（Task12 涵蓋所有用到的 key）。
- **已知風險**：`getMessages({locale})` 是否支援指定 locale 取決於 `src/i18n/request.ts`；Task13 Step1 已給 fallback（直接 import zh-TW JSON）。

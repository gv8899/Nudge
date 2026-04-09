# HERO Landing Page 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 未登入訪客進入 `/` 時看到完整行銷 landing page（Hero / Features / 哲學 / CTA），介紹 nudge 的核心功能與哲學

**Architecture:** 修改 `src/app/page.tsx` 做 auth 分流（未登入渲染 LandingPage、已登入 redirect 到 `/day/{today}`）。LandingPage 拆成多個 client / server 元件，全部放在 `src/components/landing/` 下。三個功能 mockup 用純 CSS 重現，不用真實截圖。強制 dark mode + 排除紙質紋理。

**Tech Stack:** Next.js 16, Tailwind v4, NextAuth v5, lucide-react, date-fns

---

## 檔案結構

| 操作 | 檔案 | 職責 |
|------|------|------|
| 修改 | `src/app/page.tsx` | auth 分流：已登入 redirect、未登入渲染 Landing |
| 新增 | `src/components/landing/landing-page.tsx` | 組合所有區塊 + dark scope + data-landing 屬性 |
| 新增 | `src/components/landing/landing-nav.tsx` | 頂部極簡 nav bar |
| 新增 | `src/components/landing/landing-hero.tsx` | Hero 區塊 |
| 新增 | `src/components/landing/landing-features.tsx` | 三大 Features sections |
| 新增 | `src/components/landing/mockup-tasks.tsx` | 純 CSS 重現的 Tasks 頁 mockup |
| 新增 | `src/components/landing/mockup-notes.tsx` | 純 CSS 重現的 Notes 頁 mockup |
| 新增 | `src/components/landing/mockup-cards.tsx` | 純 CSS 重現的 Cards 頁 mockup |
| 新增 | `src/components/landing/landing-philosophy.tsx` | 宣言引言區塊 |
| 新增 | `src/components/landing/landing-footer-cta.tsx` | 深色漸層底部 CTA + footer |
| 新增 | `src/components/landing/sign-in-form.tsx` | 共用的 Google 登入表單（吃 server action） |
| 修改 | `src/app/globals.css` | 在紙質感排除清單加 `[data-landing]` |

---

### Task 1: 紙質感排除 + 路由分流骨架

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/page.tsx`
- Create: `src/components/landing/landing-page.tsx`

- [ ] **Step 1: 更新 globals.css 紙質感排除清單**

找到：
```css
    html.paper-texture [data-slot="popover-content"] .bg-background,
    html.paper-texture .group\/calendar,
    html.paper-texture input.bg-background,
    html.paper-texture textarea.bg-background,
    html.paper-texture .tiptap-container .bg-background {
      background-image: none;
      background-blend-mode: normal;
    }
```

改為：
```css
    html.paper-texture [data-slot="popover-content"] .bg-background,
    html.paper-texture .group\/calendar,
    html.paper-texture input.bg-background,
    html.paper-texture textarea.bg-background,
    html.paper-texture .tiptap-container .bg-background,
    html.paper-texture [data-landing] .bg-background,
    html.paper-texture [data-landing].bg-background {
      background-image: none;
      background-blend-mode: normal;
    }
```

- [ ] **Step 2: 建立 landing-page.tsx 暫時骨架**

```tsx
"use client";

interface LandingPageProps {
  signInAction: () => Promise<void>;
}

export function LandingPage({ signInAction }: LandingPageProps) {
  return (
    <div
      data-landing
      className="dark min-h-screen bg-background text-foreground"
    >
      <div className="p-8">Landing Page — 骨架建置中</div>
    </div>
  );
}
```

- [ ] **Step 3: 改 app/page.tsx 做 auth 分流**

整份替換為：
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

  return <LandingPage signInAction={handleSignIn} />;
}
```

- [ ] **Step 4: Build 驗證**

```bash
npx next build 2>&1 | tail -5
```
預期：build 成功。

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css src/app/page.tsx src/components/landing/landing-page.tsx
git commit -m "feat: landing page 骨架 + auth 分流 + 紙質感排除"
```

---

### Task 2: 共用 Sign-In 表單元件

**Files:**
- Create: `src/components/landing/sign-in-form.tsx`

- [ ] **Step 1: 建立 sign-in-form.tsx**

```tsx
import { ArrowRight } from "lucide-react";

interface SignInFormProps {
  action: () => Promise<void>;
  /** outline | solid */
  variant?: "outline" | "solid";
  className?: string;
}

export function SignInForm({
  action,
  variant = "outline",
  className = "",
}: SignInFormProps) {
  const base =
    "inline-flex items-center gap-2 text-sm font-semibold transition-colors rounded-xl";
  const sizing = variant === "solid" ? "px-8 py-4" : "px-7 py-3.5";
  const colors =
    variant === "solid"
      ? "bg-primary text-primary-foreground hover:opacity-90"
      : "border border-foreground text-foreground hover:bg-foreground/5";

  return (
    <form action={action}>
      <button
        type="submit"
        className={`${base} ${sizing} ${colors} ${className}`}
      >
        使用 Google 帳號登入
        <ArrowRight className="h-4 w-4" />
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/landing/sign-in-form.tsx
git commit -m "feat: landing 共用 sign-in 表單元件"
```

---

### Task 3: Landing Nav Bar

**Files:**
- Create: `src/components/landing/landing-nav.tsx`

- [ ] **Step 1: 建立 landing-nav.tsx**

```tsx
import { Github } from "lucide-react";

export function LandingNav() {
  return (
    <nav
      aria-label="主導覽"
      className="fixed top-0 left-0 right-0 z-50 h-14"
    >
      <div className="mx-auto max-w-6xl h-full px-6 md:px-8 flex items-center justify-between">
        <span className="text-lg font-semibold text-foreground">nudge</span>
        <a
          href="https://github.com/gv8899/Nudge"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub"
          className="text-text-dim hover:text-foreground transition-colors p-2 -mr-2"
        >
          <Github className="h-5 w-5" />
        </a>
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/landing/landing-nav.tsx
git commit -m "feat: landing nav bar"
```

---

### Task 4: Landing Hero 區塊

**Files:**
- Create: `src/components/landing/landing-hero.tsx`

- [ ] **Step 1: 建立 landing-hero.tsx**

```tsx
import { SignInForm } from "./sign-in-form";

interface LandingHeroProps {
  signInAction: () => Promise<void>;
}

export function LandingHero({ signInAction }: LandingHeroProps) {
  return (
    <section className="mx-auto max-w-6xl px-6 md:px-12 pt-40 pb-32">
      <div className="text-xs font-bold tracking-[0.25em] uppercase text-primary mb-7">
        NUDGE
      </div>
      <h1 className="text-5xl md:text-7xl lg:text-[84px] font-black leading-[0.95] tracking-[-0.04em] max-w-[800px] mb-9">
        每天，<span className="text-primary">輕鬆</span>推進一點
      </h1>
      <p className="text-lg md:text-xl text-text-dim max-w-[560px] leading-relaxed mb-10">
        讓任務和日常，在不打擾的節奏裡前進
      </p>
      <SignInForm action={signInAction} variant="outline" />
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/landing/landing-hero.tsx
git commit -m "feat: landing hero 區塊"
```

---

### Task 5: Tasks Mockup 元件

**Files:**
- Create: `src/components/landing/mockup-tasks.tsx`

- [ ] **Step 1: 建立 mockup-tasks.tsx**

```tsx
import { CheckSquare, FileText, CalendarDays, GripVertical } from "lucide-react";

/** 純 CSS 的 Tasks 頁 mockup，不使用真實資料，只展示視覺 */
export function MockupTasks() {
  return (
    <div
      className="pointer-events-none select-none rounded-2xl border border-border bg-background overflow-hidden shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6)]"
      aria-hidden="true"
    >
      <div className="p-8">
        {/* 標題區 */}
        <div className="mb-4">
          <div className="text-xl font-bold text-foreground">行動</div>
        </div>

        {/* 日期 heading */}
        <div className="mb-4">
          <div className="text-xs text-primary font-medium mb-1">
            Thursday
          </div>
          <div className="text-2xl font-bold text-foreground tabular-nums">
            4/10, 2026
          </div>
        </div>

        {/* 過期區塊 */}
        <div className="flex items-center gap-2 text-sm text-primary mb-1">
          <CheckSquare className="h-4 w-4" />
          <span className="font-medium">過期未完成 (2)</span>
        </div>
        <TaskRow title="繳水電費" dateLabel="4/5" dotColor="#c89968" />
        <TaskRow title="回覆客戶 Email" dateLabel="4/7" dotColor="#c89968" />

        <div className="h-2" />

        {/* 今天任務 */}
        <TaskRow title="早晨運動" checked dotColor="#8aa57d" />
        <TaskRow title="寫週報" dotColor="#c89968" />
        <TaskRow title="準備簡報" dotColor="#a78aaf" />
        <TaskRow title="閱讀 1 章" dotColor="#7a8b9c" />
      </div>
    </div>
  );
}

function TaskRow({
  title,
  checked = false,
  dateLabel,
  dotColor,
}: {
  title: string;
  checked?: boolean;
  dateLabel?: string;
  dotColor: string;
}) {
  return (
    <div className="flex items-center gap-2 px-1 py-2 rounded-md">
      <GripVertical className="h-4 w-4 text-text-faint opacity-0" />
      <div
        className={`h-[18px] w-[18px] rounded-[4px] border-2 flex items-center justify-center ${
          checked ? "bg-primary border-primary" : "border-text-dim"
        }`}
      >
        {checked && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path
              d="M1 4L3.5 6.5L9 1"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
      <span
        className={`flex-1 text-sm ${
          checked ? "line-through text-text-dim" : "text-foreground"
        }`}
      >
        {title}
      </span>
      {dateLabel && (
        <span className="text-xs text-text-dim tabular-nums mr-1">
          {dateLabel}
        </span>
      )}
      <FileText className="h-4 w-4 text-text-faint" />
      <CalendarDays className="h-4 w-4 text-text-faint" />
      <span
        className="h-3 w-3 rounded-full"
        style={{ backgroundColor: dotColor }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/landing/mockup-tasks.tsx
git commit -m "feat: landing tasks mockup 元件"
```

---

### Task 6: Notes Mockup 元件

**Files:**
- Create: `src/components/landing/mockup-notes.tsx`

- [ ] **Step 1: 建立 mockup-notes.tsx**

```tsx
/** 純 CSS 的 Notes 頁時間軸 mockup */
export function MockupNotes() {
  return (
    <div
      className="pointer-events-none select-none rounded-2xl border border-border bg-background overflow-hidden shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6)]"
      aria-hidden="true"
    >
      <div className="p-8">
        <div className="text-xl font-bold text-foreground mb-6">日誌</div>

        <NoteEntry
          dayNum={10}
          monthLabel="4 月"
          weekdayLabel="今天"
          isToday
          lines={["今天試著把卡片系統的設計重新整理了一次。", "發現有些想法可以沉澱成卡片……"]}
        />
        <NoteEntry
          dayNum={9}
          monthLabel="4 月"
          weekdayLabel="週三"
          lines={[
            "整天在想 nudge 的色系。最後決定不再抄 Heptabase 了。",
            "墨水紙張的感覺更貼近日記本。",
          ]}
        />
        <NoteEntry
          dayNum={8}
          monthLabel="4 月"
          weekdayLabel="週二"
          isLast
          lines={[
            "Task rollover 的設計：query-based 比 mutation-based 簡單太多。",
            "排序最舊在上能製造壓力感。",
          ]}
        />
      </div>
    </div>
  );
}

function NoteEntry({
  dayNum,
  monthLabel,
  weekdayLabel,
  isToday = false,
  isLast = false,
  lines,
}: {
  dayNum: number;
  monthLabel: string;
  weekdayLabel: string;
  isToday?: boolean;
  isLast?: boolean;
  lines: string[];
}) {
  return (
    <div className="relative pl-16 pb-6">
      {/* timeline column */}
      <div className="absolute left-5 top-0 bottom-0 w-3 flex flex-col items-center">
        {!isToday && <div className="h-[18px] w-px bg-border" />}
        {isToday && <div className="h-3" />}
        <div
          className={`h-3 w-3 rounded-full bg-primary shrink-0 ${
            isToday ? "ring-4 ring-primary/15" : ""
          }`}
        />
        {!isLast && <div className="flex-1 w-px bg-border" />}
      </div>

      {/* header */}
      <header className="flex items-center gap-3 mb-3">
        <span className="text-[2.25rem] font-black text-primary tabular-nums leading-none tracking-tight">
          {dayNum}
        </span>
        <div className="self-stretch w-px bg-primary/25 my-1" />
        <div className="flex flex-col gap-1 text-[10px] font-bold tracking-[0.18em] uppercase leading-none">
          <span className="text-foreground/75">{monthLabel}</span>
          <span className={isToday ? "text-primary" : "text-text-dim"}>
            {weekdayLabel}
          </span>
        </div>
      </header>

      {/* content */}
      <div className="text-sm text-muted-foreground space-y-1">
        {lines.map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/landing/mockup-notes.tsx
git commit -m "feat: landing notes mockup 元件"
```

---

### Task 7: Cards Mockup 元件

**Files:**
- Create: `src/components/landing/mockup-cards.tsx`

- [ ] **Step 1: 建立 mockup-cards.tsx**

```tsx
import { Plus, Search, List, LayoutGrid } from "lucide-react";

/** 純 CSS 的 Cards 頁 list 模式 mockup */
export function MockupCards() {
  const items = [
    {
      title: "研究 Tailwind v4",
      preview: "新功能：@theme inline 把 CSS 變數註冊為 Tailwind token。Build 速度顯著變快。",
      date: "4/3",
      status: { label: "完成", color: "#8aa57d" },
    },
    {
      title: "產品設計：減法的力量",
      preview: "讀完 Subtract 第 2 章。人類天生傾向加東西，但主動減東西往往效果更好。",
      date: "4/6",
      status: { label: "處理中", color: "#c89968" },
    },
    {
      title: "色彩心理學筆記",
      preview: "沉香木 #c89968 介於橘與棕之間，給人日記本的溫度但不過於激烈。",
      date: "4/8",
      status: { label: "處理中", color: "#c89968" },
    },
    {
      title: "為什麼 nudge 不做通知",
      preview: "市面上的 todo app 都在比誰更會打擾你。我想做的是反向的。",
      date: "4/9",
      status: { label: "處理中", color: "#c89968" },
    },
  ];

  return (
    <div
      className="pointer-events-none select-none rounded-2xl border border-border bg-background overflow-hidden shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6)]"
      aria-hidden="true"
    >
      <div className="p-8">
        {/* header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold text-foreground">卡片</h3>
            <div className="flex items-center justify-center h-8 w-8 rounded-lg text-primary">
              <Plus className="h-5 w-5" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 border border-border rounded-lg p-1">
              <div className="p-1.5 rounded bg-muted text-foreground">
                <List className="h-4 w-4" />
              </div>
              <div className="p-1.5 rounded text-text-dim">
                <LayoutGrid className="h-4 w-4" />
              </div>
            </div>
          </div>
        </div>

        {/* search bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-dim" />
          <div className="w-full pl-10 pr-3 py-2 text-sm rounded-lg border border-border bg-background text-text-faint">
            搜尋卡片...
          </div>
        </div>

        {/* list */}
        <div className="divide-y divide-border">
          {items.map((item, i) => (
            <div key={i} className="py-3 px-2 -mx-2">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-foreground">
                    {item.title}
                  </h4>
                  <p className="mt-1 text-xs text-text-dim line-clamp-2">
                    {item.preview}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span className="text-xs text-text-dim tabular-nums">
                    {item.date}
                  </span>
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded border"
                    style={{
                      color: item.status.color,
                      borderColor: item.status.color,
                    }}
                  >
                    {item.status.label}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/landing/mockup-cards.tsx
git commit -m "feat: landing cards mockup 元件"
```

---

### Task 8: Features 區塊（三大 section）

**Files:**
- Create: `src/components/landing/landing-features.tsx`

- [ ] **Step 1: 建立 landing-features.tsx**

```tsx
import { MockupTasks } from "./mockup-tasks";
import { MockupNotes } from "./mockup-notes";
import { MockupCards } from "./mockup-cards";

export function LandingFeatures() {
  return (
    <>
      {/* 行動 — 置中佈局 */}
      <section className="py-24 md:py-32 px-6 md:px-12 border-t border-border">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="text-xs font-bold tracking-[0.25em] uppercase text-primary mb-6">
              行動
            </div>
            <h2 className="text-5xl md:text-7xl font-black leading-[0.95] tracking-[-0.035em] max-w-[900px] mx-auto mb-6">
              專注在
              <br />
              今天要做的事
            </h2>
            <p className="text-lg md:text-xl text-text-dim max-w-[600px] mx-auto leading-relaxed">
              每日任務清單，不多不少，剛好是你今天能推進的量。
            </p>
          </div>
          <div className="max-w-[720px] mx-auto">
            <MockupTasks />
          </div>
        </div>
      </section>

      {/* 日誌 — alt 左文右圖 */}
      <section className="py-24 md:py-32 px-6 md:px-12 border-t border-border">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          <div>
            <div className="text-xs font-bold tracking-[0.25em] uppercase text-primary mb-6">
              日誌
            </div>
            <h2 className="text-5xl md:text-6xl font-black leading-[0.95] tracking-[-0.035em] mb-6">
              紀錄
              <br />
              每一個當下
            </h2>
            <p className="text-lg md:text-xl text-text-dim leading-relaxed">
              在任務旁邊寫下感受，累積成時間軸式的個人日記。
            </p>
          </div>
          <div>
            <MockupNotes />
          </div>
        </div>
      </section>

      {/* 卡片 — 置中佈局 */}
      <section className="py-24 md:py-32 px-6 md:px-12 border-t border-border">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="text-xs font-bold tracking-[0.25em] uppercase text-primary mb-6">
              卡片
            </div>
            <h2 className="text-5xl md:text-7xl font-black leading-[0.95] tracking-[-0.035em] max-w-[900px] mx-auto mb-6">
              回顧
              <br />
              你的 second brain
            </h2>
            <p className="text-lg md:text-xl text-text-dim max-w-[600px] mx-auto leading-relaxed">
              有內容的任務自動變成可搜尋的卡片。未來翻找時一次攤開所有脈絡。
            </p>
          </div>
          <div className="max-w-[720px] mx-auto">
            <MockupCards />
          </div>
        </div>
      </section>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/landing/landing-features.tsx
git commit -m "feat: landing features 三大 section"
```

---

### Task 9: 哲學區塊

**Files:**
- Create: `src/components/landing/landing-philosophy.tsx`

- [ ] **Step 1: 建立 landing-philosophy.tsx**

```tsx
export function LandingPhilosophy() {
  return (
    <section className="py-32 md:py-40 px-6 md:px-12 border-t border-border text-center">
      <div className="max-w-4xl mx-auto">
        <div
          className="text-[80px] text-primary mb-5"
          style={{
            fontFamily: 'Georgia, "Times New Roman", serif',
            lineHeight: 0.5,
          }}
          aria-hidden="true"
        >
          &ldquo;
        </div>
        <blockquote
          className="text-[32px] md:text-[42px] font-medium italic leading-[1.3] max-w-[760px] mx-auto text-foreground"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
        >
          我想要一個不催促的工具，
          <br />
          它在我打開的時候才存在。
        </blockquote>
        <div className="mt-8 text-xs tracking-[0.15em] uppercase text-text-dim">
          — NUDGE 的設計哲學
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/landing/landing-philosophy.tsx
git commit -m "feat: landing 哲學區塊"
```

---

### Task 10: 底部 CTA + Footer

**Files:**
- Create: `src/components/landing/landing-footer-cta.tsx`

- [ ] **Step 1: 建立 landing-footer-cta.tsx**

```tsx
import { SignInForm } from "./sign-in-form";

interface LandingFooterCtaProps {
  signInAction: () => Promise<void>;
}

export function LandingFooterCta({ signInAction }: LandingFooterCtaProps) {
  return (
    <section
      className="relative py-32 md:py-40 px-6 md:px-12 border-t border-border"
      style={{
        background:
          "linear-gradient(180deg, #1c1b18 0%, #0d0d0b 100%)",
      }}
    >
      <div className="max-w-4xl mx-auto text-center">
        <div className="text-xs font-bold tracking-[0.25em] uppercase text-primary mb-6">
          NUDGE
        </div>
        <h2 className="text-5xl md:text-6xl font-black leading-[1.05] tracking-[-0.03em] mb-10 text-foreground">
          你的日子
          <br />
          值得更安靜的工具
        </h2>
        <SignInForm action={signInAction} variant="solid" />
      </div>

      <footer className="max-w-4xl mx-auto mt-24 pt-8 border-t border-foreground/10 flex justify-between text-xs text-text-dim">
        <span>© 2026 Nudge · 個人作品</span>
        <a
          href="https://github.com/gv8899/Nudge"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-foreground transition-colors"
        >
          GitHub
        </a>
      </footer>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/landing/landing-footer-cta.tsx
git commit -m "feat: landing 底部 CTA + footer"
```

---

### Task 11: 組合 LandingPage

**Files:**
- Modify: `src/components/landing/landing-page.tsx`

- [ ] **Step 1: 整份替換 landing-page.tsx**

```tsx
import { LandingNav } from "./landing-nav";
import { LandingHero } from "./landing-hero";
import { LandingFeatures } from "./landing-features";
import { LandingPhilosophy } from "./landing-philosophy";
import { LandingFooterCta } from "./landing-footer-cta";

interface LandingPageProps {
  signInAction: () => Promise<void>;
}

export function LandingPage({ signInAction }: LandingPageProps) {
  return (
    <div
      data-landing
      className="dark min-h-screen bg-background text-foreground"
    >
      <LandingNav />
      <LandingHero signInAction={signInAction} />
      <LandingFeatures />
      <LandingPhilosophy />
      <LandingFooterCta signInAction={signInAction} />
    </div>
  );
}
```

注意：原本的 `"use client"` 被移除 — LandingPage 可以是 server component，因為只是組合其他元件，沒有 state / effect。`signInAction` 是 server action，可以安全地從 server component 傳到 server component children。

- [ ] **Step 2: Build 驗證**

```bash
npx next build 2>&1 | tail -10
```
預期：build 成功。

- [ ] **Step 3: Commit**

```bash
git add src/components/landing/landing-page.tsx
git commit -m "feat: 組合完整 landing page"
```

---

### Task 12: 驗證

- [ ] **Step 1: 啟動 dev server**

```bash
npm run dev
```

- [ ] **Step 2: 未登入瀏覽 `/`**

在隱私視窗或登出狀態下開 http://localhost:3000

確認以下：
1. **路由**：`/` 顯示 landing page，不 redirect 到 `/login`
2. **主題**：強制 dark mode（即使瀏覽器偏好 light）
3. **Nav**：固定頂部 `nudge` logo + GitHub 圖示
4. **Hero**：
   - eyebrow `NUDGE` 在 sepia 色
   - 主標「每天，**輕鬆**推進一點」，「輕鬆」是 sepia 色
   - 副標在 text-dim
   - 外框 CTA 按鈕 `使用 Google 帳號登入 →`
5. **Features**：三個大 section，各佔一個畫面高，標題 ~72px
   - 行動：置中佈局 + TasksMockup
   - 日誌：左文右圖 + NotesMockup
   - 卡片：置中佈局 + CardsMockup
6. **Mockups**：視覺與實際 UI 概念吻合（checkbox、日期、status badge 等）
7. **哲學區**：大 serif 引言 + signature
8. **底部 CTA**：深色漸層 + 大字 + 實心 sepia 按鈕 + footer
9. **登入流程**：Hero 或底部 CTA 按鈕都能觸發 Google 登入流程

- [ ] **Step 3: 已登入確認 redirect**

登入狀態下瀏覽 `/`，應該 redirect 到 `/day/{today}`，不看到 landing。

- [ ] **Step 4: Mobile 響應式檢查**

打開 devtools mobile 模式（< 768px）：
- Hero 字級縮到 `text-5xl`
- Features 的左文右圖改為垂直堆疊
- Mockup 正常縮放
- CTA 按鈕完整顯示

- [ ] **Step 5: 紙質感不污染 landing**

登入後到設定開啟「紙質感」，登出再回到 `/`：landing 的 bg-background 不應該有紋理。

- [ ] **Step 6: 最終 commit（如有微調）**

```bash
git add -A
git commit -m "fix: landing 頁微調"
```

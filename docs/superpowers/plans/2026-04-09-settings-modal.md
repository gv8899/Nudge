# 設定 Modal 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 從 sidebar 底部齒輪 icon 觸發設定 modal，包含帳號資料、主題切換（含跟隨系統）、登出三個區塊

**Architecture:** 新增 ThemeProvider 管理 `light/dark/system` 偏好（localStorage + matchMedia + html class），加上 inline FOUC script 避免閃爍。新增 `/api/me` 回傳當前 user。Settings modal 用既有的 `Dialog` 元件，從 `app-sidebar.tsx` 內 state 控制。

**Tech Stack:** Next.js 16, NextAuth, base-ui Dialog, Lucide icons, localStorage + matchMedia

---

## 檔案結構

| 操作 | 檔案 | 職責 |
|------|------|------|
| 新增 | `src/components/providers/theme-provider.tsx` | Theme Context、localStorage、matchMedia 監聽、套用 .dark class |
| 修改 | `src/app/layout.tsx` | 移除 hardcoded `dark` class、加入 inline FOUC script、包 ThemeProvider |
| 新增 | `src/app/api/me/route.ts` | GET 當前 user 資料 |
| 新增 | `src/components/settings/settings-modal.tsx` | Modal 容器與三個區塊（帳號、主題、登出） |
| 修改 | `src/components/sidebar/app-sidebar.tsx` | 加 Settings 齒輪 icon button、控制 modal open state |

---

### Task 1: Theme Provider + FOUC script

**Files:**
- Create: `src/components/providers/theme-provider.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: 建立 theme-provider.tsx**

```tsx
"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

const STORAGE_KEY = "nudge:theme";

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme === "system") {
    if (typeof window === "undefined") return "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return theme;
}

function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement;
  if (resolved === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("dark");

  // 初始載入：從 localStorage 讀取
  useEffect(() => {
    const stored = (localStorage.getItem(STORAGE_KEY) as Theme | null) || "system";
    setThemeState(stored);
    const resolved = resolveTheme(stored);
    setResolvedTheme(resolved);
    applyTheme(resolved);
  }, []);

  // 監聽 system 偏好變化
  useEffect(() => {
    if (theme !== "system") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const resolved: ResolvedTheme = mql.matches ? "dark" : "light";
      setResolvedTheme(resolved);
      applyTheme(resolved);
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [theme]);

  const setTheme = (next: Theme) => {
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage 不可用（隱私模式），忽略
    }
    const resolved = resolveTheme(next);
    setResolvedTheme(resolved);
    applyTheme(resolved);
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
```

- [ ] **Step 2: 修改 layout.tsx**

整份替換 `src/app/layout.tsx` 為：

```tsx
import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { ThemeProvider } from "@/components/providers/theme-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Nudge",
  description: "輕量型每日任務推進工具",
};

// FOUC 防閃爍 — 在 React hydrate 前同步套上 dark class
const themeInitScript = `
(function() {
  try {
    var stored = localStorage.getItem('nudge:theme');
    var theme = stored || 'system';
    var isDark = theme === 'dark' ||
      (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW" className={`${geistSans.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full bg-background text-foreground font-sans">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Build 驗證**

```bash
npx next build 2>&1 | tail -5
```

預期：build 成功，無 TS 錯誤。

- [ ] **Step 4: Commit**

```bash
git add src/components/providers/theme-provider.tsx src/app/layout.tsx
git commit -m "feat: 新增 theme provider + FOUC script，支援 light/dark/system"
```

---

### Task 2: /api/me endpoint

**Files:**
- Create: `src/app/api/me/route.ts`

- [ ] **Step 1: 建立 endpoint**

```ts
import { NextResponse } from "next/server";
import { getUser } from "@/lib/get-user";

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
  });
}
```

- [ ] **Step 2: 手動測試**

啟動 dev server，瀏覽 `http://localhost:3000/api/me`（已登入狀態），確認回傳 user JSON 而非 401。

- [ ] **Step 3: Commit**

```bash
git add src/app/api/me/route.ts
git commit -m "feat: 新增 GET /api/me 取得當前 user 資料"
```

---

### Task 3: Settings Modal 元件

**Files:**
- Create: `src/components/settings/settings-modal.tsx`

- [ ] **Step 1: 建立 settings-modal.tsx**

```tsx
"use client";

import useSWR from "swr";
import { signOut } from "next-auth/react";
import { Sun, Moon, Monitor, LogOut } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTheme, type Theme } from "@/components/providers/theme-provider";
import { fetcher } from "@/lib/fetcher";
import { format, parseISO } from "date-fns";

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface MeResponse {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

const themeOptions: { value: Theme; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "跟隨系統", Icon: Monitor },
];

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const { data: me } = useSWR<MeResponse>(open ? "/api/me" : null, fetcher);
  const { theme, setTheme } = useTheme();

  const handleSignOut = () => {
    signOut({ callbackUrl: "/login" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle className="text-lg font-semibold">設定</DialogTitle>

        <div className="divide-y divide-border">
          {/* 帳號資料 */}
          <section className="py-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-dim mb-3">
              帳號資料
            </h3>
            {me ? (
              <div className="flex items-center gap-3">
                {me.avatarUrl ? (
                  <img
                    src={me.avatarUrl}
                    alt=""
                    className="h-12 w-12 rounded-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-foreground font-medium">
                    {(me.name || me.email)[0].toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">
                    {me.name || "未命名"}
                  </div>
                  <div className="text-xs text-text-dim truncate">{me.email}</div>
                  <div className="text-xs text-text-faint mt-0.5">
                    加入於 {format(parseISO(me.createdAt), "yyyy/MM/dd")}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-12 animate-pulse rounded bg-muted" />
            )}
          </section>

          {/* 主題切換 */}
          <section className="py-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-dim mb-3">
              主題
            </h3>
            <div
              role="radiogroup"
              aria-label="主題切換"
              className="grid grid-cols-3 gap-2"
            >
              {themeOptions.map(({ value, label, Icon }) => {
                const active = theme === value;
                return (
                  <button
                    key={value}
                    role="radio"
                    aria-checked={active}
                    onClick={() => setTheme(value)}
                    className={`flex flex-col items-center gap-1.5 rounded-lg border px-3 py-3 text-xs transition-colors ${
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-text-dim hover:border-border-light hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {label}
                  </button>
                );
              })}
            </div>
          </section>

          {/* 登出 */}
          <section className="py-4">
            <button
              onClick={handleSignOut}
              className="flex items-center justify-center gap-2 w-full px-4 py-2 rounded-lg border border-destructive/40 text-destructive hover:bg-destructive/10 transition-colors text-sm font-medium"
            >
              <LogOut className="h-4 w-4" />
              登出
            </button>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/settings/settings-modal.tsx
git commit -m "feat: 新增 settings modal — 帳號資料、主題切換、登出"
```

---

### Task 4: Sidebar 加 Settings 按鈕

**Files:**
- Modify: `src/components/sidebar/app-sidebar.tsx`

- [ ] **Step 1: 整份替換 app-sidebar.tsx**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckSquare, NotebookPen, Settings } from "lucide-react";
import { format } from "date-fns";
import { SettingsModal } from "@/components/settings/settings-modal";

const navItems = [
  {
    href: () => `/day/${format(new Date(), "yyyy-MM-dd")}`,
    match: "/day/",
    icon: CheckSquare,
    label: "Tasks",
  },
  {
    href: () => "/notes",
    match: "/notes",
    icon: NotebookPen,
    label: "Notes",
  },
];

function NavLink({
  href,
  active,
  icon: Icon,
  label,
}: {
  href: string;
  active: boolean;
  icon: typeof CheckSquare;
  label: string;
}) {
  return (
    <Link
      href={href}
      title={label}
      aria-current={active ? "page" : undefined}
      className={`flex items-center justify-center w-11 h-11 rounded-lg transition-colors ${
        active
          ? "bg-border text-foreground"
          : "text-text-dim hover:text-foreground hover:bg-border/50"
      }`}
    >
      <Icon className="h-5 w-5" />
    </Link>
  );
}

function SettingsButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="設定"
      aria-label="開啟設定"
      className="flex items-center justify-center w-11 h-11 rounded-lg text-text-dim hover:text-foreground hover:bg-border/50 transition-colors"
    >
      <Settings className="h-5 w-5" />
    </button>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      {/* Desktop: left sidebar */}
      <aside
        aria-label="主導覽"
        className="hidden md:flex fixed left-0 top-0 bottom-0 z-40 w-14 flex-col items-center gap-2 border-r border-border bg-background py-4"
      >
        {navItems.map((item) => (
          <NavLink
            key={item.match}
            href={item.href()}
            active={pathname.startsWith(item.match)}
            icon={item.icon}
            label={item.label}
          />
        ))}
        <div className="mt-auto">
          <SettingsButton onClick={() => setSettingsOpen(true)} />
        </div>
      </aside>

      {/* Mobile: bottom bar */}
      <nav
        aria-label="主導覽"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around h-14 border-t border-border bg-background"
      >
        {navItems.map((item) => (
          <NavLink
            key={item.match}
            href={item.href()}
            active={pathname.startsWith(item.match)}
            icon={item.icon}
            label={item.label}
          />
        ))}
        <SettingsButton onClick={() => setSettingsOpen(true)} />
      </nav>

      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/sidebar/app-sidebar.tsx
git commit -m "feat: sidebar 加入 settings 按鈕觸發 modal"
```

---

### Task 5: 驗證

- [ ] **Step 1: Build 通過**

```bash
npx next build 2>&1 | tail -10
```

預期：build 成功。

- [ ] **Step 2: 啟動 dev server**

```bash
npm run dev
```

確認以下行為：

1. **主題初始化**：刷新頁面，網頁直接是當前 theme 對應的顏色，沒有閃爍（FOUC）
2. **Sidebar 設定按鈕**：desktop 左下角出現齒輪 icon，mobile 底部 bar 第三個位置
3. **點擊設定**：modal 彈出，顯示三個區塊
4. **帳號資料**：頭像、名稱、email、加入日期都顯示正確
5. **主題切換**：
   - 點 Light → 立即切換為 light mode
   - 點 Dark → 立即切換為 dark mode
   - 點「跟隨系統」→ 跟隨作業系統設定
   - 重新整理頁面，主題偏好被記住
6. **登出**：點擊登出，導向 `/login`
7. **localStorage**：devtools 確認 `nudge:theme` key 存在

- [ ] **Step 3: 系統主題切換測試**

選「跟隨系統」後，到作業系統設定切換明暗，確認 nudge 即時跟隨變化（不需要刷新）。

- [ ] **Step 4: 最終 commit（如有微調）**

```bash
git add -A
git commit -m "fix: 設定 modal 微調"
```

"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";
export type PaperTexture = "on" | "off";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  paperTexture: PaperTexture;
  setPaperTexture: (value: PaperTexture) => void;
}

// localStorage 儲存使用者選擇的模式（light / dark / system）
const MODE_STORAGE_KEY = "nudge:theme-mode";
// cookie 儲存解析後的實際主題（light / dark），供 SSR 讀取
const RESOLVED_COOKIE = "nudge:theme-resolved";
// 紙感顆粒紋理開關
const PAPER_COOKIE = "nudge:paper-texture";
const PAPER_CLASS = "paper-texture";

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme === "system") {
    if (typeof window === "undefined") return "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return theme;
}

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/; max-age=31536000; samesite=lax`;
}

function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement;
  if (resolved === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  setCookie(RESOLVED_COOKIE, resolved);
}

function applyPaperTexture(value: PaperTexture) {
  const root = document.documentElement;
  if (value === "on") root.classList.add(PAPER_CLASS);
  else root.classList.remove(PAPER_CLASS);
  setCookie(PAPER_COOKIE, value);
}

interface ThemeProviderProps {
  children: React.ReactNode;
  /** Server 從 cookie 傳入的初始值，避免 hydration mismatch */
  initialResolvedTheme: ResolvedTheme;
  initialPaperTexture: PaperTexture;
}

export function ThemeProvider({
  children,
  initialResolvedTheme,
  initialPaperTexture,
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] =
    useState<ResolvedTheme>(initialResolvedTheme);
  const [paperTexture, setPaperTextureState] =
    useState<PaperTexture>(initialPaperTexture);

  // 初始載入：從 localStorage 讀取使用者偏好
  useEffect(() => {
    const stored =
      (localStorage.getItem(MODE_STORAGE_KEY) as Theme | null) || "system";
    setThemeState(stored);
    const resolved = resolveTheme(stored);
    if (resolved !== initialResolvedTheme) {
      setResolvedTheme(resolved);
      applyTheme(resolved);
    } else {
      setCookie(RESOLVED_COOKIE, resolved);
    }
    // 紙感同步 cookie（即使 SSR 已套上 class）
    setCookie(PAPER_COOKIE, initialPaperTexture);
    // 時區 cookie 供 server-side 日期計算使用
    setCookie("nudge:tz", Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, [initialResolvedTheme, initialPaperTexture]);

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
      localStorage.setItem(MODE_STORAGE_KEY, next);
    } catch {
      // localStorage 不可用（隱私模式），忽略
    }
    const resolved = resolveTheme(next);
    setResolvedTheme(resolved);
    applyTheme(resolved);
  };

  const setPaperTexture = (next: PaperTexture) => {
    setPaperTextureState(next);
    applyPaperTexture(next);
  };

  return (
    <ThemeContext.Provider
      value={{ theme, resolvedTheme, setTheme, paperTexture, setPaperTexture }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

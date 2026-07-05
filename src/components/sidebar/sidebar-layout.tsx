"use client";

import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
} from "react";
import { useTranslations } from "next-intl";
import { IconSidebarLeft } from "@/components/ui/sf-icon";
import { AppSidebar } from "./app-sidebar";

const COLLAPSE_KEY = "nudge-sidebar-collapsed";
const COLLAPSE_EVENT = "nudge:sidebar-collapsed";

// localStorage 持久化的收合 state — 走 useSyncExternalStore：
// SSR 一律回傳 false（展開），client hydrate 後讀回儲存值，
// 避免在 effect 內 setState（react-hooks/set-state-in-effect）。
function subscribe(cb: () => void) {
  window.addEventListener(COLLAPSE_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(COLLAPSE_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}
function getSnapshot() {
  return window.localStorage.getItem(COLLAPSE_KEY) === "1";
}
function getServerSnapshot() {
  return false;
}

/** 頂部 toolbar 高度（px）— 對齊 Mac titlebar 一條橫貫全寬的帶。 */
export const TOP_BAR_HEIGHT = 48;

/** Sidebar 收合狀態 — 頁面 toolbar 內容（如 Daily 的 ‹ Today ›）對齊位置用。 */
const SidebarCollapsedContext = createContext(false);
export function useSidebarCollapsed() {
  return useContext(SidebarCollapsedContext);
}

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations("nav");
  const collapsed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const toggleCollapsed = useCallback(() => {
    window.localStorage.setItem(COLLAPSE_KEY, getSnapshot() ? "0" : "1");
    window.dispatchEvent(new Event(COLLAPSE_EVENT));
  }, []);

  return (
    <SidebarCollapsedContext.Provider value={collapsed}>
      {/* 頂部 toolbar — 對齊 Mac titlebar：橫貫全寬、無分隔線。 */}
      <div
        className="hidden md:block fixed top-0 inset-x-0 z-40 bg-background"
        style={{ height: TOP_BAR_HEIGHT }}
      />

      {/* 收合 toggle — 對齊 Mac：展開時落在 sidebar 卡片右上，收合後滑到
          最左（NavigationSplitView 同款），位置切換有過渡動畫。
          ⚠️ 必須是根層級 fixed（不能包在 top bar 內）：包在 z-40 的 bar 裡
          z-50 只在 bar 的 stacking context 內有效，整個 bar 會被 z-45 的
          sidebar 卡片壓住 → 展開時點不到。 */}
      <button
        type="button"
        onClick={toggleCollapsed}
        aria-label={t("toggleSidebar")}
        title={t("toggleSidebar")}
        aria-expanded={!collapsed}
        // 對照 Mac toolbar 鈕：寬扁膠囊（48×36）+ 16px 字形。展開時整顆落在
        // sidebar 卡片（x 8..216、y 8..）內、距卡片右/上各 6px，hover 底不能
        // 超出卡片圓角邊界；收合時回到 bar 左端垂直置中。
        className="hidden md:flex fixed z-50 items-center justify-center h-9 w-12 rounded-full text-text-dim hover:text-foreground hover:bg-surface-hover transition-[left,top,color,background-color] duration-300 ease-out"
        style={{ left: collapsed ? 10 : 162, top: 14 }}
      >
        <IconSidebarLeft className="h-4 w-4" />
      </button>

      <AppSidebar collapsed={collapsed} />
      <main
        className={`${collapsed ? "md:ml-0" : "md:ml-56"} md:transition-[margin-left] md:duration-300 md:ease-out md:pt-12 min-h-screen pb-16 md:pb-0`}
      >
        {children}
      </main>
    </SidebarCollapsedContext.Provider>
  );
}

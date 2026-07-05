"use client";

import type { ComponentType } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
import {
  IconTasks,
  IconCalendar,
  IconCards,
  IconNotes,
  IconSettings,
} from "@/components/ui/sf-icon";

// 注意：Tasks 連到 / —— `src/app/page.tsx` 是 server component，會 redirect
// 到當天的日期。這樣 sidebar 不需要在 client 端呼叫 new Date()，避免 SSR/
// hydrate 時差造成的 mismatch。
// Icon 對齊 Mac sidebar（PlatformRootView.swift:180-187）：checkmark.circle /
// calendar / square.stack / book（SF 的 book 是開卷書）/ gearshape。
const navItems: {
  href: string;
  match: string;
  icon: ComponentType<{ className?: string }>;
  labelKey: "tasks" | "calendar" | "notes" | "cards";
}[] = [
  {
    href: "/",
    match: "/day/",
    icon: IconTasks,
    labelKey: "tasks",
  },
  {
    href: "/calendar",
    match: "/calendar",
    icon: IconCalendar,
    labelKey: "calendar",
  },
  {
    href: "/cards",
    match: "/cards",
    icon: IconCards,
    labelKey: "cards",
  },
  {
    href: "/notes",
    match: "/notes",
    icon: IconNotes,
    labelKey: "notes",
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
  icon: ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Link
      href={href}
      title={label}
      aria-current={active ? "page" : undefined}
      // A31：選中態 = primary 18% tint 圓角 pill（對齊 Mac PlatformRootView.swift:376-411
      // 的 listRowBackground inset pill）。
      className={`flex items-center gap-2.5 px-2.5 h-10 rounded-md transition-colors ${
        active
          ? "bg-primary/[0.18] text-foreground"
          : "text-foreground hover:bg-border/50"
      }`}
    >
      <span className="flex items-center justify-start w-4 h-4 shrink-0">
        <Icon className="h-4 w-4" />
      </span>
      <span className="text-row-title">{label}</span>
    </Link>
  );
}

interface AppSidebarProps {
  collapsed: boolean;
}

export function AppSidebar({ collapsed }: AppSidebarProps) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const settingsActive = pathname.startsWith("/settings");

  return (
    <>
      {/*
       * Desktop sidebar — 對齊 Mac NavigationSplitView：收合 = 整個消失
       * （不留 icon rail，只剩 top bar 的 toggle），展開 = 卡片式底色
       * （rounded + foreground 2.5% tint、上下左各留 8px，同右欄卡片）。
       * Mobile (<md) : hidden（bottom bar 導覽）。
       *
       * ⚠️  layout offset: sidebar-layout.tsx 的 <main> margin 必須跟著
       *     collapsed state 切 md:ml-0 / md:ml-[196px]。
       */}
      <aside
        aria-label={t("mainNavAria")}
        aria-hidden={collapsed}
        inert={collapsed}
        // 常駐 DOM、收合時整個滑出左緣（過渡動畫對齊 Mac NavigationSplitView）。
        // top-2：底色卡片包到頂（toggle 落在卡片右上，pt-12 讓 nav 從 toggle
        // 列下方開始）；z-45 蓋過 top bar 的 bg，toggle 是 z-50。
        className={`hidden md:flex fixed left-2 top-2 bottom-2 z-45 w-[180px] flex-col gap-1 rounded-xl bg-foreground/[0.025] px-2 pt-12 pb-4 transition-transform duration-300 ease-out ${
          collapsed ? "-translate-x-[196px]" : "translate-x-0"
        }`}
      >
          {navItems.map((item) => (
            <NavLink
              key={item.match}
              href={item.href}
              active={pathname.startsWith(item.match)}
              icon={item.icon}
              label={t(item.labelKey)}
            />
          ))}

          {/* Settings — 對齊 Mac：獨立 Section 接在 Notes 下方，只用間距分段（無分隔線） */}
          <div className="mt-5">
            <NavLink
              href="/settings"
              active={settingsActive}
              icon={IconSettings}
              label={t("settings")}
            />
          </div>
        </aside>

      {/* Mobile: bottom bar — icon-only, unchanged */}
      <nav
        aria-label={t("mainNavAria")}
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around h-14 border-t border-border bg-background"
      >
        {navItems.map((item) => (
          <Link
            key={item.match}
            href={item.href}
            title={t(item.labelKey)}
            aria-current={pathname.startsWith(item.match) ? "page" : undefined}
            className={`flex items-center justify-center w-11 h-11 rounded-lg transition-colors ${
              pathname.startsWith(item.match)
                ? "bg-border text-foreground"
                : "text-text-dim hover:text-foreground hover:bg-border/50"
            }`}
          >
            <item.icon className="h-5 w-5" />
          </Link>
        ))}
        <Link
          href="/settings"
          title={t("settings")}
          aria-label={t("settingsAria")}
          aria-current={settingsActive ? "page" : undefined}
          className={`flex items-center justify-center w-11 h-11 rounded-lg transition-colors ${
            settingsActive
              ? "bg-border text-foreground"
              : "text-text-dim hover:text-foreground hover:bg-border/50"
          }`}
        >
          <IconSettings className="h-5 w-5" />
        </Link>
      </nav>
    </>
  );
}

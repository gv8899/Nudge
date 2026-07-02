"use client";

import type { ComponentType } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
import { CheckCircle2, BookOpen, Settings, CalendarDays } from "lucide-react";

function CardsIcon({ className }: { className?: string }) {
  return <span className={`cards-icon ${className ?? ""}`} role="img" aria-hidden="true" />;
}

// 注意：Tasks 連到 / —— `src/app/page.tsx` 是 server component，會 redirect
// 到當天的日期。這樣 sidebar 不需要在 client 端呼叫 new Date()，避免 SSR/
// hydrate 時差造成的 mismatch。
const navItems: {
  href: string;
  match: string;
  icon: ComponentType<{ className?: string }>;
  labelKey: "tasks" | "calendar" | "notes" | "cards";
}[] = [
  {
    href: "/",
    match: "/day/",
    icon: CheckCircle2,
    labelKey: "tasks",
  },
  {
    href: "/calendar",
    match: "/calendar",
    icon: CalendarDays,
    labelKey: "calendar",
  },
  {
    href: "/cards",
    match: "/cards",
    icon: CardsIcon,
    labelKey: "cards",
  },
  {
    href: "/notes",
    match: "/notes",
    icon: BookOpen,
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
      // A31：選中態改 primary 18% tint 圓角 pill（對齊 Mac PlatformRootView.swift:376-411
      // 的 listRowBackground inset pill），lg+ 展開態才加 mx-2 內縮 —
      // 收合 icon rail（md）空間太窄，內縮會把 icon 擠出可視範圍。
      className={`flex items-center gap-3 px-3 h-10 w-full rounded-md transition-colors lg:mx-2 lg:w-[calc(100%-1rem)] ${
        active
          ? "bg-primary/[0.18] text-foreground"
          : "text-text-dim hover:text-foreground hover:bg-border/50"
      }`}
    >
      {/* Icon: centred in the collapsed (md) rail, left-aligned in the wide (lg) sidebar */}
      <span className="flex items-center justify-center w-5 h-5 shrink-0 lg:justify-start">
        <Icon className="h-5 w-5" />
      </span>
      <span className="hidden lg:inline text-sm">{label}</span>
    </Link>
  );
}

export function AppSidebar() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const settingsActive = pathname.startsWith("/settings");

  return (
    <>
      {/*
       * Desktop sidebar — single <aside> with responsive width:
       *   md–lg  : w-14 (56 px) icon-only rail  — labels hidden via `hidden lg:inline`
       *   lg+    : w-52 (208 px) labeled sidebar — labels visible
       * Mobile (<md) : hidden (bottom bar handles navigation)
       *
       * ⚠️  layout offset: sidebar-layout.tsx must use `md:ml-14 lg:ml-52`
       *     so content doesn't slide under the wider sidebar at lg+.
       */}
      <aside
        aria-label={t("mainNavAria")}
        className="hidden md:flex fixed left-0 top-0 bottom-0 z-40 w-14 lg:w-52 flex-col items-center lg:items-stretch gap-1 border-r border-border bg-background pt-4 pb-4 px-1.5 lg:px-3"
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
        <div className="mt-auto w-full">
          {/* A25+R20：Settings 改 in-content route（不再開 modal），
              同 navItems 的 active-state 邏輯（pathname 前綴比對）。 */}
          <NavLink
            href="/settings"
            active={settingsActive}
            icon={Settings}
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
          <Settings className="h-5 w-5" />
        </Link>
      </nav>
    </>
  );
}

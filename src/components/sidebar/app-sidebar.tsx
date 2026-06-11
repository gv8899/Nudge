"use client";

import { useState, type ComponentType } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
import { CheckSquare, NotebookPen, Settings, CalendarDays } from "lucide-react";

function CardsIcon({ className }: { className?: string }) {
  return <span className={`cards-icon ${className ?? ""}`} role="img" aria-hidden="true" />;
}
import { SettingsModal } from "@/components/settings/settings-modal";

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
    icon: CheckSquare,
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
    icon: NotebookPen,
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
      className={`flex items-center gap-3 px-3 h-10 w-full rounded-lg transition-colors ${
        active
          ? "bg-border text-foreground"
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

function SettingsButton({
  onClick,
  title,
  ariaLabel,
  label,
}: {
  onClick: () => void;
  title: string;
  ariaLabel: string;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      className="flex items-center gap-3 px-3 h-10 w-full rounded-lg text-text-dim hover:text-foreground hover:bg-border/50 transition-colors"
    >
      <span className="flex items-center justify-center w-5 h-5 shrink-0 lg:justify-start">
        <Settings className="h-5 w-5" />
      </span>
      <span className="hidden lg:inline text-sm">{label}</span>
    </button>
  );
}

export function AppSidebar() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [settingsOpen, setSettingsOpen] = useState(false);

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
          <SettingsButton
            onClick={() => setSettingsOpen(true)}
            title={t("settings")}
            ariaLabel={t("settingsAria")}
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
        <button
          onClick={() => setSettingsOpen(true)}
          title={t("settings")}
          aria-label={t("settingsAria")}
          className="flex items-center justify-center w-11 h-11 rounded-lg text-text-dim hover:text-foreground hover:bg-border/50 transition-colors"
        >
          <Settings className="h-5 w-5" />
        </button>
      </nav>

      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}

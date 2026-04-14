"use client";

import { useState, type ComponentType } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
import { CheckSquare, NotebookPen, Settings } from "lucide-react";

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
  labelKey: "tasks" | "notes" | "cards";
}[] = [
  {
    href: "/",
    match: "/day/",
    icon: CheckSquare,
    labelKey: "tasks",
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

function SettingsButton({
  onClick,
  title,
  ariaLabel,
}: {
  onClick: () => void;
  title: string;
  ariaLabel: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      className="flex items-center justify-center w-11 h-11 rounded-lg text-text-dim hover:text-foreground hover:bg-border/50 transition-colors"
    >
      <Settings className="h-5 w-5" />
    </button>
  );
}

export function AppSidebar() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      {/* Desktop: left sidebar */}
      <aside
        aria-label={t("mainNavAria")}
        className="hidden md:flex fixed left-0 top-0 bottom-0 z-40 w-14 flex-col items-center gap-2 border-r border-border bg-background pt-4 pb-16"
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
        <div className="mt-auto">
          <SettingsButton
            onClick={() => setSettingsOpen(true)}
            title={t("settings")}
            ariaLabel={t("settingsAria")}
          />
        </div>
      </aside>

      {/* Mobile: bottom bar */}
      <nav
        aria-label={t("mainNavAria")}
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around h-14 border-t border-border bg-background"
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
        <SettingsButton
          onClick={() => setSettingsOpen(true)}
          title={t("settings")}
          ariaLabel={t("settingsAria")}
        />
      </nav>

      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}

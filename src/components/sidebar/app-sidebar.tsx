"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckSquare, NotebookPen } from "lucide-react";
import { format } from "date-fns";

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

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop: left sidebar */}
      <aside aria-label="主導覽" className="hidden md:flex fixed left-0 top-0 bottom-0 z-40 w-14 flex-col items-center gap-2 border-r border-border bg-background py-4">
        {navItems.map((item) => (
          <NavLink
            key={item.match}
            href={item.href()}
            active={pathname.startsWith(item.match)}
            icon={item.icon}
            label={item.label}
          />
        ))}
      </aside>

      {/* Mobile: bottom bar */}
      <nav aria-label="主導覽" className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around h-14 border-t border-border bg-background">
        {navItems.map((item) => (
          <NavLink
            key={item.match}
            href={item.href()}
            active={pathname.startsWith(item.match)}
            icon={item.icon}
            label={item.label}
          />
        ))}
      </nav>
    </>
  );
}

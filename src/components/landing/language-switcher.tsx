"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { Globe, Check } from "lucide-react";
import { Link, usePathname, routing } from "@/i18n/routing";

const LABELS: Record<string, string> = {
  "zh-TW": "中文",
  en: "English",
  ja: "日本語",
};

/** landing 語言切換：地球 icon 點開選單，保留當前路徑、只換 locale */
export function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={LABELS[locale] ?? "Language"}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-[var(--surface-hover)] hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <Globe className="h-[18px] w-[18px]" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 min-w-[148px] rounded-xl border border-border bg-[var(--surface)] p-1 shadow-[0_16px_40px_-12px_rgba(40,32,18,0.28)]"
        >
          {routing.locales.map((loc) => {
            const active = loc === locale;
            return (
              <Link
                key={loc}
                href={pathname}
                locale={loc}
                role="menuitem"
                onClick={() => setOpen(false)}
                className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active
                    ? "font-medium text-foreground"
                    : "text-muted-foreground hover:bg-[var(--surface-hover)] hover:text-foreground"
                }`}
              >
                {LABELS[loc] ?? loc}
                {active && <Check className="h-4 w-4 text-primary" />}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

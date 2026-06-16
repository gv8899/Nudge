"use client";

import { useLocale } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
import { routing } from "@/i18n/routing";

const LABELS: Record<string, string> = {
  "zh-TW": "中",
  en: "EN",
  ja: "日",
};

/** landing 語言切換：保留當前路徑、只換 locale */
export function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  return (
    <div className="flex items-center gap-1 text-sm">
      {routing.locales.map((loc) => {
        const active = loc === locale;
        return (
          <Link
            key={loc}
            href={pathname}
            locale={loc}
            aria-current={active ? "true" : undefined}
            className={`px-2 py-1 rounded-md transition-colors ${
              active
                ? "text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {LABELS[loc] ?? loc}
          </Link>
        );
      })}
    </div>
  );
}

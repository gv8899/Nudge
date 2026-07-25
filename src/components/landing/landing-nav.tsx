"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
import { LanguageSwitcher } from "./language-switcher";

/**
 * 三頁共用 header（首頁 / 定價 / 下載）。
 * 「功能 / 理念」是首頁區塊錨點：在首頁用原生 `#hash`（平滑捲動、不導頁），
 * 在子頁改用 next-intl Link 導回首頁對應區塊（`/#hash`，自動帶 locale）。
 */
export function LandingNav() {
  const t = useTranslations("landing");
  const pathname = usePathname();
  const onHome = pathname === "/";
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const sectionLinkClass =
    "hidden md:inline hover:text-foreground transition-colors";

  return (
    <nav
      aria-label={t("nav.aria")}
      className={`fixed top-0 inset-x-0 z-50 h-14 transition-colors ${
        scrolled
          ? "bg-background/80 backdrop-blur-xl border-b border-border"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto max-w-6xl h-full px-6 md:px-8 flex items-center justify-between">
        {onHome ? (
          <a
            href="#top"
            className="text-lg font-semibold text-foreground tracking-tight"
          >
            Nudge
          </a>
        ) : (
          <Link
            href="/"
            className="text-lg font-semibold text-foreground tracking-tight"
          >
            Nudge
          </Link>
        )}
        <div className="flex items-center gap-7 text-sm text-muted-foreground">
          {onHome ? (
            <a href="#features" className={sectionLinkClass}>
              {t("nav.features")}
            </a>
          ) : (
            <Link href="/#features" className={sectionLinkClass}>
              {t("nav.features")}
            </Link>
          )}
          <Link href="/pricing" className="hover:text-foreground transition-colors">
            {t("nav.pricing")}
          </Link>
          <Link
            href="/download"
            className="hover:text-foreground transition-colors"
          >
            {t("nav.download")}
          </Link>
          <LanguageSwitcher />
        </div>
      </div>
    </nav>
  );
}

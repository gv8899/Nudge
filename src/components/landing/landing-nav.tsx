"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { LanguageSwitcher } from "./language-switcher";

export function LandingNav() {
  const t = useTranslations("landing");
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
        <a
          href="#top"
          className="text-lg font-semibold text-foreground tracking-tight"
        >
          Nudge
        </a>
        <div className="flex items-center gap-7 text-sm text-muted-foreground">
          <a
            href="#features"
            className="hidden md:inline hover:text-foreground transition-colors"
          >
            {t("nav.features")}
          </a>
          <a
            href="#philosophy"
            className="hidden md:inline hover:text-foreground transition-colors"
          >
            {t("nav.philosophy")}
          </a>
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

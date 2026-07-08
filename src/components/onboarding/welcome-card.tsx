"use client";

import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { Link } from "@/i18n/routing";

/**
 * First-run welcome 卡。一句歡迎 + 三點（任務/卡片/重複與提醒）+「開始使用」，
 * 外加一條「看看範例卡片」連到 /cards（卡片不在日檢視上出現）。
 * 樣式全用 design token。
 */
export function WelcomeCard({ onDismiss }: { onDismiss: () => void }) {
  const t = useTranslations("onboarding.welcome");
  const tc = useTranslations("common");

  return (
    <div className="relative mt-4 mb-3 mx-6 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <button
        type="button"
        onClick={onDismiss}
        aria-label={tc("close")}
        className="absolute right-3 top-3 text-text-dim hover:text-foreground transition-colors"
      >
        <X className="h-4 w-4" />
      </button>

      <h2 className="text-lg font-semibold text-foreground pr-6">{t("title")}</h2>
      <p className="mt-1 text-sm text-text-dim">{t("intro")}</p>

      <ul className="mt-3 space-y-1.5 text-sm text-foreground">
        <li className="flex gap-2">
          <span className="text-primary">•</span>
          <span>{t("pointTasks")}</span>
        </li>
        <li className="flex gap-2">
          <span className="text-primary">•</span>
          <span>{t("pointCards")}</span>
        </li>
        <li className="flex gap-2">
          <span className="text-primary">•</span>
          <span>{t("pointRecurring")}</span>
        </li>
      </ul>

      <div className="mt-4 flex items-center gap-4">
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
        >
          {t("cta")}
        </button>
        <Link
          href="/cards"
          onClick={onDismiss}
          className="text-sm text-text-dim hover:text-foreground underline-offset-2 hover:underline transition-colors"
        >
          {t("viewCards")}
        </Link>
      </div>
    </div>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { CalendarDays } from "lucide-react";

type Variant = "not_connected" | "empty" | "error" | "reauth";

interface Props {
  variant: Variant;
  onRetry?: () => void;
}

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** Full-height centered hero, aligned with Mac's `CalendarConnectPrompt`. */
function ConnectHero({
  title,
  description,
  ctaLabel,
}: {
  title: string;
  description: string;
  ctaLabel: string;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      {/* Mac CalendarConnectPrompt icon 用 nudgePrimary */}
      <CalendarDays size={56} className="text-primary" />
      <div className="text-column-title text-foreground">{title}</div>
      <div className="max-w-[280px] text-center text-empty-state text-text-dim">
        {description}
      </div>
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a
        href="/api/calendar/connect"
        className={`rounded-full bg-primary px-5 py-2.5 text-row-title text-primary-foreground ${focusRing}`}
      >
        {ctaLabel}
      </a>
    </div>
  );
}

export function CalendarEmptyState({ variant, onRetry }: Props) {
  const t = useTranslations("calendar");

  if (variant === "not_connected") {
    return (
      <ConnectHero
        title={t("connectTitle")}
        description={t("connectDescription")}
        ctaLabel={t("connectTitle")}
      />
    );
  }

  if (variant === "empty") {
    return (
      <div className="p-4 text-center text-empty-state text-text-dim">
        {t("panelEmpty")}
      </div>
    );
  }

  if (variant === "reauth") {
    return (
      <ConnectHero
        title={t("connectTitle")}
        description={t("panelReauth")}
        ctaLabel={t("connectButton")}
      />
    );
  }

  // error
  return (
    <div className="flex flex-col items-start gap-2 p-3 text-row-meta">
      <div className="text-text-dim">{t("panelError")}</div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className={`rounded-md border border-border px-3 py-1 text-foreground hover:bg-surface-hover ${focusRing}`}
        >
          {t("panelRetry")}
        </button>
      )}
    </div>
  );
}

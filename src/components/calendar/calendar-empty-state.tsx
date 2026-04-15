"use client";

import { useTranslations } from "next-intl";
import { CalendarPlus } from "lucide-react";

type Variant = "not_connected" | "empty" | "error" | "reauth";

interface Props {
  variant: Variant;
  onRetry?: () => void;
}

export function CalendarEmptyState({ variant, onRetry }: Props) {
  const t = useTranslations("calendar");

  const focusRing =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

  if (variant === "not_connected") {
    return (
      <div className="flex flex-col items-start gap-2 p-3 text-sm">
        <div className="text-text-dim">{t("connectDescription")}</div>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/api/calendar/connect"
          className={`inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-primary-foreground ${focusRing}`}
        >
          <CalendarPlus size={14} />
          {t("connectTitle")}
        </a>
      </div>
    );
  }

  if (variant === "empty") {
    return (
      <div className="p-4 text-center text-sm text-text-dim">
        {t("panelEmpty")}
      </div>
    );
  }

  if (variant === "reauth") {
    return (
      <div className="flex flex-col items-start gap-2 p-3 text-sm">
        <div className="text-text-dim">{t("panelReauth")}</div>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/api/calendar/connect"
          className={`rounded-md bg-primary px-3 py-1.5 text-primary-foreground ${focusRing}`}
        >
          {t("connectButton")}
        </a>
      </div>
    );
  }

  // error
  return (
    <div className="flex flex-col items-start gap-2 p-3 text-sm">
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

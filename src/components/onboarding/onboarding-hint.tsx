"use client";

import { useTranslations } from "next-intl";

/**
 * 錨在某個 seed 任務列上方的小提示泡泡。可 dismiss（各自本地記已讀）。
 * text 由呼叫端用 useTranslations 取好傳入。
 */
export function OnboardingHint({
  text,
  onDismiss,
}: {
  text: string;
  onDismiss: () => void;
}) {
  const t = useTranslations("onboarding.hint");
  return (
    <div className="mx-6 mb-1 flex items-center gap-3 rounded-lg bg-primary/10 px-3 py-1.5 text-xs text-foreground">
      <span className="flex-1">{text}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 text-text-dim hover:text-foreground transition-colors"
      >
        {t("dismiss")}
      </button>
    </div>
  );
}

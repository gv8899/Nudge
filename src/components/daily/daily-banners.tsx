"use client";

import { useTranslations } from "next-intl";
import { WifiOff, AlertTriangle, RotateCw } from "lucide-react";

/** 對齊 Mac OfflineBannerView：warning 底、wifi-slash、上次更新時間。 */
export function OfflineBanner({ lastUpdated }: { lastUpdated: string }) {
  const t = useTranslations("offline");
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-warning/10 text-sm text-foreground">
      <WifiOff className="h-4 w-4 text-warning shrink-0" aria-hidden="true" />
      <span>{t("banner", { lastUpdated })}</span>
    </div>
  );
}

/** 對齊 Mac ErrorBannerView：destructive 底、三角驚嘆、retry 鈕。 */
export function ErrorBanner({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("error");
  const tCommon = useTranslations("common");
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-destructive/10 text-sm text-foreground">
      <AlertTriangle className="h-4 w-4 text-destructive shrink-0" aria-hidden="true" />
      <span className="flex-1">{t("unknown")}</span>
      <button
        type="button"
        onClick={onRetry}
        aria-label={tCommon("retry")}
        title={tCommon("retry")}
        className="flex items-center justify-center h-9 min-w-11 rounded-md text-primary hover:bg-surface-hover transition-colors"
      >
        <RotateCw className="h-4 w-4" />
      </button>
    </div>
  );
}

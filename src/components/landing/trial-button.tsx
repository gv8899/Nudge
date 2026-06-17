"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { DOWNLOAD_LINKS } from "@/lib/landing-links";

interface TrialButtonProps {
  /** 主按鈕尺寸：hero/CTA 用 lg，nav 用 sm */
  size?: "sm" | "lg";
  className?: string;
}

/**
 * 點擊當下偵測 OS。Mac/iOS 且已有正式下載連結 → 回傳對應平台 URL；
 * 其他或連結還是 placeholder → 回 null（走 /download fallback）。
 */
function directDownloadUrl(): string | null {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent;
  // iPadOS 14+ 的 Safari UA 會偽裝成 Macintosh，靠 touch 點數區分
  const isIOS =
    /iPhone|iPad|iPod/.test(ua) ||
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const platform = isIOS ? "ios" : /Macintosh|Mac OS X/.test(ua) ? "mac" : null;
  if (!platform) return null;
  const url = DOWNLOAD_LINKS[platform];
  return url && url !== "#" ? url : null;
}

/**
 * 「免費試用 7 天」主按鈕。
 * Mac → DMG、iPhone/iPad → App Store（連結就緒時）；其他 → /download 選平台。
 * SSR 與無 JS 時一律連到 /download。
 */
export function TrialButton({ size = "lg", className = "" }: TrialButtonProps) {
  const t = useTranslations("landing");
  const pad = size === "lg" ? "px-7 py-3.5 text-base" : "px-4 py-2 text-sm";
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      <Link
        href="/download"
        onClick={(e) => {
          const url = directDownloadUrl();
          if (url) {
            e.preventDefault();
            window.location.href = url;
          }
        }}
        className={`inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground font-medium ${pad} transition-transform hover:scale-[1.03] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary`}
      >
        {t("trial")}
      </Link>
    </div>
  );
}

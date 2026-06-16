"use client";

import { useTranslations } from "next-intl";
import { DOWNLOAD_LINKS } from "@/lib/landing-links";

interface DownloadButtonsProps {
  /** 主按鈕尺寸：hero/CTA 用 lg，nav 用 sm */
  size?: "sm" | "lg";
  className?: string;
}

export function DownloadButtons({
  size = "lg",
  className = "",
}: DownloadButtonsProps) {
  const t = useTranslations("landing");
  const pad = size === "lg" ? "px-7 py-3.5 text-base" : "px-4 py-2 text-sm";
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      <a
        href={DOWNLOAD_LINKS.mac}
        className={`inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground font-medium ${pad} transition-transform hover:scale-[1.03] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary`}
      >
        {t("download.mac")}
      </a>
      <a
        href={DOWNLOAD_LINKS.ios}
        className={`inline-flex items-center justify-center rounded-full font-medium text-primary ring-1 ring-primary/30 ${pad} transition-colors hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary`}
      >
        {t("download.ios")}
      </a>
    </div>
  );
}

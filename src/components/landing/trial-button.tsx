"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";

interface TrialButtonProps {
  /** 主按鈕尺寸：hero/CTA 用 lg，nav 用 sm */
  size?: "sm" | "lg";
  className?: string;
}

/** 單顆「免費試用 7 天」主按鈕，導向 /download 選平台 */
export function TrialButton({ size = "lg", className = "" }: TrialButtonProps) {
  const t = useTranslations("landing");
  const pad = size === "lg" ? "px-7 py-3.5 text-base" : "px-4 py-2 text-sm";
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      <Link
        href="/download"
        className={`inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground font-medium ${pad} transition-transform hover:scale-[1.03] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary`}
      >
        {t("trial")}
      </Link>
    </div>
  );
}

"use client";

import { useState } from "react";
import useSWR from "swr";
import { useTranslations } from "next-intl";
import { format, parseISO } from "date-fns";
import { fetcher } from "@/lib/fetcher";
import { Link } from "@/i18n/routing";
import { SettingsRow } from "./settings-primitives";

interface Entitlement {
  isActive: boolean;
  status: "trialing" | "active" | "past_due" | "canceled" | "expired";
  source: string | null;
  accessUntil: string | null;
}

// 曾經付費過的來源（用來決定 expired 的措辭：訂閱已結束 vs 試用已結束）。
const PAID_SOURCES = ["apple", "paddle", "newebpay"];

// 仍有權、但需要提醒的狀態（付款失敗 / 已取消但未到期）→ 用警告配色。
const ATTENTION_STATUSES = ["past_due", "canceled"];
interface MeResponse {
  entitlement?: Entitlement;
}

function daysLeft(accessUntil: string | null): number {
  if (!accessUntil) return Infinity;
  return Math.max(
    0,
    Math.ceil((new Date(accessUntil).getTime() - Date.now()) / 86_400_000),
  );
}

// 訂閱「狀態顯示」。兌換碼輸入移到 paywall/結帳流程（Slice B），不放這。
export function SubscriptionSection() {
  const t = useTranslations("billing");
  const { data: me } = useSWR<MeResponse>("/api/me", fetcher);
  const ent = me?.entitlement;

  function fmtDate(iso: string | null): string {
    return iso ? format(parseISO(iso), "yyyy/MM/dd") : "";
  }

  function statusLine(): string {
    if (!ent) return "";
    switch (ent.status) {
      case "trialing":
        return t("trialing", { days: daysLeft(ent.accessUntil) });
      case "active":
        return ent.accessUntil === null
          ? t("activeForever")
          : t("activeUntil", { date: fmtDate(ent.accessUntil) });
      case "canceled":
        return t("canceled", { date: fmtDate(ent.accessUntil) });
      case "past_due":
        return t("pastDue");
      default:
        // expired：曾付費過 → 訂閱已結束；否則（試用/promo/admin）→ 試用已結束。
        return ent.source && PAID_SOURCES.includes(ent.source)
          ? t("subscriptionEnded")
          : t("expired");
    }
  }

  // CTA：無權或需注意 → 升級（/paywall）；paddle 付費中 → 管理訂閱（portal）。
  const showUpgrade = !!ent && (!ent.isActive || ATTENTION_STATUSES.includes(ent.status));
  const showManage = !!ent && ent.isActive && ent.source === "paddle";
  const [portalBusy, setPortalBusy] = useState(false);

  async function openPortal() {
    if (portalBusy) return;
    setPortalBusy(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      if (res.ok) {
        const { url } = await res.json();
        window.open(url, "_blank", "noopener");
      }
    } finally {
      setPortalBusy(false);
    }
  }

  return (
    <SettingsRow>
      <div className="flex items-center justify-between gap-3 w-full">
        {ent ? (
          <span
            className={
              ent.isActive && ATTENTION_STATUSES.includes(ent.status)
                ? "text-chart-2"
                : ent.isActive
                  ? "text-primary"
                  : "text-text-dim"
            }
          >
            {statusLine()}
          </span>
        ) : (
          <span className="text-text-dim">…</span>
        )}
        {showUpgrade && (
          <Link
            href="/paywall"
            className="shrink-0 rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 transition-opacity"
          >
            {t("upgrade")}
          </Link>
        )}
        {!showUpgrade && showManage && (
          <button
            type="button"
            onClick={openPortal}
            disabled={portalBusy}
            className="shrink-0 rounded-full border border-border px-4 py-1.5 text-xs text-foreground hover:bg-surface-hover transition-colors disabled:opacity-50"
          >
            {t("manage")}
          </button>
        )}
      </div>
    </SettingsRow>
  );
}

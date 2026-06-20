"use client";

import useSWR from "swr";
import { useTranslations } from "next-intl";
import { format, parseISO } from "date-fns";
import { fetcher } from "@/lib/fetcher";

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

  return (
    <section className="py-4">
      <h3 className="text-xs font-bold uppercase tracking-wider text-text-dim mb-3">
        {t("section")}
      </h3>
      {ent ? (
        <div
          className={`rounded-lg border px-3 py-2.5 text-sm ${
            ent.isActive && ATTENTION_STATUSES.includes(ent.status)
              ? "border-chart-2/40 bg-chart-2/5 text-foreground"
              : ent.isActive
                ? "border-primary/40 bg-primary/5 text-foreground"
                : "border-border text-text-dim"
          }`}
        >
          {statusLine()}
        </div>
      ) : (
        <div className="h-10 animate-pulse rounded bg-muted" />
      )}
    </section>
  );
}

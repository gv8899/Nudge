"use client";

import useSWR from "swr";
import { useTranslations } from "next-intl";
import { format, parseISO } from "date-fns";
import { fetcher } from "@/lib/fetcher";

interface Entitlement {
  isPremium: boolean;
  status: "trialing" | "active" | "expired";
  source: string | null;
  accessUntil: string | null;
}
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

  function statusLine(): string {
    if (!ent) return "";
    if (ent.status === "trialing") {
      return t("trialing", { days: daysLeft(ent.accessUntil) });
    }
    if (ent.status === "active") {
      if (ent.accessUntil === null) return t("activeForever");
      return t("activeUntil", {
        date: format(parseISO(ent.accessUntil), "yyyy/MM/dd"),
      });
    }
    return t("expired");
  }

  return (
    <section className="py-4">
      <h3 className="text-xs font-bold uppercase tracking-wider text-text-dim mb-3">
        {t("section")}
      </h3>
      {ent ? (
        <div
          className={`rounded-lg border px-3 py-2.5 text-sm ${
            ent.isPremium
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

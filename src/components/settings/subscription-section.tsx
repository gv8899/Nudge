"use client";

import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
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

export function SubscriptionSection() {
  const t = useTranslations("billing");
  const { data: me } = useSWR<MeResponse>("/api/me", fetcher);
  const { mutate } = useSWRConfig();

  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  async function redeem() {
    const c = code.trim();
    if (!c || busy) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/promo/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: c }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const reason = data?.reason ?? "invalid";
        setError(t(`redeem.error.${reason}`));
        return;
      }
      setMessage(t("redeem.success", { days: data.grantedDays }));
      setCode("");
      await mutate("/api/me");
    } catch {
      setError(t("redeem.error.invalid"));
    } finally {
      setBusy(false);
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

      {/* 兌換碼 */}
      <div className="mt-3">
        <label className="text-xs text-text-dim">{t("redeem.label")}</label>
        <div className="mt-1 flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") redeem();
            }}
            placeholder={t("redeem.placeholder")}
            className="flex-1 rounded-lg border border-border bg-transparent px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary uppercase placeholder:normal-case placeholder:text-text-faint"
          />
          <button
            type="button"
            onClick={redeem}
            disabled={busy || !code.trim()}
            className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {busy ? t("redeem.redeeming") : t("redeem.button")}
          </button>
        </div>
        {message && (
          <p className="mt-2 text-xs text-primary" role="status">
            {message}
          </p>
        )}
        {error && (
          <p className="mt-2 text-xs text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}

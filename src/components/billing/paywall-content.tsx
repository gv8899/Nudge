"use client";

// 付費牆：雙價卡（預設年繳）+ Paddle.js overlay 結帳 + promo 兌換入口。
// 顯示價優先用 Paddle PricePreview 的當地化含稅價；拉不到 fallback USD 常數
// （僅顯示用——實際扣款金額一律由 Paddle price 決定）。

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { initializePaddle, type Paddle } from "@paddle/paddle-js";
import { Link } from "@/i18n/routing";

type CheckoutInfo = {
  clientToken?: string;
  env?: "sandbox" | "production";
  priceIds?: { monthly: string; annual: string };
  withTrial?: boolean;
  customData?: { user_id: string };
  email?: string;
  alreadySubscribed: boolean;
};

// 顯示用 fallback（PricePreview 失敗時）；實際金額由 Paddle price 決定。
const FALLBACK_DISPLAY = { annual: "$99", monthly: "$12.99", annualPerMonth: "$8.25" };
const SAVE_PCT = 37;

type Cycle = "annual" | "monthly";

export function PaywallContent() {
  const t = useTranslations("billing.paywall");
  const tRedeem = useTranslations("billing.redeem");
  const locale = useLocale();

  const [info, setInfo] = useState<CheckoutInfo | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const [paddle, setPaddle] = useState<Paddle | null>(null);
  const [cycle, setCycle] = useState<Cycle>("annual");
  const [display, setDisplay] = useState(FALLBACK_DISPLAY);
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoState, setPromoState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [promoMessage, setPromoMessage] = useState("");

  // ① 取結帳資訊
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/billing/checkout");
      if (cancelled) return;
      if (res.status === 503) return setNotConfigured(true);
      if (!res.ok) return;
      setInfo(await res.json());
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ② 初始化 Paddle.js + 當地化顯示價
  useEffect(() => {
    if (!info || info.alreadySubscribed || !info.clientToken || !info.priceIds) return;
    let cancelled = false;
    (async () => {
      const p = await initializePaddle({
        token: info.clientToken!,
        environment: info.env === "production" ? "production" : "sandbox",
      });
      if (!p || cancelled) return;
      setPaddle(p);
      try {
        const preview = await p.PricePreview({
          items: [
            { priceId: info.priceIds!.annual, quantity: 1 },
            { priceId: info.priceIds!.monthly, quantity: 1 },
          ],
        });
        if (cancelled) return;
        const items = preview.data.details.lineItems;
        const annual = items.find((i) => i.price.id === info.priceIds!.annual);
        const monthly = items.find((i) => i.price.id === info.priceIds!.monthly);
        if (annual && monthly) {
          setDisplay({
            annual: annual.formattedTotals.total,
            monthly: monthly.formattedTotals.total,
            annualPerMonth: FALLBACK_DISPLAY.annualPerMonth,
          });
        }
      } catch {
        // 顯示價 fallback，不擋結帳
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [info]);

  const openCheckout = useCallback(() => {
    if (!paddle || !info?.priceIds || !info.customData) return;
    paddle.Checkout.open({
      items: [{ priceId: info.priceIds[cycle], quantity: 1 }],
      customData: info.customData,
      customer: info.email ? { email: info.email } : undefined,
      settings: {
        successUrl: `${window.location.origin}/${locale}/checkout/success`,
      },
    });
  }, [paddle, info, cycle, locale]);

  const redeem = useCallback(async () => {
    if (!promoCode.trim() || promoState === "busy") return;
    setPromoState("busy");
    try {
      const res = await fetch("/api/promo/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: promoCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPromoState("error");
        const key = typeof data.error === "string" ? data.error : "invalid";
        setPromoMessage(tRedeem(`error.${key}` as never) ?? tRedeem("error.invalid"));
        return;
      }
      setPromoState("done");
      setPromoMessage(tRedeem("success", { days: data.days ?? 0 }));
      setTimeout(() => window.location.reload(), 1200);
    } catch {
      setPromoState("error");
      setPromoMessage(tRedeem("error.invalid"));
    }
  }, [promoCode, promoState, tRedeem]);

  const cta = useMemo(
    () => (info?.withTrial ? t("ctaTrial") : t("ctaBuy")),
    [info?.withTrial, t],
  );

  if (notConfigured) {
    return (
      <div className="text-center text-text-dim py-16">{t("notConfigured")}</div>
    );
  }

  if (info?.alreadySubscribed) {
    return (
      <div className="text-center space-y-4 py-16">
        <p className="text-lg text-foreground">{t("alreadySubscribed")}</p>
        <Link href="/settings" className="text-primary underline-offset-2 hover:underline">
          {t("goSettings")}
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      {/* 三個價值點 */}
      <ul className="space-y-2 text-sm text-foreground">
        {(["point1", "point2", "point3"] as const).map((k) => (
          <li key={k} className="flex gap-2">
            <span className="text-primary">✓</span>
            <span>{t(k)}</span>
          </li>
        ))}
      </ul>

      {/* 雙價卡 */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setCycle("annual")}
          aria-pressed={cycle === "annual"}
          className={
            cycle === "annual"
              ? "rounded-2xl border-2 border-primary bg-card p-4 text-left"
              : "rounded-2xl border border-border bg-card p-4 text-left opacity-70 hover:opacity-100 transition-opacity"
          }
        >
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-dim">{t("annual")}</span>
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
              {t("savePct", { pct: SAVE_PCT })}
            </span>
          </div>
          <div className="mt-1 text-2xl font-semibold text-foreground">{display.annual}</div>
          <div className="text-xs text-text-dim">
            {t("perMonth", { price: display.annualPerMonth })}
          </div>
        </button>
        <button
          type="button"
          onClick={() => setCycle("monthly")}
          aria-pressed={cycle === "monthly"}
          className={
            cycle === "monthly"
              ? "rounded-2xl border-2 border-primary bg-card p-4 text-left"
              : "rounded-2xl border border-border bg-card p-4 text-left opacity-70 hover:opacity-100 transition-opacity"
          }
        >
          <span className="text-sm text-text-dim">{t("monthly")}</span>
          <div className="mt-1 text-2xl font-semibold text-foreground">{display.monthly}</div>
          <div className="text-xs text-text-dim">{t("perMonth", { price: display.monthly })}</div>
        </button>
      </div>

      {/* CTA */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={openCheckout}
          disabled={!paddle}
          className="w-full rounded-full bg-primary py-3 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {cta}
        </button>
        {info?.withTrial && (
          <p className="text-center text-xs text-text-dim">{t("trialNote")}</p>
        )}
      </div>

      {/* Promo */}
      <div className="text-center">
        {!promoOpen ? (
          <button
            type="button"
            onClick={() => setPromoOpen(true)}
            className="text-sm text-text-dim hover:text-foreground underline-offset-2 hover:underline transition-colors"
          >
            {t("havePromo")}
          </button>
        ) : (
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                placeholder={tRedeem("placeholder")}
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
              <button
                type="button"
                onClick={redeem}
                disabled={promoState === "busy"}
                className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
              >
                {promoState === "busy" ? tRedeem("redeeming") : tRedeem("button")}
              </button>
            </div>
            {promoMessage && (
              <p
                className={
                  promoState === "error" ? "text-xs text-destructive" : "text-xs text-primary"
                }
              >
                {promoMessage}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

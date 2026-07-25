import { getTranslations } from "next-intl/server";
import { Check } from "lucide-react";
import { TrialButton } from "./trial-button";

/**
 * 依語系顯示對應市場的「展示價」（來自 docs 金流策略 §3.3 PPP 表）。
 * 真正結帳的在地化計價由 Paddle 依買家所在國自動處理，這裡只是對照展示，
 * 所以價格寫死在 code、不進 i18n（避免翻譯漂移）。
 * annualPerMo = 年費 ÷ 12；save = 相對月繳一年的省幅。
 */
const PRICE_BY_LOCALE: Record<
  string,
  {
    currency: string;
    annual: string;
    monthly: string;
    annualPerMo: string;
    save: string;
  }
> = {
  en: { currency: "$", annual: "99", monthly: "12.99", annualPerMo: "8.25", save: "37%" },
  ja: { currency: "¥", annual: "14,800", monthly: "1,500", annualPerMo: "1,233", save: "18%" },
  "zh-TW": { currency: "NT$", annual: "1,990", monthly: "249", annualPerMo: "166", save: "33%" },
};

const FEATURE_KEYS = [
  "featureCrossPlatform",
  "featureDaily",
  "featureCalendar",
  "featureCards",
  "featureSync",
] as const;

export async function PricingPlans({ locale }: { locale: string }) {
  const t = await getTranslations("landing.pricing");
  const p = PRICE_BY_LOCALE[locale] ?? PRICE_BY_LOCALE.en;

  return (
    <div>
      {/* 兩區塊價格對照：年繳（主打）vs 月繳 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* 年繳 */}
        <div className="rounded-3xl border border-primary/40 ring-1 ring-primary/20 bg-[var(--surface)] p-7 shadow-[0_24px_60px_-24px_rgba(40,32,18,0.22)]">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-primary">
              {t("annual")}
            </span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
              {t("save", { percent: p.save })}
            </span>
          </div>
          <div className="mt-4 flex items-end gap-1">
            <span className="text-4xl md:text-5xl font-semibold tracking-[-0.02em] text-foreground tabular-nums">
              {p.currency}
              {p.annual}
            </span>
            <span className="mb-1.5 text-base text-muted-foreground">
              {t("perYear")}
            </span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("annualEquiv", { monthly: `${p.currency}${p.annualPerMo}` })}
          </p>
        </div>

        {/* 月繳 */}
        <div className="rounded-3xl border border-border bg-[var(--surface)] p-7">
          <span className="text-sm font-semibold text-foreground">
            {t("monthly")}
          </span>
          <div className="mt-4 flex items-end gap-1">
            <span className="text-4xl md:text-5xl font-semibold tracking-[-0.02em] text-foreground tabular-nums">
              {p.currency}
              {p.monthly}
            </span>
            <span className="mb-1.5 text-base text-muted-foreground">
              {t("perMonth")}
            </span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("monthlyEquiv")}
          </p>
        </div>
      </div>

      {/* 共用 CTA + 在地化計價註解 */}
      <div className="mt-7 flex flex-col items-center">
        <TrialButton className="justify-center" />
        <p className="mt-3 text-center text-xs text-text-faint">
          {t("localizedNote")}
        </p>
      </div>

      {/* 功能清單（兩方案共用） */}
      <div className="mt-9 rounded-3xl border border-border bg-[var(--surface)] p-7">
        <p className="mb-4 text-sm font-medium text-foreground">
          {t("featuresTitle")}
        </p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {FEATURE_KEYS.map((key) => (
            <li
              key={key}
              className="flex items-start gap-3 text-[15px] text-muted-foreground"
            >
              <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <span>{t(key)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Reveal } from "@/components/landing/reveal";
import { PricingPlans } from "@/components/landing/pricing-plans";

export const metadata: Metadata = {
  title: "Nudge 定價",
  description:
    "Nudge 訂閱方案：年費 $99 USD、月費 $12.99 USD，7 天免費試用，到期自動續訂。",
};

export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("landing.pricing");

  return (
    <>
      {/* Hero band：暖色光暈 stage */}
      <section className="landing-stage px-6 pt-36 md:pt-44 pb-28 md:pb-36 text-center">
        <Reveal className="max-w-2xl mx-auto">
          <p className="text-sm font-semibold text-primary mb-4">
            {t("eyebrow")}
          </p>
          <h1 className="text-4xl md:text-6xl font-semibold leading-[1.08] tracking-[-0.02em] mb-5">
            {t("title")}
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
            {t("subtitle")}
          </p>
        </Reveal>
      </section>

      {/* 定價區塊：上移與 stage 重疊浮起 */}
      <section className="flex-1 px-6 -mt-16 md:-mt-24 pb-28">
        <Reveal className="max-w-3xl mx-auto">
          <PricingPlans locale={locale} />
        </Reveal>
      </section>
    </>
  );
}

import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Laptop, Smartphone, ArrowDownToLine } from "lucide-react";
import { DOWNLOAD_LINKS } from "@/lib/landing-links";
import { Reveal } from "@/components/landing/reveal";

export const metadata: Metadata = {
  title: "下載 Nudge",
  description: "下載 Nudge for Mac / iPhone・iPad，免費試用 7 天。",
};

export default async function DownloadPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("landing.downloadPage");

  return (
    <>
      {/* Hero band：暖色光暈 stage，與首頁 hero 呼應 */}
      <section className="landing-stage px-6 pt-36 md:pt-44 pb-28 md:pb-36 text-center">
        <Reveal className="max-w-2xl mx-auto">
          <p className="text-sm font-semibold text-primary mb-4">Nudge</p>
          <h1 className="text-4xl md:text-6xl font-semibold leading-[1.08] tracking-[-0.02em] mb-5">
            {t("title")}
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
            {t("subtitle")}
          </p>
        </Reveal>
      </section>

      {/* 平台卡片：直向堆疊（Mac 主力在上），上移與 stage 重疊浮起 */}
      <section className="flex-1 px-6 -mt-16 md:-mt-24 pb-28">
        <div className="flex flex-col gap-5 max-w-2xl mx-auto">
          <Reveal>
            <PlatformCard
              icon={<Laptop className="h-8 w-8" />}
              name={t("mac.name")}
              desc={t("mac.desc")}
              requirement={t("mac.requirement")}
              cta={t("mac.cta")}
              href={DOWNLOAD_LINKS.mac}
              featured
            />
          </Reveal>
          <Reveal delay={0.08}>
            <PlatformCard
              icon={<Smartphone className="h-8 w-8" />}
              name={t("ios.name")}
              desc={t("ios.desc")}
              requirement={t("ios.requirement")}
              cta={t("ios.cta")}
              href={DOWNLOAD_LINKS.ios}
            />
          </Reveal>
        </div>
      </section>
    </>
  );
}

function PlatformCard({
  icon,
  name,
  desc,
  requirement,
  cta,
  href,
  featured = false,
}: {
  icon: React.ReactNode;
  name: string;
  desc: string;
  requirement: string;
  cta: string;
  href: string;
  featured?: boolean;
}) {
  return (
    <div
      className={`flex h-full flex-col rounded-3xl border p-8 md:p-9 bg-[var(--surface)] shadow-[0_24px_60px_-24px_rgba(40,32,18,0.22)] transition-transform duration-300 hover:-translate-y-1 ${
        featured ? "border-primary/40 ring-1 ring-primary/20" : "border-border"
      }`}
    >
      <div
        className={`inline-flex items-center justify-center h-16 w-16 rounded-2xl mb-6 ${
          featured
            ? "bg-primary text-primary-foreground"
            : "bg-primary/10 text-primary"
        }`}
      >
        {icon}
      </div>
      <h2 className="text-2xl font-semibold tracking-[-0.01em] mb-2">{name}</h2>
      <p className="text-[15px] text-muted-foreground leading-relaxed mb-7 flex-1">
        {desc}
      </p>
      <a
        href={href}
        className={`inline-flex items-center justify-center gap-2 rounded-full font-medium px-6 py-3.5 text-base transition-transform hover:scale-[1.02] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
          featured
            ? "bg-primary text-primary-foreground"
            : "text-primary ring-1 ring-primary/30 hover:bg-primary/5"
        }`}
      >
        <ArrowDownToLine className="h-4 w-4" />
        {cta}
      </a>
      <p className="mt-3 text-xs text-text-faint text-center">{requirement}</p>
    </div>
  );
}

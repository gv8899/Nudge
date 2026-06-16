import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Laptop, Smartphone } from "lucide-react";
import { Link } from "@/i18n/routing";
import { DOWNLOAD_LINKS } from "@/lib/landing-links";

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
    <main className="mx-auto max-w-4xl px-6 md:px-8 pt-28 pb-32 text-foreground">
      <div className="text-center mb-14">
        <Link
          href="/"
          className="inline-block text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          {t("back")}
        </Link>
        <h1 className="text-4xl md:text-5xl font-semibold tracking-[-0.02em] mb-4">
          {t("title")}
        </h1>
        <p className="text-lg text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Mac — 主力 */}
        <PlatformCard
          icon={<Laptop className="h-7 w-7" />}
          name={t("mac.name")}
          desc={t("mac.desc")}
          requirement={t("mac.requirement")}
          cta={t("mac.cta")}
          href={DOWNLOAD_LINKS.mac}
          featured
        />
        {/* iOS — 補充 */}
        <PlatformCard
          icon={<Smartphone className="h-7 w-7" />}
          name={t("ios.name")}
          desc={t("ios.desc")}
          requirement={t("ios.requirement")}
          cta={t("ios.cta")}
          href={DOWNLOAD_LINKS.ios}
        />
      </div>
    </main>
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
      className={`flex flex-col rounded-2xl border p-8 bg-[var(--surface)] ${
        featured ? "border-primary/40 ring-1 ring-primary/20" : "border-border"
      }`}
    >
      <div
        className={`inline-flex items-center justify-center h-14 w-14 rounded-2xl mb-5 ${
          featured
            ? "bg-primary text-primary-foreground"
            : "bg-primary/10 text-primary"
        }`}
      >
        {icon}
      </div>
      <h2 className="text-xl font-semibold mb-2">{name}</h2>
      <p className="text-sm text-muted-foreground leading-relaxed mb-6 flex-1">
        {desc}
      </p>
      <a
        href={href}
        className={`inline-flex items-center justify-center rounded-full font-medium px-6 py-3 text-base transition-transform hover:scale-[1.03] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
          featured
            ? "bg-primary text-primary-foreground"
            : "text-primary ring-1 ring-primary/30 hover:bg-primary/5"
        }`}
      >
        {cta}
      </a>
      <p className="mt-3 text-xs text-text-faint text-center">{requirement}</p>
    </div>
  );
}

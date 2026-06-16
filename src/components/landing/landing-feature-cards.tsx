import { getTranslations } from "next-intl/server";
import { Reveal } from "./reveal";
import { MockupCards } from "./mockup-cards";
import { MockupCardDetail } from "./mockup-card-detail";

export async function LandingFeatureCards() {
  const t = await getTranslations("landing.cards");
  return (
    <section className="px-6 md:px-12 py-28 md:py-36 border-t border-border">
      <div className="max-w-5xl mx-auto">
        <Reveal className="text-center mb-16">
          <p className="text-sm font-semibold text-primary mb-4">
            {t("eyebrow")}
          </p>
          <h2 className="text-4xl md:text-6xl font-semibold leading-[1.08] tracking-[-0.02em] text-foreground mb-5 whitespace-pre-line">
            {t("title")}
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground max-w-[640px] mx-auto leading-relaxed whitespace-pre-line">
            {t("subtitle")}
          </p>
        </Reveal>
        <Reveal className="max-w-[720px] mx-auto mb-10">
          <MockupCards />
        </Reveal>
        <Reveal delay={0.1} className="max-w-[720px] mx-auto">
          <MockupCardDetail />
        </Reveal>
      </div>
    </section>
  );
}

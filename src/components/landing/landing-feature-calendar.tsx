import { getTranslations } from "next-intl/server";
import { Reveal } from "./reveal";
import { MockupCalendar } from "./mockup-calendar";

export async function LandingFeatureCalendar() {
  const t = await getTranslations("landing.calendar");
  return (
    <section className="px-6 md:px-12 py-28 md:py-36 border-t border-border">
      <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-14 items-center">
        <Reveal className="md:order-2">
          <p className="text-sm font-semibold text-primary mb-4">
            {t("eyebrow")}
          </p>
          <h2 className="text-4xl md:text-5xl font-semibold leading-[1.08] tracking-[-0.02em] text-foreground mb-5 whitespace-pre-line">
            {t("title")}
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            {t("subtitle")}
          </p>
        </Reveal>
        <Reveal delay={0.1} className="md:order-1">
          <MockupCalendar />
        </Reveal>
      </div>
    </section>
  );
}

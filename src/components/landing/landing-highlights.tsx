import { getTranslations } from "next-intl/server";
import { Reveal } from "./reveal";

const ITEMS = ["search", "offline", "markdown", "week"] as const;

export async function LandingHighlights() {
  const t = await getTranslations("landing.highlights");
  return (
    <section
      id="features"
      className="px-6 md:px-12 py-28 md:py-36 border-t border-border"
    >
      <div className="max-w-5xl mx-auto">
        <Reveal className="text-center mb-14">
          <h2 className="text-4xl md:text-5xl font-semibold tracking-[-0.02em] text-foreground">
            {t("title")}
          </h2>
        </Reveal>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {ITEMS.map((key, i) => (
            <Reveal key={key} delay={i * 0.06}>
              <div className="h-full rounded-2xl bg-[var(--surface)] border border-border p-6">
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {t(`items.${key}.title`)}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {t(`items.${key}.desc`)}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

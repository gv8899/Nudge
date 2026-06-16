import { getTranslations } from "next-intl/server";
import { Reveal } from "./reveal";

export async function LandingPhilosophy() {
  const t = await getTranslations("landing");
  return (
    <section
      id="philosophy"
      className="px-6 md:px-12 py-32 md:py-44 text-center bg-[var(--ink)]"
    >
      <Reveal>
        <blockquote className="text-3xl md:text-5xl font-semibold leading-[1.25] tracking-[-0.01em] max-w-[760px] mx-auto text-[var(--ink-foreground)] whitespace-pre-line">
          {t("philosophy.quote")}
        </blockquote>
        <div className="mt-8 text-sm text-[var(--ink-foreground)]/55">
          {t("philosophy.attribution")}
        </div>
      </Reveal>
    </section>
  );
}

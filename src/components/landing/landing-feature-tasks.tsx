import { getTranslations } from "next-intl/server";
import { Reveal } from "./reveal";
import { MockupTasks } from "./mockup-tasks";
import { MiniContinue, MiniReschedule, MiniStatuses } from "./mini-mockups";

export async function LandingFeatureTasks() {
  const t = await getTranslations("landing.tasks");
  const points = [
    { key: "continue", node: <MiniContinue /> },
    { key: "reschedule", node: <MiniReschedule /> },
    { key: "status", node: <MiniStatuses /> },
  ] as const;
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
          <p className="text-lg md:text-xl text-muted-foreground max-w-[600px] mx-auto leading-relaxed">
            {t("subtitle")}
          </p>
        </Reveal>

        <Reveal className="max-w-[720px] mx-auto mb-20">
          <MockupTasks />
        </Reveal>

        <div className="grid md:grid-cols-3 gap-10 md:gap-8 max-w-[1000px] mx-auto">
          {points.map((p, i) => (
            <Reveal key={p.key} delay={i * 0.08}>
              <div className="mb-5">{p.node}</div>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                {t(`points.${p.key}.title`)}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {t(`points.${p.key}.desc`)}
              </p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

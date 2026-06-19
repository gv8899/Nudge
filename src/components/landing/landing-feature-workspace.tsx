import { getTranslations } from "next-intl/server";
import { CheckSquare, CalendarDays, StickyNote } from "lucide-react";
import { Reveal } from "./reveal";
import { WorkspaceCarousel } from "./workspace-carousel";

/**
 * Mac 核心賣點：行動頁一個視窗同時做三件事（追蹤任務 / 看行事曆 / 寫卡片）。
 * 緊接 hero 截圖之後，用三欄對應上方視窗的左/右，不重複放大圖。
 */
export async function LandingFeatureWorkspace() {
  const t = await getTranslations("landing.workspace");
  const points = [
    { key: "tasks", icon: CheckSquare },
    { key: "calendar", icon: CalendarDays },
    { key: "cards", icon: StickyNote },
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
          <p className="text-lg md:text-xl text-muted-foreground max-w-[640px] mx-auto leading-relaxed">
            {t("subtitle")}
          </p>
        </Reveal>

        <Reveal className="mb-16">
          <WorkspaceCarousel />
        </Reveal>

        <div className="grid md:grid-cols-3 gap-10 md:gap-8 max-w-[1000px] mx-auto">
          {points.map((p, i) => {
            const Icon = p.icon;
            return (
              <Reveal key={p.key} delay={i * 0.08}>
                <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-primary/10 text-primary mb-5">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  {t(`points.${p.key}.title`)}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {t(`points.${p.key}.desc`)}
                </p>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

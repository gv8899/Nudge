import { getTranslations } from "next-intl/server";
import { Reveal } from "./reveal";

export async function LandingPlatforms() {
  const t = await getTranslations("landing.platforms");
  return (
    <section className="px-6 md:px-12 py-28 md:py-36 border-t border-border bg-[var(--surface-alt)]">
      <div className="max-w-5xl mx-auto text-center">
        <Reveal>
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
        <Reveal delay={0.1} className="mt-16 flex items-end justify-center gap-6">
          {/* 圖片槽：之後可換真實 Mac 截圖 */}
          <div className="w-full max-w-[520px] aspect-[16/10] rounded-2xl bg-[var(--surface)] border border-border shadow-[0_24px_60px_-24px_rgba(28,27,24,0.22)] flex items-center justify-center text-muted-foreground text-sm">
            Mac
          </div>
          <div className="w-[120px] md:w-[150px] aspect-[9/19] rounded-[1.6rem] bg-[var(--surface)] border border-border shadow-[0_24px_60px_-24px_rgba(28,27,24,0.22)] flex items-center justify-center text-muted-foreground text-sm shrink-0">
            iPhone
          </div>
          {/* 今日清單 widget */}
          <div
            className="hidden sm:block w-[150px] rounded-2xl bg-[var(--surface)] border border-border shadow-[0_24px_60px_-24px_rgba(28,27,24,0.22)] p-4 text-left shrink-0"
            aria-hidden="true"
          >
            <div className="text-[11px] font-semibold text-primary mb-2">
              今天 · 3
            </div>
            <div className="space-y-2">
              {["寫週報", "準備簡報", "回覆 Email"].map((label) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-[3px] border-2 border-text-dim shrink-0" />
                  <span className="text-[11px] text-foreground truncate">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

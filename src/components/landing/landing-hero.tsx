import { getTranslations } from "next-intl/server";
import { DownloadButtons } from "./download-buttons";
import { Reveal } from "./reveal";
import { MockupTasks } from "./mockup-tasks";

export async function LandingHero() {
  const t = await getTranslations("landing");
  return (
    <section
      id="top"
      className="mx-auto max-w-5xl px-6 md:px-8 pt-32 pb-24 text-center"
    >
      <Reveal>
        <p className="text-sm font-semibold text-primary mb-4">Nudge</p>
        <h1 className="text-5xl md:text-7xl font-semibold leading-[1.05] tracking-[-0.02em] text-foreground mb-6 whitespace-pre-line">
          {t("hero.title")}
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-[560px] mx-auto leading-relaxed mb-9">
          {t("hero.subtitle")}
        </p>
        <DownloadButtons className="justify-center" />
        <p className="mt-4 text-xs text-muted-foreground">
          {t("hero.platformNote")}
        </p>
      </Reveal>

      <Reveal delay={0.1} className="mt-16">
        {/* Mac 視窗外框包住任務 mockup（圖片槽：之後可換真實 Mac 截圖） */}
        <div className="mx-auto max-w-[860px] rounded-2xl bg-[var(--surface)] border border-border shadow-[0_30px_80px_-24px_rgba(28,27,24,0.28)] overflow-hidden">
          <div className="flex items-center gap-2 px-4 h-9 border-b border-border">
            <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
            <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
            <span className="w-3 h-3 rounded-full bg-[#28c840]" />
          </div>
          <div className="p-6 md:p-8">
            <MockupTasks />
          </div>
        </div>
      </Reveal>
    </section>
  );
}

import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { TrialButton } from "./trial-button";
import { Reveal } from "./reveal";

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
        <TrialButton className="justify-center" />
        <p className="mt-4 text-xs text-muted-foreground">
          {t("hero.platformNote")}
        </p>
      </Reveal>

      <Reveal delay={0.1} className="mt-16">
        {/* 桌布 stage：真實 Mac 截圖浮在暖色光暈漸層上（Heptabase 風） */}
        <div className="landing-stage mx-auto max-w-[1120px] rounded-[28px] p-5 sm:p-10 md:p-16">
          <Image
            src="/landing/hero-mac.png"
            alt="Nudge for Mac — 一個畫面同時安排任務、行事曆與知識卡片"
            width={2200}
            height={1225}
            priority
            sizes="(max-width: 1120px) 100vw, 1120px"
            className="landing-window w-full h-auto"
          />
        </div>
      </Reveal>
    </section>
  );
}

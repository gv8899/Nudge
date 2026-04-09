import { SignInForm } from "./sign-in-form";
import { HandDrawnCircle, HandDrawnArrow } from "./landing-doodles";

interface LandingHeroProps {
  signInAction: () => Promise<void>;
}

export function LandingHero({ signInAction }: LandingHeroProps) {
  return (
    <section className="mx-auto max-w-6xl px-6 md:px-12 pt-40 pb-32">
      <h1 className="text-5xl md:text-7xl lg:text-[84px] font-black leading-[0.95] tracking-[-0.04em] max-w-[800px] mb-9">
        每天，
        <span className="relative inline-block">
          <span className="relative z-10 text-primary">輕鬆</span>
          <HandDrawnCircle
            className="landing-draw-in absolute left-[-8%] right-[-8%] top-[-10%] bottom-[-10%] w-[116%] h-[120%] text-primary/55 pointer-events-none"
          />
        </span>
        推進一點
      </h1>
      <p className="text-lg md:text-xl text-text-dim max-w-[560px] leading-relaxed mb-10">
        讓任務和日常，在不打擾的節奏裡前進
      </p>
      <div className="relative inline-block">
        <SignInForm action={signInAction} variant="outline" />
        {/* 手繪箭頭指向 CTA 按鈕 */}
        <HandDrawnArrow
          className="landing-float absolute left-full top-1/2 -translate-y-1/2 ml-3 w-16 h-8 text-primary hidden md:block"
        />
      </div>
    </section>
  );
}

import { SignInForm } from "./sign-in-form";

interface LandingHeroProps {
  signInAction: () => Promise<void>;
}

export function LandingHero({ signInAction }: LandingHeroProps) {
  return (
    <section className="mx-auto max-w-6xl px-6 md:px-12 pt-40 pb-32">
      <div className="text-xs font-bold tracking-[0.25em] uppercase text-primary mb-7">
        NUDGE
      </div>
      <h1 className="text-5xl md:text-7xl lg:text-[84px] font-black leading-[0.95] tracking-[-0.04em] max-w-[800px] mb-9">
        每天，<span className="text-primary">輕鬆</span>推進一點
      </h1>
      <p className="text-lg md:text-xl text-text-dim max-w-[560px] leading-relaxed mb-10">
        讓任務和日常，在不打擾的節奏裡前進
      </p>
      <SignInForm action={signInAction} variant="outline" />
    </section>
  );
}

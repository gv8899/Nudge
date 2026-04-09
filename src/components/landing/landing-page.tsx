import { LandingNav } from "./landing-nav";
import { LandingHero } from "./landing-hero";
import { LandingFeatures } from "./landing-features";
import { LandingPhilosophy } from "./landing-philosophy";
import { LandingFooterCta } from "./landing-footer-cta";

interface LandingPageProps {
  signInAction: () => Promise<void>;
}

export function LandingPage({ signInAction }: LandingPageProps) {
  return (
    <div
      data-landing
      className="dark min-h-screen bg-background text-foreground"
    >
      <LandingNav />
      <LandingHero signInAction={signInAction} />
      <LandingFeatures />
      <LandingPhilosophy />
      <LandingFooterCta signInAction={signInAction} />
    </div>
  );
}

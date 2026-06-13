import { LandingNav } from "./landing-nav";
import { LandingHero } from "./landing-hero";
import { LandingPhilosophy } from "./landing-philosophy";
import { LandingFeatureTasks } from "./landing-feature-tasks";
import { LandingFeatureNotes } from "./landing-feature-notes";
import { LandingFeatureCards } from "./landing-feature-cards";
import { LandingPlatforms } from "./landing-platforms";
import { LandingHighlights } from "./landing-highlights";
import { LandingFooterCta } from "./landing-footer-cta";

export function LandingPage() {
  return (
    <div data-landing className="min-h-screen bg-background text-foreground">
      <LandingNav />
      <LandingHero />
      <LandingPhilosophy />
      <LandingFeatureTasks />
      <LandingFeatureNotes />
      <LandingFeatureCards />
      <LandingPlatforms />
      <LandingHighlights />
      <LandingFooterCta />
    </div>
  );
}

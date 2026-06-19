import { LandingNav } from "./landing-nav";
import { LandingHero } from "./landing-hero";
import { LandingFeatureWorkspace } from "./landing-feature-workspace";
import { LandingPhilosophy } from "./landing-philosophy";
import { LandingFeatureTasks } from "./landing-feature-tasks";
import { LandingFeatureCards } from "./landing-feature-cards";
import { LandingFeatureCalendar } from "./landing-feature-calendar";
import { LandingFeatureNotes } from "./landing-feature-notes";
import { LandingPlatforms } from "./landing-platforms";
import { LandingHighlights } from "./landing-highlights";
import { LandingFooterCta } from "./landing-footer-cta";

export function LandingPage() {
  return (
    <div data-landing className="min-h-screen bg-background text-foreground">
      <LandingNav />
      <LandingHero />
      <LandingFeatureWorkspace />
      <LandingPhilosophy />
      <LandingFeatureTasks />
      <LandingFeatureCards />
      <LandingFeatureCalendar />
      <LandingFeatureNotes />
      <LandingPlatforms />
      <LandingHighlights />
      <LandingFooterCta />
    </div>
  );
}

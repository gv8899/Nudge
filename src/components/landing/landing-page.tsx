"use client";

import { LandingNav } from "./landing-nav";
import { LandingHero } from "./landing-hero";

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
      <main>
        <LandingHero signInAction={signInAction} />
      </main>
    </div>
  );
}

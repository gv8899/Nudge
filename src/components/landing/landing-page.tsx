"use client";

interface LandingPageProps {
  signInAction: () => Promise<void>;
}

export function LandingPage({ signInAction }: LandingPageProps) {
  return (
    <div
      data-landing
      className="dark min-h-screen bg-background text-foreground"
    >
      <div className="p-8">Landing Page — 骨架建置中</div>
    </div>
  );
}

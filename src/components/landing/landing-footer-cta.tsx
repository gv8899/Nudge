import { SignInForm } from "./sign-in-form";

interface LandingFooterCtaProps {
  signInAction: () => Promise<void>;
}

export function LandingFooterCta({ signInAction }: LandingFooterCtaProps) {
  return (
    <section
      className="relative py-32 md:py-40 px-6 md:px-12 border-t border-border bg-gradient-to-b from-background to-black"
    >
      <div className="max-w-4xl mx-auto text-center">
        <div className="text-xs font-bold tracking-[0.25em] text-primary mb-6">
          Nudge
        </div>
        <h2 className="text-5xl md:text-6xl font-black leading-[1.05] tracking-[-0.03em] mb-10 text-foreground">
          從今天
          <br />
          開始輕鬆推進
        </h2>
        <SignInForm action={signInAction} variant="solid" />
      </div>

      <footer className="max-w-4xl mx-auto mt-24 pt-8 border-t border-foreground/10 text-xs text-text-dim text-center flex items-center justify-center gap-4">
        <span>© 2026 Nudge</span>
        <span className="text-foreground/20" aria-hidden="true">·</span>
        <a href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</a>
        <span className="text-foreground/20" aria-hidden="true">·</span>
        <a href="/terms" className="hover:text-foreground transition-colors">Terms of Service</a>
      </footer>
    </section>
  );
}

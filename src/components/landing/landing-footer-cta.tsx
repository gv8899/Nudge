import { SignInForm } from "./sign-in-form";

interface LandingFooterCtaProps {
  signInAction: () => Promise<void>;
}

export function LandingFooterCta({ signInAction }: LandingFooterCtaProps) {
  return (
    <section
      className="relative py-32 md:py-40 px-6 md:px-12 border-t border-border"
      style={{
        background:
          "linear-gradient(180deg, #1c1b18 0%, #0d0d0b 100%)",
      }}
    >
      <div className="max-w-4xl mx-auto text-center">
        <div className="text-xs font-bold tracking-[0.25em] uppercase text-primary mb-6">
          NUDGE
        </div>
        <h2 className="text-5xl md:text-6xl font-black leading-[1.05] tracking-[-0.03em] mb-10 text-foreground">
          你的日子
          <br />
          值得更安靜的工具
        </h2>
        <SignInForm action={signInAction} variant="solid" />
      </div>

      <footer className="max-w-4xl mx-auto mt-24 pt-8 border-t border-foreground/10 flex justify-between text-xs text-text-dim">
        <span>© 2026 Nudge · 個人作品</span>
        <a
          href="https://github.com/gv8899/Nudge"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-foreground transition-colors"
        >
          GitHub
        </a>
      </footer>
    </section>
  );
}

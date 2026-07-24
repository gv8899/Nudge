import { Link } from "@/i18n/routing";
import { getTranslations } from "next-intl/server";
import { Reveal } from "./reveal";
import { TrialButton } from "./trial-button";

export async function LandingFooterCta() {
  const t = await getTranslations("landing");
  return (
    <section className="px-6 md:px-12 py-32 md:py-44 border-t border-border bg-[var(--surface-alt)]">
      <Reveal className="max-w-3xl mx-auto text-center">
        <p className="text-sm font-semibold text-primary mb-4">Nudge</p>
        <h2 className="text-4xl md:text-6xl font-semibold leading-[1.1] tracking-[-0.02em] text-foreground mb-9 whitespace-pre-line">
          {t("finalCta.title")}
        </h2>
        <TrialButton className="justify-center" />
        <p className="mt-4 text-xs text-muted-foreground">
          {t("hero.platformNote")}
        </p>
      </Reveal>

      <footer className="max-w-3xl mx-auto mt-24 pt-8 border-t border-border text-xs text-muted-foreground text-center flex items-center justify-center gap-4">
        <span>© 2026 Nudge</span>
        <span aria-hidden="true">·</span>
        <Link
          href="/privacy"
          className="hover:text-foreground transition-colors"
        >
          {t("footer.privacy")}
        </Link>
        <span aria-hidden="true">·</span>
        <Link href="/terms" className="hover:text-foreground transition-colors">
          {t("footer.terms")}
        </Link>
        <span aria-hidden="true">·</span>
        <Link
          href="/refund"
          className="hover:text-foreground transition-colors"
        >
          {t("footer.refund")}
        </Link>
      </footer>
    </section>
  );
}

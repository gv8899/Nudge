import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";

/**
 * 全局 footer（(marketing) group 共用）：© + 政策連結（帶 locale）。
 * mt-auto → 在 flex-col layout 中黏到底部（短內容頁也貼底）。
 */
export async function LandingFooter() {
  const tf = await getTranslations("landing.footer");
  return (
    <footer className="mt-auto border-t border-border px-6 py-10 text-xs text-muted-foreground flex items-center justify-center gap-4">
      <span>© 2026 Nudge</span>
      <span aria-hidden="true">·</span>
      <Link href="/privacy" className="hover:text-foreground transition-colors">
        {tf("privacy")}
      </Link>
      <span aria-hidden="true">·</span>
      <Link href="/terms" className="hover:text-foreground transition-colors">
        {tf("terms")}
      </Link>
      <span aria-hidden="true">·</span>
      <Link href="/refund" className="hover:text-foreground transition-colors">
        {tf("refund")}
      </Link>
    </footer>
  );
}

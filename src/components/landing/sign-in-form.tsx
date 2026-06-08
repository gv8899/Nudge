interface SignInFormProps {
  /** 保留以相容既有呼叫端（landing hero / footer-cta 仍傳入），但 web
   *  登入已停用、不再使用。 */
  action?: () => Promise<void>;
  /** outline | solid */
  variant?: "outline" | "solid";
  className?: string;
}

// Web 登入已停用 — Nudge 改為 iOS / macOS App 專用。
// 原本是 Google 登入按鈕；現在改顯示「App 專用」說明，landing 的兩個
// CTA（hero outline / footer-cta solid）一起停用。保留元件與 props 介面，
// 之後若要恢復 web 登入只要還原這個檔。
export function SignInForm({
  variant = "outline",
  className = "",
}: SignInFormProps) {
  const sizing =
    variant === "solid" ? "px-8 py-4 text-base" : "px-7 py-3.5 text-sm";
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-xl border border-foreground/20 font-semibold text-text-dim ${sizing} ${className}`}
    >
      目前僅在 iOS · macOS App 提供
    </span>
  );
}

import { ArrowRight } from "lucide-react";

interface SignInFormProps {
  action: () => Promise<void>;
  /** outline | solid */
  variant?: "outline" | "solid";
  className?: string;
}

export function SignInForm({
  action,
  variant = "outline",
  className = "",
}: SignInFormProps) {
  const base =
    "inline-flex items-center gap-2 text-sm font-semibold transition-colors rounded-xl";
  const sizing = variant === "solid" ? "px-8 py-4" : "px-7 py-3.5";
  const colors =
    variant === "solid"
      ? "bg-primary text-primary-foreground hover:opacity-90"
      : "border border-foreground text-foreground hover:bg-foreground/5";

  return (
    <form action={action}>
      <button
        type="submit"
        className={`${base} ${sizing} ${colors} ${className}`}
      >
        使用 Google 帳號登入
        <ArrowRight className="h-4 w-4" />
      </button>
    </form>
  );
}

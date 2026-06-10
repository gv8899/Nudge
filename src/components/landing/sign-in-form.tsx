"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";

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
  return (
    <form action={action}>
      <SubmitButton variant={variant} className={className} />
    </form>
  );
}

function SubmitButton({
  variant,
  className,
}: {
  variant: "outline" | "solid";
  className: string;
}) {
  const { pending } = useFormStatus();

  const base =
    "group inline-flex items-center gap-2 text-sm font-semibold rounded-xl transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60 disabled:cursor-wait";
  const sizing = variant === "solid" ? "px-8 py-4" : "px-7 py-3.5";
  const colors =
    variant === "solid"
      ? "bg-primary text-primary-foreground hover:opacity-90 active:opacity-80"
      : "border border-foreground text-foreground hover:bg-foreground/5 active:bg-foreground/10";

  return (
    <button
      type="submit"
      disabled={pending}
      className={`${base} ${sizing} ${colors} ${className}`}
    >
      {pending ? (
        <>
          登入中
          <Loader2 className="h-4 w-4 animate-spin" />
        </>
      ) : (
        <>
          使用 Google 帳號登入
          <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
        </>
      )}
    </button>
  );
}

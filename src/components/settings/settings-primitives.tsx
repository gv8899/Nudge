"use client";

import type { ComponentType, ReactNode } from "react";
import { Loader2 } from "lucide-react";

/**
 * Shared card/row primitives for the Settings page — mirrors Mac's
 * SettingsGroup/SettingsRow/SettingsActionRow (SettingsView.swift:536-636):
 * header (icon + uppercase caption) sits ABOVE an elevated 4%-tint card,
 * rows inside are minHeight 44 with dividers between them.
 */

export function SettingsGroup({
  icon: Icon,
  title,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-1.5 px-1 text-chip-label uppercase tracking-wide text-text-faint">
        <Icon className="h-3.5 w-3.5" aria-hidden />
        <span>{title}</span>
      </div>
      <div className="divide-y divide-border/60 overflow-hidden rounded-xl bg-foreground/[0.04]">
        {children}
      </div>
    </section>
  );
}

export function SettingsRow({
  children,
  trailing,
}: {
  children: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 px-4 py-2">
      <div className="min-w-0 flex-1 text-row-title text-foreground">{children}</div>
      {trailing !== undefined && <div className="shrink-0 text-row-title">{trailing}</div>}
    </div>
  );
}

export function SettingsActionRow({
  children,
  onClick,
  role = "destructive",
  disabled = false,
  loading = false,
}: {
  children: ReactNode;
  onClick: () => void;
  role?: "primary" | "destructive";
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={`flex min-h-11 w-full items-center justify-between gap-3 px-4 py-2 text-left text-row-title transition-colors disabled:cursor-default disabled:opacity-50 ${
        role === "destructive"
          ? "text-destructive hover:bg-destructive/10"
          : /* Mac SettingsActionRow 非破壞性 role 用 nudgeForeground、無品牌 tint */
            "text-foreground hover:bg-surface-hover"
      }`}
    >
      <span>{children}</span>
      {loading && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />}
    </button>
  );
}

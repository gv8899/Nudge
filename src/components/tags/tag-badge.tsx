"use client";

import { useTranslations } from "next-intl";

interface TagBadgeProps {
  name: string;
  /** Retained for API compatibility — server may still return it —
   *  but no longer rendered. 5 hues don't scale past ~15 tags, so we
   *  dropped colour in favour of a single outline style. */
  color?: string;
  onRemove?: () => void;
}

export function TagBadge({ name, onRemove }: TagBadgeProps) {
  const t = useTranslations("tags");
  return (
    <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded border border-border text-foreground">
      {name}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
          className="text-text-dim hover:text-foreground transition-colors leading-none"
          aria-label={t("removeAria", { name })}
        >
          ×
        </button>
      )}
    </span>
  );
}

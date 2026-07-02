"use client";

import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { format, parseISO } from "date-fns";
import { stripHtml } from "@/lib/strip-html";
import type { CardItem } from "@/hooks/use-cards-feed";

interface CardGridItemProps {
  card: CardItem;
  selected?: boolean;
  onOpenInline?: (id: string) => void;
}

export function CardGridItem({ card, selected = false, onOpenInline }: CardGridItemProps) {
  const t = useTranslations("cards");
  const preview = stripHtml(card.description, 240);
  const updated = format(parseISO(card.updatedAt), "M/d");

  const sharedClassName = `flex flex-col gap-2 p-4 rounded-lg border border-border bg-card hover:bg-surface-hover transition-colors h-full${selected ? " bg-selected-fill ring-1 ring-selected-stroke" : ""}`;

  if (onOpenInline) {
    return (
      <button
        type="button"
        onClick={() => onOpenInline(card.id)}
        className={`${sharedClassName} text-left w-full`}
      >
        <h3 className="text-sm font-semibold line-clamp-2">
          {card.title ? (
            <span className="text-foreground">{card.title}</span>
          ) : (
            <span className="italic text-text-dim">{t("untitled")}</span>
          )}
        </h3>
        <p className="text-xs text-text-dim line-clamp-5 flex-1">{preview}</p>
        <div className="flex items-center justify-end gap-2 pt-2">
          <span className="text-xs text-text-dim tabular-nums">{updated}</span>
        </div>
      </button>
    );
  }

  return (
    <Link
      href={`/cards/${card.id}`}
      className={sharedClassName}
    >
      <h3 className="text-sm font-semibold line-clamp-2">
        {card.title ? (
          <span className="text-foreground">{card.title}</span>
        ) : (
          <span className="italic text-text-dim">{t("untitled")}</span>
        )}
      </h3>
      <p className="text-xs text-text-dim line-clamp-5 flex-1">{preview}</p>
      <div className="flex items-center justify-end gap-2 pt-2">
        <span className="text-xs text-text-dim tabular-nums">{updated}</span>
      </div>
    </Link>
  );
}

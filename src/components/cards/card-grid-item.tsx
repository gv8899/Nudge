"use client";

import { Link } from "@/i18n/routing";
import { format, parseISO } from "date-fns";
import { stripHtml } from "@/lib/strip-html";
import { TagBadge } from "@/components/tags/tag-badge";
import type { CardItem } from "@/hooks/use-cards-feed";

interface CardGridItemProps {
  card: CardItem;
}

export function CardGridItem({ card }: CardGridItemProps) {
  const preview = stripHtml(card.description, 120);
  const updated = format(parseISO(card.updatedAt), "M/d");

  return (
    <Link
      href={`/cards/${card.id}`}
      className="flex flex-col gap-2 p-4 rounded-lg border border-border bg-card hover:border-border-light transition-colors h-full"
    >
      <h3 className="text-sm font-semibold text-foreground line-clamp-2">
        {card.title}
      </h3>
      <p className="text-xs text-text-dim line-clamp-4 flex-1">{preview}</p>
      {card.tags?.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          {card.tags.map((t) => (
            <TagBadge key={t.id} name={t.name} color={t.color} />
          ))}
        </div>
      )}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
        <span className="text-xs text-text-dim tabular-nums">{updated}</span>
      </div>
    </Link>
  );
}

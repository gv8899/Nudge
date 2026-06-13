"use client";

import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { format, parseISO } from "date-fns";
import { stripHtml } from "@/lib/strip-html";
import type { CardItem } from "@/hooks/use-cards-feed";

interface CardListItemProps {
  card: CardItem;
}

export function CardListItem({ card }: CardListItemProps) {
  const t = useTranslations("cards");
  const preview = stripHtml(card.description, 150);
  const updated = format(parseISO(card.updatedAt), "M/d");

  return (
    <Link
      href={`/cards/${card.id}`}
      className="block py-4 px-3 -mx-3 hover:bg-muted/50 transition-colors group"
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold truncate">
            {card.title ? (
              <span className="text-foreground">{card.title}</span>
            ) : (
              <span className="italic text-text-dim">{t("untitled")}</span>
            )}
          </h3>
          <p className="mt-1 text-xs text-text-dim line-clamp-2">{preview}</p>
        </div>
        <span className="text-xs text-text-dim tabular-nums shrink-0">
          {updated}
        </span>
      </div>
    </Link>
  );
}

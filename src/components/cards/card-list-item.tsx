"use client";

import Link from "next/link";
import { format, parseISO } from "date-fns";
import { stripHtml } from "@/lib/strip-html";
import { TASK_STATUSES, type TaskStatus } from "@/lib/constants";
import type { CardItem } from "@/hooks/use-cards-feed";

interface CardListItemProps {
  card: CardItem;
}

export function CardListItem({ card }: CardListItemProps) {
  const preview = stripHtml(card.description, 150);
  const status = TASK_STATUSES[card.status as TaskStatus];
  const updated = format(parseISO(card.updatedAt), "M/d");

  return (
    <Link
      href={`/cards/${card.id}`}
      className="block py-4 px-2 -mx-2 rounded-lg hover:bg-muted transition-colors group"
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground truncate">
            {card.title}
          </h3>
          <p className="mt-1 text-xs text-text-dim line-clamp-2">{preview}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className="text-xs text-text-dim tabular-nums">{updated}</span>
          <span
            className="text-[10px] px-1.5 py-0.5 rounded border"
            style={{
              color: status.color,
              borderColor: status.color,
              backgroundColor: status.bgColor,
            }}
          >
            {status.label}
          </span>
        </div>
      </div>
    </Link>
  );
}

"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useTags } from "@/hooks/use-tags";
import { TagBadge } from "@/components/tags/tag-badge";
import { stripHtml } from "@/lib/strip-html";
import type { CardItem } from "@/hooks/use-cards-feed";

interface CardsKanbanProps {
  cards: CardItem[];
  onMutate: () => void;
}

export function CardsKanban({ cards, onMutate }: CardsKanbanProps) {
  const t = useTranslations("cards");
  const { tags } = useTags();
  const [activeCard, setActiveCard] = useState<CardItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const compositeId = event.active.id as string;
      const cardId = compositeId.split("__")[0];
      const card = cards.find((c) => c.id === cardId);
      setActiveCard(card || null);
    },
    [cards]
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over) {
        setActiveCard(null);
        return;
      }

      const compositeId = active.id as string;
      const cardId = compositeId.split("__")[0];
      const targetTagId = over.id as string;
      const sourceTagId = active.data.current?.sourceTagId as string;

      if (!sourceTagId || sourceTagId === targetTagId) return;

      const card = cards.find((c) => c.id === cardId);
      if (!card) return;

      const currentTagIds = card.tags.map((t) => t.id);
      const newTagIds = [...new Set(
        currentTagIds.filter((id) => id !== sourceTagId).concat(targetTagId)
      )];

      await fetch(`/api/tasks/${cardId}/tags`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagIds: newTagIds }),
      });
      setActiveCard(null);
      onMutate();
    },
    [cards, onMutate]
  );

  if (tags.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-text-dim">{t("kanbanEmptyTitle")}</p>
        <p className="text-xs text-text-faint mt-1">{t("kanbanEmptySubtitle")}</p>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 md:-mx-6 md:px-6">
        {tags.map((tag) => {
          const columnCards = cards.filter((c) =>
            c.tags.some((t) => t.id === tag.id)
          );
          return (
            <KanbanColumn key={tag.id} tag={tag} cards={columnCards} />
          );
        })}
      </div>
      <DragOverlay dropAnimation={null}>
        {activeCard && <KanbanCardOverlay card={activeCard} />}
      </DragOverlay>
    </DndContext>
  );
}

function KanbanColumn({
  tag,
  cards,
}: {
  tag: { id: string; name: string; color: string };
  cards: CardItem[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: tag.id });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col gap-2 min-w-[240px] w-[240px] shrink-0 rounded-lg p-2 transition-colors ${
        isOver ? "bg-muted/50" : ""
      }`}
    >
      <div className="flex items-center gap-2 px-1 py-1.5">
        <span
          className="w-3 h-3 rounded-full shrink-0"
          style={{ backgroundColor: `var(--${tag.color})` }}
        />
        <span className="text-sm font-semibold text-foreground truncate">
          {tag.name}
        </span>
        <span className="text-xs text-text-dim">{cards.length}</span>
      </div>
      <div className="flex flex-col gap-1.5 min-h-[60px]">
        {cards.map((card) => (
          <KanbanCard
            key={`${tag.id}-${card.id}`}
            card={card}
            sourceTagId={tag.id}
          />
        ))}
      </div>
    </div>
  );
}

function KanbanCard({
  card,
  sourceTagId,
}: {
  card: CardItem;
  sourceTagId: string;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${card.id}__${sourceTagId}`,
    data: { sourceTagId },
  });

  const preview = stripHtml(card.description, 60);
  const otherTags = card.tags.filter((t) => t.id !== sourceTagId);

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={isDragging ? "opacity-30" : ""}
    >
      <Link
        draggable={false}
        href={`/cards/${card.id}`}
        className="block p-3 rounded-lg border border-border bg-card hover:border-border-light transition-colors"
        onClick={(e) => {
          if (isDragging) e.preventDefault();
        }}
      >
        <h4 className="text-sm font-medium text-foreground line-clamp-2">
          {card.title}
        </h4>
        {preview && (
          <p className="mt-1 text-xs text-text-dim line-clamp-2">{preview}</p>
        )}
        {otherTags.length > 0 && (
          <div className="mt-2 flex items-center gap-1 flex-wrap">
            {otherTags.map((t) => (
              <TagBadge key={t.id} name={t.name} color={t.color} />
            ))}
          </div>
        )}
      </Link>
    </div>
  );
}

/** 拖移時跟著游標的卡片副本 */
function KanbanCardOverlay({ card }: { card: CardItem }) {
  const preview = stripHtml(card.description, 60);

  return (
    <div className="w-[224px] rotate-2 shadow-lg">
      <div className="p-3 rounded-lg border border-primary/50 bg-card">
        <h4 className="text-sm font-medium text-foreground line-clamp-2">
          {card.title}
        </h4>
        {preview && (
          <p className="mt-1 text-xs text-text-dim line-clamp-2">{preview}</p>
        )}
      </div>
    </div>
  );
}

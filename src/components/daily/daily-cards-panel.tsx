"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Search, X } from "lucide-react";
import { useCardsFeed } from "@/hooks/use-cards-feed";
import { useTags } from "@/hooks/use-tags";
import { CardGridItem } from "@/components/cards/card-grid-item";

const RECENT_LIMIT = 12;

export function DailyCardsPanel() {
  const t = useTranslations("cards");
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");

  const [searchExpanded, setSearchExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  const { tags: allTags } = useTags();

  // 300ms debounce on query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const isFiltering = debouncedQuery !== "" || selectedTagIds.length > 0;

  // Mirror cards-feed exactly: useCardsFeed(debouncedQuery, selectedTagIds)
  // When not filtering, fetch with empty query to get recents; we cap at RECENT_LIMIT client-side.
  const { cards: allCards, isLoading } = useCardsFeed(
    debouncedQuery,
    selectedTagIds
  );

  // Cap to RECENT_LIMIT when not filtering
  const cards = isFiltering ? allCards : allCards.slice(0, RECENT_LIMIT);

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const clearTagFilters = () => setSelectedTagIds([]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header row */}
      <div className="flex items-center justify-between px-3 py-2 shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-column-title text-foreground">
            {tNav("cards")}
          </span>
          <span className="text-column-title-acc text-text-dim">
            {cards.length}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setSearchExpanded((v) => !v)}
          aria-label={t("searchAria")}
          aria-pressed={searchExpanded}
          className="flex items-center justify-center h-7 w-7 rounded-md text-text-dim hover:text-foreground hover:bg-muted transition-colors"
        >
          {searchExpanded ? (
            <X className="h-4 w-4" />
          ) : (
            <Search className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Search area — visible when expanded; collapsing does NOT clear filters */}
      {searchExpanded && (
        <div className="px-3 pb-2 shrink-0 space-y-2">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-dim pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-text-faint focus:outline-none focus:border-primary transition-colors"
              aria-label={t("searchAria")}
            />
          </div>

          {/* Tag chips — AND semantics */}
          {allTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {allTags.map((tag) => {
                const active = selectedTagIds.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    aria-pressed={active}
                    className={
                      active
                        ? "text-xs px-2.5 py-0.5 rounded-full bg-primary text-primary-foreground border border-primary transition-colors"
                        : "text-xs px-2.5 py-0.5 rounded-full border border-border text-foreground hover:bg-muted transition-colors"
                    }
                  >
                    {tag.name}
                  </button>
                );
              })}
              {selectedTagIds.length > 0 && (
                <button
                  type="button"
                  onClick={clearTagFilters}
                  className="text-xs text-text-dim hover:text-foreground transition-colors px-1.5 py-0.5"
                >
                  {tCommon("cancel")}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Scrollable grid area */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {isLoading && cards.length === 0 ? (
          <p className="text-empty-state text-text-dim text-center py-8">
            {tCommon("loading")}
          </p>
        ) : cards.length === 0 ? (
          <p className="text-empty-state text-text-dim text-center py-8">
            {isFiltering ? t("emptyWithQuery") : t("emptyNoCards")}
          </p>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-2.5">
            {cards.map((card) => (
              <CardGridItem key={card.id} card={card} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

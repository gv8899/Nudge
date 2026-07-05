"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { SFIcon } from "@/components/ui/sf-icon";
import { useCardsFeed } from "@/hooks/use-cards-feed";
import { useTags } from "@/hooks/use-tags";
import { CardGridItem } from "@/components/cards/card-grid-item";

const RECENT_LIMIT = 12;

interface DailyCardsPanelProps {
  onOpenCard?: (id: string) => void;
}

export function DailyCardsPanel({ onOpenCard }: DailyCardsPanelProps = {}) {
  const t = useTranslations("cards");
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
      <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-column-title text-foreground">
            {t("recentTitle")}
          </span>
          <span className="text-column-title-acc text-text-dim">
            {cards.length}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            setSearchExpanded((v) => {
              // 按 X 收合 = 結束這次搜尋：關鍵字 / tag 篩選一併清空，
              // 「最近卡片」回到未過濾狀態（對齊 Mac dashboard 同一顆 X）。
              if (v) {
                setQuery("");
                setDebouncedQuery("");
                setSelectedTagIds([]);
              }
              return !v;
            });
          }}
          aria-label={t("searchAria")}
          aria-pressed={searchExpanded}
          className={`flex items-center justify-center h-9 w-9 rounded-full transition-colors ${
            searchExpanded ? "text-primary" : "text-text-dim hover:text-foreground"
          }`}
        >
          <SFIcon
            name={searchExpanded ? "xmark-circle-fill" : "magnifyingglass"}
            className="h-[18px] w-[18px]"
          />
        </button>
      </div>

      {/* Search area — visible when expanded; X 收合時會一併清空搜尋條件 */}
      {searchExpanded && (
        <div className="px-3 pb-2 shrink-0 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-text-dim pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="w-full pl-8 pr-3 py-2 text-field rounded-lg bg-foreground/[0.06] text-foreground placeholder:text-text-faint caret-primary focus:outline-none transition-colors"
              aria-label={t("searchAria")}
            />
          </div>

          {/* Tag chips — AND semantics */}
          {allTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2.5">
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
                        ? "text-field font-medium px-3 py-1 rounded-full bg-primary text-primary-foreground transition-colors"
                        : "text-field font-medium px-3 py-1 rounded-full bg-foreground/[0.06] text-foreground hover:bg-foreground/[0.10] transition-colors"
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
                  className="text-field font-medium text-primary hover:opacity-80 transition-opacity px-1.5 py-0.5"
                >
                  {tCommon("cancel")}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Scrollable grid area — @container so columns respond to PANEL width, not viewport */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 @container">
        {isLoading && cards.length === 0 ? (
          <p className="text-empty-state text-text-dim text-center py-8">
            {tCommon("loading")}
          </p>
        ) : cards.length === 0 ? (
          <p className="text-empty-state text-text-dim text-center py-8">
            {isFiltering ? t("emptyWithQuery") : t("emptyNoCards")}
          </p>
        ) : (
          <div className="grid grid-cols-1 @[576px]:grid-cols-2 gap-2.5">
            {cards.map((card) => (
              <CardGridItem key={card.id} card={card} onOpenInline={onOpenCard} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

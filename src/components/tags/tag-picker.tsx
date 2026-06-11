"use client";

import { useState } from "react";
import { Tag as TagIcon, Plus, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { useTags } from "@/hooks/use-tags";
import { TagBadge } from "./tag-badge";

interface TagPickerProps {
  taskId: string;
  selectedTags: Array<{ id: string; name: string; color: string }>;
  onTagsChange: (tagIds: string[]) => void;
}

export function TagPicker({ selectedTags, onTagsChange }: TagPickerProps) {
  const t = useTranslations("tags");
  const { tags: allTags, mutate: mutateTags } = useTags();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const selectedIds = new Set(selectedTags.map((t) => t.id));

  const filtered = allTags.filter(
    (t) => t.name.toLowerCase().includes(search.toLowerCase())
  );

  const exactMatch = allTags.some(
    (t) => t.name.toLowerCase() === search.toLowerCase()
  );

  const toggleTag = (tagId: string) => {
    const newIds = selectedIds.has(tagId)
      ? [...selectedIds].filter((id) => id !== tagId)
      : [...selectedIds, tagId];
    onTagsChange(newIds);
  };

  const createTag = async (name: string) => {
    if (!name) return;
    const res = await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return;
    const tag = await res.json();
    await mutateTags();
    onTagsChange([...selectedIds, tag.id]);
    setSearch("");
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {selectedTags.map((tag) => (
        <TagBadge
          key={tag.id}
          name={tag.name}
          onRemove={() => toggleTag(tag.id)}
        />
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          className="inline-flex items-center gap-1.5 text-xs text-text-dim hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-muted cursor-pointer"
          aria-label={t("addTag")}
        >
          <TagIcon className="h-3.5 w-3.5" />
          <span>{selectedTags.length === 0 ? t("addTagShort") : "+"}</span>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56 p-0">
          <div>
            <div className="p-2 border-b border-border">
              <div className="relative flex items-center">
                <Search className="absolute left-0 h-3.5 w-3.5 text-text-dim pointer-events-none shrink-0" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("searchOrCreate")}
                  className="w-full pl-5 pr-5 text-sm bg-transparent outline-none placeholder:text-text-faint text-foreground"
                  autoFocus
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-0 text-text-faint hover:text-text-dim transition-colors"
                    tabIndex={-1}
                    aria-hidden="true"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto p-1">
              {filtered.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded text-sm hover:bg-muted transition-colors"
                >
                  <span className="flex-1 truncate text-foreground">{tag.name}</span>
                  {selectedIds.has(tag.id) && (
                    <span className="text-primary text-xs">✓</span>
                  )}
                </button>
              ))}
              {search.trim() && !exactMatch && (
                <button
                  type="button"
                  onClick={() => createTag(search.trim())}
                  className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded text-sm hover:bg-muted transition-colors text-primary"
                >
                  <Plus className="h-3 w-3" />
                  {t("createNamed", { name: search.trim() })}
                </button>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

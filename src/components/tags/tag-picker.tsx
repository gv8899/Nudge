"use client";

import { useState } from "react";
import { Tag as TagIcon, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { useTags } from "@/hooks/use-tags";
import { TagBadge } from "./tag-badge";
import { TagColorPicker } from "./tag-color-picker";
import type { TagColor } from "@/lib/constants";

interface TagPickerProps {
  taskId: string;
  selectedTags: Array<{ id: string; name: string; color: string }>;
  onTagsChange: (tagIds: string[]) => void;
}

export function TagPicker({ taskId, selectedTags, onTagsChange }: TagPickerProps) {
  const t = useTranslations("tags");
  const tCommon = useTranslations("common");
  const { tags: allTags, mutate: mutateTags } = useTags();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [creatingName, setCreatingName] = useState<string | null>(null);
  const [newColor, setNewColor] = useState<TagColor>("chart-1");

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

  const createTag = async () => {
    const name = creatingName || search.trim();
    if (!name) return;

    const res = await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color: newColor }),
    });

    if (!res.ok) return;
    const tag = await res.json();
    await mutateTags();

    onTagsChange([...selectedIds, tag.id]);
    setSearch("");
    setCreatingName(null);
    setNewColor("chart-1");
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {selectedTags.map((t) => (
        <TagBadge
          key={t.id}
          name={t.name}
          color={t.color}
          onRemove={() => toggleTag(t.id)}
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
          {creatingName !== null ? (
            <div className="p-3 space-y-3">
              <div className="text-xs font-medium text-foreground">
                {t("createNamed", { name: creatingName })}
              </div>
              <TagColorPicker value={newColor} onChange={setNewColor} />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCreatingName(null)}
                  className="text-xs text-text-dim hover:text-foreground transition-colors"
                >
                  {tCommon("cancel")}
                </button>
                <button
                  type="button"
                  onClick={createTag}
                  className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  {t("create")}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="p-2 border-b border-border">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("searchOrCreate")}
                  className="w-full text-sm bg-transparent outline-none placeholder:text-text-faint text-foreground"
                  autoFocus
                />
              </div>
              <div className="max-h-48 overflow-y-auto p-1">
                {filtered.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded text-sm hover:bg-muted transition-colors"
                  >
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: `var(--${tag.color})` }}
                    />
                    <span className="flex-1 truncate text-foreground">{tag.name}</span>
                    {selectedIds.has(tag.id) && (
                      <span className="text-primary text-xs">✓</span>
                    )}
                  </button>
                ))}
                {search.trim() && !exactMatch && (
                  <button
                    type="button"
                    onClick={() => setCreatingName(search.trim())}
                    className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded text-sm hover:bg-muted transition-colors text-primary"
                  >
                    <Plus className="h-3 w-3" />
                    {t("createNamed", { name: search.trim() })}
                  </button>
                )}
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

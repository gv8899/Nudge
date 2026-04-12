"use client";

import { useState, useRef, useEffect } from "react";
import { Trash2, GripVertical } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTags } from "@/hooks/use-tags";
import { TagColorPicker } from "./tag-color-picker";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import type { TagColor } from "@/lib/constants";

export function TagManager() {
  const t = useTranslations("tags");
  const { tags, mutate } = useTags();
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const createTag = async () => {
    const name = newName.trim();
    if (!name) return;
    await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setNewName("");
    mutate();
  };

  const updateTag = async (id: string, updates: { name?: string; color?: TagColor }) => {
    await fetch(`/api/tags/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    mutate();
  };

  const deleteTag = async (id: string) => {
    await fetch(`/api/tags/${id}`, { method: "DELETE" });
    mutate();
  };

  const saveEdit = (id: string) => {
    const name = editingName.trim();
    if (name) updateTag(id, { name });
    setEditingId(null);
  };

  return (
    <div className="space-y-2">
      {tags.map((tag) => (
        <div key={tag.id} className="flex items-center gap-2 py-1.5 group">
          <GripVertical className="h-3.5 w-3.5 text-text-faint shrink-0" />

          <Popover>
            <PopoverTrigger className="shrink-0 cursor-pointer" aria-label={t("changeColor")}>
              <span
                className="w-4 h-4 rounded-full block"
                style={{ backgroundColor: `var(--${tag.color})` }}
              />
            </PopoverTrigger>
            <PopoverContent align="start" side="bottom" className="w-auto p-0">
              <TagColorPicker
                value={tag.color}
                onChange={(color) => updateTag(tag.id, { color })}
              />
            </PopoverContent>
          </Popover>

          {editingId === tag.id ? (
            <input
              ref={editInputRef}
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onBlur={() => saveEdit(tag.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveEdit(tag.id);
                if (e.key === "Escape") setEditingId(null);
              }}
              className="flex-1 min-w-0 text-sm bg-transparent outline-none border-b border-primary text-foreground"
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setEditingId(tag.id);
                setEditingName(tag.name);
              }}
              className="flex-1 min-w-0 text-left text-sm text-foreground truncate hover:text-primary transition-colors"
            >
              {tag.name}
            </button>
          )}

          <button
            type="button"
            onClick={() => deleteTag(tag.id)}
            aria-label={t("deleteTagAria", { name: tag.name })}
            className="opacity-0 group-hover:opacity-100 text-text-faint hover:text-destructive transition-all shrink-0 p-1"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}

      <div className="flex items-center gap-2 pt-1">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") createTag();
          }}
          placeholder={t("newTagPlaceholder")}
          className="flex-1 text-sm bg-transparent outline-none placeholder:text-text-faint text-foreground"
        />
        {newName.trim() && (
          <button
            type="button"
            onClick={createTag}
            className="text-xs text-primary hover:text-primary/80 font-medium transition-colors shrink-0"
          >
            {t("add")}
          </button>
        )}
      </div>
    </div>
  );
}

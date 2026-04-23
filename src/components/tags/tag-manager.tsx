"use client";

import { useState, useRef, useEffect } from "react";
import { Pencil, Trash2, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTags } from "@/hooks/use-tags";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

export function TagManager() {
  const t = useTranslations("tags");
  const tCommon = useTranslations("common");
  const { tags, mutate } = useTags();

  const [newName, setNewName] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const addInputRef = useRef<HTMLInputElement>(null);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamingText, setRenamingText] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAdding) addInputRef.current?.focus();
  }, [isAdding]);

  useEffect(() => {
    if (renamingId) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [renamingId]);

  const createTag = async () => {
    const name = newName.trim();
    if (!name) return;
    await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setNewName("");
    setIsAdding(false);
    mutate();
  };

  const updateTag = async (id: string, updates: { name?: string }) => {
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

  const saveRename = (id: string, originalName: string) => {
    const name = renamingText.trim();
    if (name && name !== originalName) updateTag(id, { name });
    setRenamingId(null);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {tags.map((tag) => {
        if (renamingId === tag.id) {
          return (
            <input
              key={tag.id}
              ref={renameInputRef}
              value={renamingText}
              onChange={(e) => setRenamingText(e.target.value)}
              onBlur={() => saveRename(tag.id, tag.name)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveRename(tag.id, tag.name);
                if (e.key === "Escape") setRenamingId(null);
              }}
              className="text-xs px-2.5 py-1 rounded-full border border-primary outline-none bg-transparent text-foreground min-w-[60px]"
              size={Math.max(renamingText.length, 4)}
            />
          );
        }
        return (
          <DropdownMenu key={tag.id}>
            <DropdownMenuTrigger
              className="text-xs px-2.5 py-1 rounded-full border border-border text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              {tag.name}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-32">
              <DropdownMenuItem
                onClick={() => {
                  setRenamingText(tag.name);
                  setRenamingId(tag.id);
                }}
              >
                <Pencil className="h-3.5 w-3.5 mr-2" />
                {tCommon("edit")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => deleteTag(tag.id)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" />
                {tCommon("delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      })}

      {isAdding ? (
        <div className="inline-flex items-center gap-1 rounded-full border border-primary px-2.5 py-1">
          <input
            ref={addInputRef}
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") createTag();
              if (e.key === "Escape") {
                setIsAdding(false);
                setNewName("");
              }
            }}
            placeholder={t("newTagPlaceholder")}
            className="text-xs bg-transparent outline-none placeholder:text-text-faint text-foreground min-w-[80px]"
            size={Math.max(newName.length, 8)}
          />
          <button
            type="button"
            onClick={() => {
              setIsAdding(false);
              setNewName("");
            }}
            className="text-text-dim hover:text-foreground"
            aria-label={tCommon("cancel")}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-primary/50 text-primary hover:bg-primary/10 transition-colors"
        >
          <Plus className="h-3 w-3" />
          {t("add")}
        </button>
      )}
    </div>
  );
}

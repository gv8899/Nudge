"use client";

import { useState, useRef, useEffect } from "react";
import { GripVertical, Trash2, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTags } from "@/hooks/use-tags";

export function TagManager() {
  const t = useTranslations("tags");
  const tCommon = useTranslations("common");
  const { tags: serverTags, mutate } = useTags();

  // Local mirror of tags so drag preview applies before the server round-trip.
  const [tags, setTags] = useState(serverTags);
  useEffect(() => setTags(serverTags), [serverTags]);

  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  // pendingDeleteId: first click sets this; second click (confirm) calls deleteTag.
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

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

  const updateTag = async (id: string, updates: { name?: string; sortOrder?: number }) => {
    await fetch(`/api/tags/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
  };

  const deleteTag = async (id: string) => {
    await fetch(`/api/tags/${id}`, { method: "DELETE" });
    mutate();
  };

  const saveEdit = (id: string) => {
    const name = editingName.trim();
    if (name) {
      updateTag(id, { name }).then(() => mutate());
    }
    setEditingId(null);
  };

  const handleDrop = async (toId: string) => {
    if (!draggingId || draggingId === toId) {
      setDraggingId(null);
      return;
    }
    const from = tags.findIndex((t) => t.id === draggingId);
    const to = tags.findIndex((t) => t.id === toId);
    if (from < 0 || to < 0) {
      setDraggingId(null);
      return;
    }
    const next = [...tags];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setTags(next);
    setDraggingId(null);
    // Persist new order — PATCH each whose index changed.
    await Promise.all(
      next
        .map((tag, idx) => ({ tag, idx }))
        .filter(({ tag, idx }) => tag.sortOrder !== idx)
        .map(({ tag, idx }) => updateTag(tag.id, { sortOrder: idx }))
    );
    mutate();
  };

  return (
    <div>
      {tags.map((tag) => (
        <div
          key={tag.id}
          onDragOver={(e) => {
            if (draggingId && draggingId !== tag.id) e.preventDefault();
          }}
          onDrop={(e) => {
            e.preventDefault();
            handleDrop(tag.id);
          }}
          className={`flex items-center gap-2 py-1.5 group ${
            draggingId === tag.id ? "opacity-40" : ""
          }`}
        >
          {/* Drag handle is the ONLY drag initiator — rename input won't start a drag */}
          <button
            type="button"
            draggable
            onDragStart={(e) => {
              e.stopPropagation();
              setDraggingId(tag.id);
            }}
            onDragEnd={() => setDraggingId(null)}
            className="cursor-grab active:cursor-grabbing text-text-faint hover:text-text-dim"
            aria-label={t("dragReorderAria", { name: tag.name })}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>

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
                // Clear any pending delete when entering rename mode.
                setPendingDeleteId(null);
              }}
              className="flex-1 min-w-0 text-left text-sm text-foreground truncate hover:text-primary transition-colors"
            >
              {tag.name}
            </button>
          )}

          {pendingDeleteId === tag.id ? (
            /* Confirm step: show Cancel + Delete buttons */
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setPendingDeleteId(null)}
                className="text-xs text-text-dim hover:text-foreground transition-colors px-1"
              >
                {tCommon("cancel")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPendingDeleteId(null);
                  deleteTag(tag.id);
                }}
                aria-label={t("deleteTagAria", { name: tag.name })}
                className="text-xs text-destructive hover:text-destructive/80 font-medium transition-colors px-1"
              >
                {tCommon("delete")}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setPendingDeleteId(tag.id)}
              aria-label={t("deleteTagAria", { name: tag.name })}
              className="opacity-0 group-hover:opacity-100 text-text-faint hover:text-destructive transition-all shrink-0 p-1"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ))}

      <div className="flex items-center gap-2 pt-1">
        <Plus className="h-3.5 w-3.5 shrink-0 text-text-dim" aria-hidden />
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

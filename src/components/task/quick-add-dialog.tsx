"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

interface QuickAddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (title: string) => void;
}

/**
 * 快速新增任務 modal（對齊 Mac QuickAddTaskSheet）：單行輸入、Enter 或
 * 「新增」送出，Escape / 取消關閉。取代舊的 FAB toggle inline composer。
 */
export function QuickAddDialog({ open, onOpenChange, onSubmit }: QuickAddDialogProps) {
  const t = useTranslations("task");
  const tCommon = useTranslations("common");
  const [title, setTitle] = useState("");

  // 關閉時清空草稿（不論送出/取消/Escape/點外），下次開啟自然是空的 —
  // 避免在 effect 內 setState（cascading render lint 規則）。
  function handleOpenChange(next: boolean) {
    if (!next) setTitle("");
    onOpenChange(next);
  }

  function handleSubmit() {
    const trimmed = title.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogTitle className="sr-only">{t("createPlaceholder")}</DialogTitle>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
        >
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("createPlaceholder")}
            aria-label={t("createPlaceholder")}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder-text-faint outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          />
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              className="rounded-md px-3 py-1.5 text-sm text-foreground hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              {tCommon("cancel")}
            </button>
            <button
              type="submit"
              disabled={!title.trim()}
              className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50"
            >
              {t("quickAddSubmit")}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

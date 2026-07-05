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
 * 快速新增任務 modal — 對齊 Mac QuickAddTaskSheet（460×100）：極簡
 * TextField + 「按 Enter 新增」hint，**無顯式按鈕、無 X**。⏎ submit、
 * ⎋ / 點外面 cancel。hint 只在輸入後浮現（fade），高度固定避免 jump。
 */
export function QuickAddDialog({ open, onOpenChange, onSubmit }: QuickAddDialogProps) {
  const t = useTranslations("task");
  const [title, setTitle] = useState("");
  const hasText = title.trim().length > 0;

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
      <DialogContent showCloseButton={false} className="sm:max-w-[460px] gap-2 px-5 py-3.5">
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
            className="w-full rounded-xl bg-foreground/[0.06] px-4 py-3 text-field text-foreground placeholder-text-faint outline-none border-[1.5px] border-transparent focus:border-primary transition-colors"
          />
          {/* hint row — 固定高度，輸入後才 fade in（對齊 Mac hintRow） */}
          <div
            aria-hidden={!hasText}
            className={`mt-2 h-4 text-center text-row-body text-text-dim transition-opacity duration-200 ${hasText ? "opacity-100" : "opacity-0"}`}
          >
            {t("pressEnterToAdd")}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

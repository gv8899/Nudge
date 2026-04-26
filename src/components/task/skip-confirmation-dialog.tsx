"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { mutate as globalMutate } from "swr";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  assignmentId: string | null;
  taskTitle: string;
  currentDate: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Confirms before PATCHing isSkipped=true on a daily-assignment. Web adds
 * this confirm step (App fires immediately) — desktop click-cost is low
 * enough that an explicit confirm prevents accidental skips.
 */
export function SkipConfirmationDialog({
  assignmentId,
  taskTitle,
  currentDate,
  open,
  onOpenChange,
}: Props) {
  const t = useTranslations();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSkip() {
    if (!assignmentId) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/daily-assignments/${assignmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isSkipped: true }),
      });
      if (!res.ok) throw new Error(`PATCH failed: ${res.status}`);
      // Revalidate the daily key so the row disappears from the page
      await globalMutate(`/api/daily/${currentDate}`);
      onOpenChange(false);
    } catch (err) {
      console.error("[SkipConfirmationDialog] failed:", err);
      setError(t("common.errorSaving"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("daily.skipConfirmTitle")}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-foreground">
          {t("daily.skipConfirmBody", { title: taskTitle })}
        </p>
        {error && (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="rounded-md px-3 py-1.5 text-sm text-foreground hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={handleSkip}
            disabled={isSubmitting || !assignmentId}
            className="rounded-md bg-destructive px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40 disabled:opacity-50"
          >
            {t("daily.skipConfirmAction")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

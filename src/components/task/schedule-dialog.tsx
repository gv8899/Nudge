"use client";

import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScheduleSection } from "./schedule-section";

interface Props {
  taskId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Modal wrapper around ScheduleSection. Opened from a daily task row's
 * …menu / right-click menu (Task 11). taskId may be null briefly when the
 * dialog is closing — guarded so we don't render ScheduleSection without
 * an id.
 */
export function ScheduleDialog({ taskId, open, onOpenChange }: Props) {
  const t = useTranslations();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* Mac ScheduleSection 無標題 — 保留 sr-only 供螢幕閱讀器辨識 */}
        <DialogTitle className="sr-only">{t("schedule.dialogTitle")}</DialogTitle>
        {taskId && <ScheduleSection taskId={taskId} />}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            {t("common.done")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

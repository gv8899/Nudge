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
      {/* 對齊 Mac ScheduleEditSheet：440×560 固定尺寸、無 X（Esc/點外面 =
          完成）、內容捲動、footer 釘底右側膠囊「完成」。 */}
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-[440px] h-[560px] max-h-[88dvh] p-0 flex flex-col gap-0"
      >
        {/* Mac ScheduleSection 無標題 — 保留 sr-only 供螢幕閱讀器辨識 */}
        <DialogTitle className="sr-only">{t("schedule.dialogTitle")}</DialogTitle>
        <div className="flex-1 overflow-y-auto px-5 pt-5 pb-4">
          {taskId && <ScheduleSection taskId={taskId} />}
        </div>
        <div className="flex justify-end px-5 py-3.5">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-full bg-primary px-6 py-2.5 text-inline-button text-primary-foreground hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            {t("common.done")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

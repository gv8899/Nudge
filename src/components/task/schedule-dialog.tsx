"use client";

import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
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
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            {t("schedule.recurrenceTitle")}
          </DialogTitle>
        </DialogHeader>
        {taskId && <ScheduleSection taskId={taskId} />}
      </DialogContent>
    </Dialog>
  );
}

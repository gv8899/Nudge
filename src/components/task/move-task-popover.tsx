"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { enUS, ja, zhTW } from "date-fns/locale";
import { format } from "date-fns";
import { CalendarDays } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";

interface MoveTaskPopoverProps {
  currentDate: string;
  onMove: (targetDate: string) => void;
}

/**
 * 「移到其他日期」— Mac 對齊：獨立 modal（標題 + 日曆 + 取消/確認 footer），
 * 選日不立即 commit，只有按「確認」才呼叫 onMove。
 */
export function MoveTaskPopover({ currentDate, onMove }: MoveTaskPopoverProps) {
  const t = useTranslations("task");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const dateFnsLocale = locale === "ja" ? ja : locale === "en" ? enUS : zhTW;
  const [open, setOpen] = useState(false);
  const [pickedDate, setPickedDate] = useState<Date | undefined>(undefined);

  function handleOpen() {
    // 每次開啟重置本地選取狀態 — 對齊 Mac：選日不立即 commit。
    setPickedDate(undefined);
    setOpen(true);
  }

  function handleConfirm() {
    if (!pickedDate) return;
    const targetDate = format(pickedDate, "yyyy-MM-dd");
    if (targetDate !== currentDate) {
      onMove(targetDate);
    }
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="text-text-faint hover:text-muted-foreground cursor-pointer transition-colors outline-none p-2"
        aria-label={t("moveToOtherDate")}
      >
        <CalendarDays className="h-4 w-4" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogTitle className="text-base font-semibold">
            {t("moveToOtherDate")}
          </DialogTitle>
          <Calendar
            mode="single"
            selected={pickedDate}
            defaultMonth={new Date(currentDate + "T00:00:00")}
            onSelect={setPickedDate}
            locale={dateFnsLocale}
          />
          <div className="flex justify-end gap-2 mt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-1.5 text-sm text-foreground hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              {tCommon("cancel")}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!pickedDate}
              className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50"
            >
              {tCommon("confirm")}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

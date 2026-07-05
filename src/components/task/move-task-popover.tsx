"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { enUS, ja, zhTW } from "date-fns/locale";
import { format } from "date-fns";
import { getDefaultClassNames } from "react-day-picker";
import { CalendarDays } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

interface MoveTaskPopoverProps {
  currentDate: string;
  onMove: (targetDate: string) => void;
}

/**
 * 「移到其他日期」— 對齊 Mac MoveToDatePickerView（400 寬 modal）：
 * 標題 + 滿版日曆 + 取消/確認 footer（確認 = 主色膠囊）。開啟時預選
 * 目前日期（同 Mac 以 initialDate 播種），按「確認」才 commit，無 X。
 */
export function MoveTaskPopover({ currentDate, onMove }: MoveTaskPopoverProps) {
  const t = useTranslations("task");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const dateFnsLocale = locale === "ja" ? ja : locale === "en" ? enUS : zhTW;
  const [open, setOpen] = useState(false);
  const [pickedDate, setPickedDate] = useState<Date>(
    () => new Date(currentDate + "T00:00:00")
  );
  const dcn = getDefaultClassNames();

  function handleOpen() {
    // 每次開啟以目前日期重新播種 — 對齊 Mac：選日不立即 commit。
    setPickedDate(new Date(currentDate + "T00:00:00"));
    setOpen(true);
  }

  function handleConfirm() {
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
        <DialogContent showCloseButton={false} className="sm:max-w-[400px] gap-4 px-6 py-5">
          <DialogTitle className="text-column-detail-title">
            {t("moveToOtherDate")}
          </DialogTitle>
          {/* 滿版日曆 — 蓋掉 Calendar 預設的 w-fit root，格子加大到 spacing(9) */}
          <Calendar
            mode="single"
            required
            selected={pickedDate}
            defaultMonth={pickedDate}
            onSelect={(d) => d && setPickedDate(d)}
            locale={dateFnsLocale}
            className="w-full p-0 [--cell-size:--spacing(9)]"
            classNames={{ root: cn("w-full", dcn.root) }}
          />
          <div className="flex justify-end items-center gap-3 mt-1">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-3.5 py-2 text-inline-button text-text-dim hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-md"
            >
              {tCommon("cancel")}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="rounded-full bg-primary px-5 py-2 text-inline-button text-primary-foreground hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              {tCommon("confirm")}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

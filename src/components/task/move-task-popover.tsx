"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";
import { CalendarDays } from "lucide-react";

interface MoveTaskPopoverProps {
  currentDate: string;
  onMove: (targetDate: string) => void;
}

export function MoveTaskPopover({ currentDate, onMove }: MoveTaskPopoverProps) {
  const t = useTranslations("task");
  const [open, setOpen] = useState(false);

  const handleSelect = (day: Date | undefined) => {
    if (!day) return;
    const targetDate = format(day, "yyyy-MM-dd");
    if (targetDate !== currentDate) {
      onMove(targetDate);
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="text-text-faint hover:text-muted-foreground cursor-pointer transition-colors outline-none p-2"
        aria-label={t("moveToOtherDate")}
      >
        <CalendarDays className="h-4 w-4" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={new Date(currentDate + "T00:00:00")}
          onSelect={handleSelect}
          locale={zhTW}
        />
      </PopoverContent>
    </Popover>
  );
}

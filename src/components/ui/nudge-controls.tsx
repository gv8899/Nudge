"use client";

/**
 * Nudge 自刻表單控制元件 — 鏡像 Mac `Components/NudgeSwitch|NudgeDropdown|
 * NudgeDateField|NudgeTimeField`（design-system 層，取代原生 select /
 * checkbox / date input 的系統外觀）。
 *
 * 共同規格（對齊 Mac）：
 * - field trigger：高 34、圓角 8、`foreground` 6% 填色（hover 10%）、px-14
 * - switch：44×26 膠囊、開 = primary / 關 = fg 22%、22px 白 thumb + spring
 * - date field：calendar icon + 本地化日期，點開 popover 月曆（單選即關）
 */

import * as React from "react";
import { format } from "date-fns";
import { enUS, ja, zhTW } from "date-fns/locale";
import { useLocale } from "next-intl";
import { getDefaultClassNames } from "react-day-picker";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { SFIcon } from "@/components/ui/sf-icon";

/** 共用 trigger 外觀 — Mac NudgeDropdown/NudgeDateField 同款。 */
const fieldTriggerClass =
  "inline-flex items-center gap-1.5 h-[34px] rounded-lg bg-foreground/[0.06] hover:bg-foreground/[0.10] px-3.5 text-primary-row-title text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";

// ── NudgeSwitch ────────────────────────────────────────────────────────────

export function NudgeSwitch({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={`relative h-[26px] w-11 shrink-0 rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
        checked ? "bg-primary" : "bg-foreground/[0.22]"
      }`}
    >
      {/* left-0.5 錨定左緣 — 不設 left 會吃 button 預設置中的 static
          position，thumb 會滑出膠囊右緣 */}
      <span
        className={`absolute left-0.5 top-0.5 h-[22px] w-[22px] rounded-full bg-white shadow-[0_1px_1.5px_rgba(0,0,0,0.18)] transition-transform duration-200 ease-[cubic-bezier(0.34,1.3,0.64,1)] ${
          checked ? "translate-x-[18px]" : "translate-x-0"
        }`}
      />
    </button>
  );
}

// ── NudgeDropdown ──────────────────────────────────────────────────────────

export function NudgeDropdown<V extends string | number>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: V;
  options: { value: V; label: string }[];
  onChange: (v: V) => void;
  ariaLabel: string;
}) {
  const [open, setOpen] = React.useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button type="button" aria-label={ariaLabel} className={fieldTriggerClass}>
            <span className="truncate">{current?.label}</span>
            <ChevronsUpDown className="h-3 w-3 shrink-0 text-text-dim" />
          </button>
        }
      />
      <PopoverContent side="bottom" align="end" sideOffset={6} className="min-w-40 p-0 py-1.5">
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            onClick={() => {
              onChange(o.value);
              setOpen(false);
            }}
            className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-primary/[0.12] transition-colors"
          >
            <Check
              className={`h-3.5 w-3.5 shrink-0 text-primary ${o.value === value ? "opacity-100" : "opacity-0"}`}
            />
            <span className="text-row-title text-foreground">{o.label}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

// ── NudgeDateField ─────────────────────────────────────────────────────────

/** value/onChange 走 "YYYY-MM-DD"（local）。 */
export function NudgeDateField({
  value,
  onChange,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  ariaLabel: string;
}) {
  const locale = useLocale();
  const dfLocale = locale === "ja" ? ja : locale === "en" ? enUS : zhTW;
  const [open, setOpen] = React.useState(false);
  const date = new Date(value + "T00:00:00");
  const label =
    locale === "en"
      ? format(date, "MMM d, yyyy", { locale: dfLocale })
      : format(date, "yyyy年M月d日", { locale: dfLocale });
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button type="button" aria-label={ariaLabel} className={fieldTriggerClass}>
            <SFIcon name="calendar" className="h-[13px] w-[13px] text-text-dim" />
            <span className="tabular-nums">{label}</span>
          </button>
        }
      />
      <PopoverContent side="bottom" align="end" sideOffset={6} className="w-[300px] p-3">
        <CalendarPicker
          mode="single"
          required
          selected={date}
          defaultMonth={date}
          onSelect={(d) => {
            if (d) onChange(format(d, "yyyy-MM-dd"));
            setOpen(false);
          }}
          locale={dfLocale}
          className="w-full p-0 [--cell-size:--spacing(9)]"
          classNames={{ root: cn("w-full", getDefaultClassNames().root) }}
        />
      </PopoverContent>
    </Popover>
  );
}

// ── NudgeTimeField ─────────────────────────────────────────────────────────

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

/**
 * 自刻 time picker — 原生 `<input type="time">` 的下拉是瀏覽器 chrome
 * （白底系統藍），無法套 token；改成 popover 時/分兩欄（分鐘 5 分刻度，
 * 但保留非整刻度的既有值顯示）。value/onChange 走 "HH:MM"。
 */
export function NudgeTimeField({
  value,
  onChange,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  ariaLabel: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [hh = "09", mm = "00"] = value.split(":");
  const hourRef = React.useRef<HTMLDivElement>(null);
  const minRef = React.useRef<HTMLDivElement>(null);

  // 開啟時把選中的時/分捲到可視範圍
  React.useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => {
      hourRef.current
        ?.querySelector('[data-selected="true"]')
        ?.scrollIntoView({ block: "center" });
      minRef.current
        ?.querySelector('[data-selected="true"]')
        ?.scrollIntoView({ block: "center" });
    });
  }, [open]);

  const minutes = MINUTES.includes(mm) ? MINUTES : [...MINUTES, mm].sort();

  const colItem = (selected: boolean) =>
    `block w-full rounded-md px-3 py-1.5 text-center text-row-title tabular-nums transition-colors ${
      selected
        ? "bg-primary text-primary-foreground"
        : "text-foreground hover:bg-primary/[0.12]"
    }`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button type="button" aria-label={ariaLabel} className={fieldTriggerClass}>
            <span className="tabular-nums">{`${hh}:${mm}`}</span>
            <ChevronsUpDown className="h-3 w-3 shrink-0 text-text-dim" />
          </button>
        }
      />
      <PopoverContent side="bottom" align="end" sideOffset={6} className="w-[152px] p-1.5">
        <div className="flex gap-1.5">
          <div ref={hourRef} className="h-52 flex-1 overflow-y-auto pr-0.5">
            {HOURS.map((h) => (
              <button
                key={h}
                type="button"
                data-selected={h === hh}
                onClick={() => onChange(`${h}:${mm}`)}
                className={colItem(h === hh)}
              >
                {h}
              </button>
            ))}
          </div>
          <div ref={minRef} className="h-52 flex-1 overflow-y-auto pl-0.5">
            {minutes.map((m) => (
              <button
                key={m}
                type="button"
                data-selected={m === mm}
                onClick={() => {
                  onChange(`${hh}:${m}`);
                  setOpen(false);
                }}
                className={colItem(m === mm)}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

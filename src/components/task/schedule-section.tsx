"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  useTaskRecurrence,
  type RecurrencePreset,
  type RecurrenceRule,
} from "@/hooks/use-task-recurrence";
import {
  validateEndAfterStart,
  validateWeeklyHasWeekday,
  parseWeekdaysCsv,
  weekdaysToCsv,
} from "@/lib/schedule-validation";

const PRESETS: (RecurrencePreset | null)[] = [
  null,
  "daily",
  "weekly",
  "biweekly",
  "monthly_day",
  "monthly_nth_weekday",
];
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const; // ISO Mon..Sun
const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

/**
 * Maps a RecurrencePreset (snake_case) to its schedule.preset.* i18n key
 * (camelCase). The i18n namespace uses camelCase: monthlyDay, monthlyNthWeekday.
 */
function presetToI18nKey(
  p: RecurrencePreset,
): "daily" | "weekly" | "biweekly" | "monthlyDay" | "monthlyNthWeekday" {
  switch (p) {
    case "daily":
      return "daily";
    case "weekly":
      return "weekly";
    case "biweekly":
      return "biweekly";
    case "monthly_day":
      return "monthlyDay";
    case "monthly_nth_weekday":
      return "monthlyNthWeekday";
    // "weekdays" and "yearly" are valid presets but not shown in PRESETS list;
    // fall back to a safe value if somehow encountered.
    default:
      return "daily";
  }
}

interface Props {
  taskId: string;
}

export function ScheduleSection({ taskId }: Props) {
  const t = useTranslations();
  const { data, save } = useTaskRecurrence(taskId);

  const [preset, setPreset] = useState<RecurrencePreset | null>(null);
  const [weekdays, setWeekdays] = useState<Set<number>>(new Set());
  const [monthNth, setMonthNth] = useState(1);
  const [monthNthWeekday, setMonthNthWeekday] = useState(1);
  const [startDate, setStartDate] = useState(today());
  const [hasEndDate, setHasEndDate] = useState(false);
  const [endDate, setEndDate] = useState(today());
  const [remindAt, setRemindAt] = useState<string>(""); // "" = 不提醒
  const [didApplyServer, setDidApplyServer] = useState(false);

  // Sync from server once on first data
  useEffect(() => {
    if (data && !didApplyServer) {
      setPreset(data.preset);
      setWeekdays(parseWeekdaysCsv(data.weekdays));
      setMonthNth(data.monthNth ?? 1);
      setMonthNthWeekday(data.monthNthWeekday ?? 1);
      setStartDate(data.startDate);
      setHasEndDate(data.endDate !== null);
      setEndDate(data.endDate ?? today());
      setRemindAt(data.remindAtTimeOfDay ?? "");
      setDidApplyServer(true);
    }
  }, [data, didApplyServer]);

  const errEnd = !validateEndAfterStart(startDate, hasEndDate ? endDate : null);
  const errWeekday = !validateWeeklyHasWeekday(
    preset ?? "",
    weekdaysToCsv(weekdays),
  );
  const isValid = !errEnd && !errWeekday;

  // Debounced save (500ms) — single timer for any field change.
  // Skip until server data has been applied (avoid overwriting unloaded card).
  useEffect(() => {
    if (!didApplyServer) return;
    if (!isValid) return;
    const timer = setTimeout(() => {
      void doSave();
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    preset,
    weekdays,
    monthNth,
    monthNthWeekday,
    startDate,
    hasEndDate,
    endDate,
    remindAt,
  ]);

  async function doSave() {
    if (preset === null) {
      await save(null);
      return;
    }
    const monthDay =
      preset === "monthly_day"
        ? new Date(startDate + "T00:00").getDate()
        : null;
    const rule: RecurrenceRule = {
      preset,
      weekdays:
        preset === "weekly" || preset === "biweekly"
          ? weekdaysToCsv(weekdays)
          : null,
      monthDay,
      monthNth: preset === "monthly_nth_weekday" ? monthNth : null,
      monthNthWeekday:
        preset === "monthly_nth_weekday" ? monthNthWeekday : null,
      startDate,
      endDate: hasEndDate ? endDate : null,
      remindAtTimeOfDay: remindAt || null,
    };
    try {
      await save(rule);
    } catch {
      // Errors are surfaced by the dialog/page-level error UI; debounce
      // can't easily report up. Future: hoist error to parent.
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <label className="block text-sm font-medium text-foreground">
          {t("schedule.recurrenceTitle")}
        </label>
        <select
          value={preset ?? ""}
          onChange={(e) =>
            setPreset((e.target.value || null) as RecurrencePreset | null)
          }
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          aria-label={t("schedule.recurrenceTitle")}
        >
          {PRESETS.map((p) => (
            <option key={p ?? "off"} value={p ?? ""}>
              {p === null
                ? t("schedule.recurrence.off")
                : t(`schedule.preset.${presetToI18nKey(p)}`)}
            </option>
          ))}
        </select>

        {(preset === "weekly" || preset === "biweekly") && (
          <div>
            <label className="text-xs text-text-dim">
              {t("schedule.recurrence.weekdaysLabel")}
            </label>
            <div className="mt-1 flex gap-1">
              {WEEKDAYS.map((d, i) => {
                const active = weekdays.has(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      const next = new Set(weekdays);
                      if (active) next.delete(d);
                      else next.add(d);
                      setWeekdays(next);
                    }}
                    className={`h-8 w-8 rounded-full text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                      active
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                    aria-pressed={active}
                  >
                    {t(`weekday.${WEEKDAY_KEYS[i]}`)}
                  </button>
                );
              })}
            </div>
            {errWeekday && (
              <p className="mt-1 text-xs text-destructive" role="alert">
                {t("schedule.validation.weeklyNeedsWeekday")}
              </p>
            )}
          </div>
        )}

        {preset === "monthly_day" && (
          <p className="text-sm text-text-dim">
            {t("schedule.recurrence.monthDayN", {
              n: new Date(startDate + "T00:00").getDate(),
            })}
          </p>
        )}

        {preset === "monthly_nth_weekday" && (
          <div className="flex gap-2">
            <select
              value={monthNth}
              onChange={(e) => setMonthNth(parseInt(e.target.value, 10))}
              className="rounded-md border border-border bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              aria-label={t("schedule.recurrence.nthLabel")}
            >
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {t("schedule.recurrence.nthN", { n })}
                </option>
              ))}
              <option value={5}>{t("schedule.recurrence.last")}</option>
            </select>
            <select
              value={monthNthWeekday}
              onChange={(e) =>
                setMonthNthWeekday(parseInt(e.target.value, 10))
              }
              className="rounded-md border border-border bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              aria-label={t("schedule.recurrence.weekday")}
            >
              {WEEKDAYS.map((d, i) => (
                <option key={d} value={d}>
                  {t(`weekday.${WEEKDAY_KEYS[i]}`)}
                </option>
              ))}
            </select>
          </div>
        )}

        {preset !== null && (
          <>
            <DateRow
              label={t("schedule.recurrence.startDate")}
              value={startDate}
              onChange={setStartDate}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={hasEndDate}
                onChange={(e) => setHasEndDate(e.target.checked)}
              />
              {t("schedule.recurrence.hasEndDate")}
            </label>
            {hasEndDate && (
              <>
                <DateRow
                  label={t("schedule.recurrence.endDate")}
                  value={endDate}
                  onChange={setEndDate}
                />
                {errEnd && (
                  <p className="text-xs text-destructive" role="alert">
                    {t("schedule.validation.endBeforeStart")}
                  </p>
                )}
              </>
            )}
          </>
        )}
      </div>

      <div className="space-y-1 border-t border-border pt-4">
        <label className="block text-sm font-medium text-foreground">
          {t("schedule.reminder.label")}
        </label>
        <div className="flex gap-2">
          <input
            type="time"
            value={remindAt}
            onChange={(e) => setRemindAt(e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            aria-label={t("schedule.reminder.label")}
          />
          {remindAt && (
            <button
              type="button"
              onClick={() => setRemindAt("")}
              className="text-xs text-text-dim hover:text-foreground"
            >
              {t("schedule.reminder.clear")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function DateRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span className="text-foreground">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-border bg-background px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        aria-label={label}
      />
    </label>
  );
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

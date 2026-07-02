"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
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
import { composeRemindAtISO, splitRemindAtISO } from "@/lib/reminder-time";

const PRESETS: (RecurrencePreset | null)[] = [
  null,
  "daily",
  "weekdays",
  "weekly",
  "biweekly",
  "monthly_day",
  "monthly_nth_weekday",
  "yearly",
];
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const; // ISO Mon..Sun
const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

/**
 * Maps a RecurrencePreset (snake_case) to its schedule.preset.* i18n key
 * (camelCase). The i18n namespace uses camelCase: monthlyDay, monthlyNthWeekday.
 */
function presetToI18nKey(
  p: RecurrencePreset,
): "daily" | "weekdays" | "weekly" | "biweekly" | "monthlyDay" | "monthlyNthWeekday" | "yearly" {
  switch (p) {
    case "daily":
      return "daily";
    case "weekdays":
      return "weekdays";
    case "weekly":
      return "weekly";
    case "biweekly":
      return "biweekly";
    case "monthly_day":
      return "monthlyDay";
    case "monthly_nth_weekday":
      return "monthlyNthWeekday";
    case "yearly":
      return "yearly";
  }
}

interface Props {
  taskId: string;
}

export function ScheduleSection({ taskId }: Props) {
  const t = useTranslations();
  const { data, isLoading, save } = useTaskRecurrence(taskId);

  const [preset, setPreset] = useState<RecurrencePreset | null>(null);
  const [weekdays, setWeekdays] = useState<Set<number>>(new Set());
  const [monthDay, setMonthDay] = useState<number>(() => new Date().getDate());
  const [monthNth, setMonthNth] = useState(1);
  const [monthNthWeekday, setMonthNthWeekday] = useState(1);
  const [startDate, setStartDate] = useState(today());
  const [hasEndDate, setHasEndDate] = useState(false);
  const [endDate, setEndDate] = useState(today());
  const [remindAt, setRemindAt] = useState<string>(""); // "" = 不提醒
  const [didApplyServer, setDidApplyServer] = useState(false);
  // Prevents the state-change caused by the sync from triggering a redundant save.
  const skipNextSaveRef = useRef(false);

  // 絕對提醒（無重複時用）— 存 tasks.remindAt
  const { data: taskData, mutate: mutateTask } = useSWR<{ remindAt: string | null }>(
    `/api/tasks/${taskId}`,
    fetcher
  );
  const [hasReminder, setHasReminder] = useState(false);
  const [absDate, setAbsDate] = useState(today());
  const [absTime, setAbsTime] = useState("09:00");
  const [didApplyTask, setDidApplyTask] = useState(false);

  // Sync from server once on first load.
  // Flip didApplyServer as soon as SWR finishes loading (data OR null for no recurrence).
  useEffect(() => {
    if (isLoading || didApplyServer) return;
    if (data) {
      setPreset(data.preset);
      setWeekdays(parseWeekdaysCsv(data.weekdays));
      setMonthDay(data.monthDay ?? new Date(data.startDate + "T00:00").getDate());
      setMonthNth(data.monthNth ?? 1);
      setMonthNthWeekday(data.monthNthWeekday ?? 1);
      setStartDate(data.startDate);
      setHasEndDate(data.endDate !== null);
      setEndDate(data.endDate ?? today());
      setRemindAt(data.remindAtTimeOfDay ?? "");
      if (data.remindAtTimeOfDay) setHasReminder(true);
    }
    // data === null means no recurrence saved yet; keep useState defaults.
    if (data) skipNextSaveRef.current = true; // skip the save effect triggered by state updates above
    setDidApplyServer(true);
  }, [isLoading, data, didApplyServer]);

  // 從 server 同步絕對提醒（一次）
  useEffect(() => {
    if (taskData === undefined || didApplyTask) return;
    if (taskData?.remindAt) {
      const { date, time } = splitRemindAtISO(taskData.remindAt);
      setAbsDate(date);
      setAbsTime(time);
      setHasReminder(true);
      skipNextSaveRef.current = true; // skip the save effect triggered by state updates above
    }
    setDidApplyTask(true);
  }, [taskData, didApplyTask]);

  const errEnd = !validateEndAfterStart(startDate, hasEndDate ? endDate : null);
  const errWeekday = !validateWeeklyHasWeekday(
    preset ?? "",
    weekdaysToCsv(weekdays),
  );
  const isValid = !errEnd && !errWeekday;

  // Debounced save (500ms) — single timer for any field change.
  // Skip until server data has been applied (avoid overwriting unloaded card).
  // Also skip the very first fire after sync to avoid a redundant PUT.
  useEffect(() => {
    if (!didApplyServer) return;
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    if (!isValid) return;
    const timer = setTimeout(() => {
      void doSave();
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    preset,
    weekdays,
    monthDay,
    monthNth,
    monthNthWeekday,
    startDate,
    hasEndDate,
    endDate,
    remindAt,
    hasReminder,
    absDate,
    absTime,
  ]);

  async function saveAbsoluteReminder(value: string | null) {
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ remindAt: value }),
    });
    if (!res.ok) throw new Error(`PATCH remindAt failed: ${res.status}`);
    mutateTask();
  }

  async function doSave() {
    if (preset === null) {
      try {
        await save(null); // 清 recurrence
        await saveAbsoluteReminder(
          hasReminder ? composeRemindAtISO(absDate, absTime) : null
        );
      } catch {
        // Errors are surfaced by the dialog/page-level error UI; debounce
        // can't easily report up. Future: hoist error to parent.
      }
      return;
    }
    const rule: RecurrenceRule = {
      preset,
      weekdays:
        preset === "weekly" || preset === "biweekly"
          ? weekdaysToCsv(weekdays)
          : null,
      monthDay: preset === "monthly_day" ? monthDay : null,
      monthNth: preset === "monthly_nth_weekday" ? monthNth : null,
      monthNthWeekday:
        preset === "monthly_nth_weekday" ? monthNthWeekday : null,
      startDate,
      endDate: hasEndDate ? endDate : null,
      remindAtTimeOfDay: hasReminder && remindAt ? remindAt : null,
    };
    try {
      await save(rule);
      await saveAbsoluteReminder(null); // recurrence 提醒與絕對提醒互斥
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
          onChange={(e) => {
            const next = (e.target.value || null) as RecurrencePreset | null;
            setPreset(next);
            if (next !== null && hasReminder && !remindAt) setRemindAt("09:00");
          }}
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
          <select
            value={monthDay}
            onChange={(e) => setMonthDay(parseInt(e.target.value, 10))}
            className="rounded-md border border-border bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            aria-label={t("schedule.preset.monthlyDay")}
          >
            {Array.from({ length: 31 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {t("schedule.recurrence.monthDayN", { n })}
              </option>
            ))}
          </select>
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

      <div className="space-y-3 border-t border-border pt-4">
        <label className="flex items-center justify-between gap-3 text-sm font-medium text-foreground">
          {t("schedule.reminder.enabled")}
          <input
            type="checkbox"
            role="switch"
            checked={hasReminder}
            onChange={(e) => {
              setHasReminder(e.target.checked);
              if (!e.target.checked) setRemindAt("");
              if (e.target.checked && preset !== null && !remindAt) {
                setRemindAt("09:00");
              }
            }}
            aria-label={t("schedule.reminder.enabled")}
          />
        </label>

        {hasReminder && preset !== null && (
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-foreground">{t("schedule.reminder.label")}</span>
            <input
              type="time"
              value={remindAt || "09:00"}
              onChange={(e) => setRemindAt(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              aria-label={t("schedule.reminder.label")}
            />
          </div>
        )}

        {hasReminder && preset === null && (
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-foreground">{t("schedule.reminder.dateTime")}</span>
            <div className="flex gap-2">
              <input
                type="date"
                value={absDate}
                onChange={(e) => setAbsDate(e.target.value)}
                className="rounded-md border border-border bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                aria-label={t("schedule.reminder.dateTime")}
              />
              <input
                type="time"
                value={absTime}
                onChange={(e) => setAbsTime(e.target.value)}
                className="rounded-md border border-border bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                aria-label={t("schedule.reminder.dateTime")}
              />
            </div>
          </div>
        )}
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

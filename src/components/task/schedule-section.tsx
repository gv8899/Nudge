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
import {
  NudgeSwitch,
  NudgeDropdown,
  NudgeDateField,
  NudgeTimeField,
} from "@/components/ui/nudge-controls";

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

  // 絕對提醒（無重複時用）— 存 tasks.remindAt
  const { data: taskData, mutate: mutateTask } = useSWR<{ remindAt: string | null }>(
    `/api/tasks/${taskId}`,
    fetcher
  );
  const [hasReminder, setHasReminder] = useState(false);
  const [absDate, setAbsDate] = useState(today());
  const [absTime, setAbsTime] = useState("09:00");
  const [didApplyTask, setDidApplyTask] = useState(false);

  // 目前所有會被持久化的排程狀態，序列化成快照 key（與上次已存值比對，避免 hydration 觸發冗餘存檔）
  const scheduleSnapshot = () =>
    JSON.stringify([
      preset,
      [...weekdays].sort(),
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
  const lastSavedRef = useRef<string | null>(null);

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
    }
    setDidApplyTask(true);
  }, [taskData, didApplyTask]);

  // hydration 完成（兩個 sync 都套用後）時，以目前狀態當作「已存」基準。
  useEffect(() => {
    if (!didApplyServer || !didApplyTask) return;
    if (lastSavedRef.current === null) {
      lastSavedRef.current = scheduleSnapshot();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [didApplyServer, didApplyTask]);

  const errEnd = !validateEndAfterStart(startDate, hasEndDate ? endDate : null);
  const errWeekday = !validateWeeklyHasWeekday(
    preset ?? "",
    weekdaysToCsv(weekdays),
  );
  const isValid = !errEnd && !errWeekday;

  // Debounced save (500ms) — single timer for any field change.
  // Skip until both server syncs have been applied (avoid overwriting unloaded card),
  // and skip when the current state matches the last-saved snapshot (hydration, or
  // a save that already went out) to avoid a redundant PUT.
  useEffect(() => {
    if (!didApplyServer || !didApplyTask) return;
    if (lastSavedRef.current === null) return;
    if (!isValid) return;
    const snapshot = scheduleSnapshot();
    if (snapshot === lastSavedRef.current) return;
    const timer = setTimeout(() => {
      lastSavedRef.current = snapshot;
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

  // 對齊 Mac ScheduleSection.rowLabel：emphasized（重複/推播通知）=
  // sectionHeader 14/600、sub row = primaryRowTitle 14/400。
  const rowClass = "flex items-center justify-between gap-3 min-h-12 py-1";

  return (
    <div className="space-y-[18px]">
      {/* 重複 — Mac 兩張 tinted section card 之一（fg 4% + 14pt 圓角） */}
      <div className="rounded-[14px] bg-foreground/[0.04] px-[18px] py-1.5 divide-y divide-border/60">
        {/* Row 1: 重複 on/off — Mac 是 NudgeSwitch，不是下拉 */}
        <div className={rowClass}>
          <span className="text-section-header text-foreground">
            {t("schedule.recurrenceTitle")}
          </span>
          <NudgeSwitch
            checked={preset !== null}
            onChange={(on) => {
              if (on) {
                setPreset("daily");
                if (hasReminder && !remindAt) setRemindAt("09:00");
              } else {
                setPreset(null);
              }
            }}
            ariaLabel={t("schedule.recurrenceTitle")}
          />
        </div>

        {/* Row 2: 週期 dropdown（toggle 開啟後才出現，不含「不重複」） */}
        {preset !== null && (
          <div className={rowClass}>
            <span className="text-primary-row-title text-foreground">
              {t("schedule.recurrence.frequency")}
            </span>
            <NudgeDropdown
              value={preset}
              options={PRESETS.filter((p): p is RecurrencePreset => p !== null).map((p) => ({
                value: p,
                label: t(`schedule.preset.${presetToI18nKey(p)}`),
              }))}
              onChange={(next) => {
                setPreset(next);
                if (hasReminder && !remindAt) setRemindAt("09:00");
              }}
              ariaLabel={t("schedule.recurrence.frequency")}
            />
          </div>
        )}

        {(preset === "weekly" || preset === "biweekly") && (
          <div className="py-2.5">
            {/* Mac weekdaysPicker：32px 圓、active = primary 填、inactive = 透明 + border */}
            <div className="flex justify-between gap-1.5">
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
                    className={`h-8 w-8 rounded-full text-row-meta transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                      active
                        ? "bg-primary text-primary-foreground"
                        : "border border-border text-foreground hover:bg-surface-hover"
                    }`}
                    aria-pressed={active}
                  >
                    {t(`weekday.${WEEKDAY_KEYS[i]}`)}
                  </button>
                );
              })}
            </div>
            {errWeekday && (
              <p className="mt-1.5 text-row-meta text-destructive" role="alert">
                {t("schedule.validation.weeklyNeedsWeekday")}
              </p>
            )}
          </div>
        )}

        {preset === "monthly_day" && (
          <div className={rowClass}>
            <span className="text-primary-row-title text-foreground">
              {t("schedule.recurrence.monthDayLabel")}
            </span>
            <NudgeDropdown
              value={monthDay}
              options={Array.from({ length: 31 }, (_, i) => i + 1).map((n) => ({
                value: n,
                label: t("schedule.recurrence.monthDayN", { n }),
              }))}
              onChange={setMonthDay}
              ariaLabel={t("schedule.recurrence.monthDayLabel")}
            />
          </div>
        )}

        {preset === "monthly_nth_weekday" && (
          <div className={rowClass}>
            <span className="text-primary-row-title text-foreground">
              {t("schedule.recurrence.nthLabel")}
            </span>
            <div className="flex gap-1.5">
              <NudgeDropdown
                value={monthNth}
                options={[
                  ...[1, 2, 3, 4].map((n) => ({
                    value: n,
                    label: t("schedule.recurrence.nthN", { n }),
                  })),
                  { value: 5, label: t("schedule.recurrence.last") },
                ]}
                onChange={setMonthNth}
                ariaLabel={t("schedule.recurrence.nthLabel")}
              />
              <NudgeDropdown
                value={monthNthWeekday}
                options={WEEKDAYS.map((d, i) => ({
                  value: d,
                  label: t(`weekday.${WEEKDAY_KEYS[i]}`),
                }))}
                onChange={setMonthNthWeekday}
                ariaLabel={t("schedule.recurrence.weekday")}
              />
            </div>
          </div>
        )}

        {preset !== null && (
          <>
            <div className={rowClass}>
              <span className="text-primary-row-title text-foreground">
                {t("schedule.recurrence.startDate")}
              </span>
              <NudgeDateField
                value={startDate}
                onChange={setStartDate}
                ariaLabel={t("schedule.recurrence.startDate")}
              />
            </div>
            <div className={rowClass}>
              <span className="text-primary-row-title text-foreground">
                {t("schedule.recurrence.hasEndDate")}
              </span>
              <NudgeSwitch
                checked={hasEndDate}
                onChange={setHasEndDate}
                ariaLabel={t("schedule.recurrence.hasEndDate")}
              />
            </div>
            {hasEndDate && (
              <div>
                <div className={rowClass}>
                  <span className="text-primary-row-title text-foreground">
                    {t("schedule.recurrence.endDate")}
                  </span>
                  <NudgeDateField
                    value={endDate}
                    onChange={setEndDate}
                    ariaLabel={t("schedule.recurrence.endDate")}
                  />
                </div>
                {errEnd && (
                  <p className="pb-2 text-row-meta text-destructive" role="alert">
                    {t("schedule.validation.endBeforeStart")}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* 推播通知 — 第二張 section card */}
      <div className="rounded-[14px] bg-foreground/[0.04] px-[18px] py-1.5 divide-y divide-border/60">
        <div className={rowClass}>
          <span className="text-section-header text-foreground">
            {t("schedule.reminder.enabled")}
          </span>
          <NudgeSwitch
            checked={hasReminder}
            onChange={(on) => {
              setHasReminder(on);
              if (!on) setRemindAt("");
              if (on && preset !== null && !remindAt) setRemindAt("09:00");
            }}
            ariaLabel={t("schedule.reminder.enabled")}
          />
        </div>

        {hasReminder && preset !== null && (
          <div className={rowClass}>
            <span className="text-primary-row-title text-foreground">
              {t("schedule.reminder.label")}
            </span>
            <NudgeTimeField
              value={remindAt || "09:00"}
              onChange={setRemindAt}
              ariaLabel={t("schedule.reminder.label")}
            />
          </div>
        )}

        {hasReminder && preset === null && (
          <div className={rowClass}>
            <span className="text-primary-row-title text-foreground">
              {t("schedule.reminder.dateTime")}
            </span>
            <div className="flex gap-1.5">
              <NudgeDateField
                value={absDate}
                onChange={setAbsDate}
                ariaLabel={t("schedule.reminder.dateTime")}
              />
              <NudgeTimeField
                value={absTime}
                onChange={setAbsTime}
                ariaLabel={t("schedule.reminder.dateTime")}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

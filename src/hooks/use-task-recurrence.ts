"use client";

import useSWR, { mutate as globalMutate } from "swr";

export type RecurrencePreset =
  | "daily"
  | "weekdays"
  | "weekly"
  | "biweekly"
  | "monthly_day"
  | "monthly_nth_weekday"
  | "yearly";

export interface TaskRecurrence {
  id: string;
  taskId: string;
  preset: RecurrencePreset;
  weekdays: string | null;       // CSV "1,3,5" — ISO weekday 1=Mon..7=Sun
  monthDay: number | null;       // 1-31
  monthNth: number | null;       // 1-5 (5 = last)
  monthNthWeekday: number | null; // 1-7
  startDate: string;             // YYYY-MM-DD
  endDate: string | null;        // YYYY-MM-DD | null
  remindAtTimeOfDay: string | null; // HH:MM | null
  createdAt: string;
  updatedAt: string;
}

export type RecurrenceRule = Omit<
  TaskRecurrence,
  "id" | "taskId" | "createdAt" | "updatedAt"
>;

/** SWR cache key for a given task's recurrence. Exported for cross-module mutation. */
export function taskRecurrenceKey(taskId: string): string {
  return `/api/tasks/${taskId}/recurrence`;
}

export function useTaskRecurrence(taskId: string | null) {
  const { data, error, isLoading } = useSWR<TaskRecurrence | null>(
    taskId ? taskRecurrenceKey(taskId) : null,
    async (url: string) => {
      const res = await fetch(url);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`GET recurrence failed: ${res.status}`);
      return (await res.json()) as TaskRecurrence;
    },
  );

  /**
   * Save recurrence rule. `null` clears (no recurrence).
   * Uses PUT (replace), matching backend route shape.
   * Throws if `taskId` is null or PUT fails — caller should handle.
   */
  async function save(rule: RecurrenceRule | null) {
    if (!taskId) throw new Error("no taskId");
    const url = taskRecurrenceKey(taskId);
    try {
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rule), // null clears
      });
      if (!res.ok) throw new Error(`PUT failed: ${res.status}`);
      await globalMutate(url);
    } catch (err) {
      await globalMutate(url);
      throw err;
    }
  }

  return { data, error, isLoading, save };
}

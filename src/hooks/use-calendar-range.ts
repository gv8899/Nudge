"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import type { EventsResponse, CalendarEvent } from "@/lib/google-calendar/types";

function getUserTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function localDateOf(e: CalendarEvent): string {
  const d = new Date(e.start);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 抓任意起迄區間的事件（週/月檢視用），並預先依 local 日期分組。 */
export function useCalendarRange(start: string, end: string) {
  const tz = getUserTz();
  const key = `/api/calendar/events?date=${start}&endDate=${end}&tz=${encodeURIComponent(tz)}`;
  const { data, error, isLoading, mutate } = useSWR<EventsResponse>(key, fetcher, {
    revalidateOnMount: true,
    revalidateOnFocus: true,
    dedupingInterval: 5 * 60 * 1000,
    shouldRetryOnError: false,
  });

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    if (data?.connected) {
      for (const e of data.events) {
        const k = localDateOf(e);
        const arr = map.get(k) ?? [];
        arr.push(e);
        map.set(k, arr);
      }
    }
    return map;
  }, [data]);

  return { data, eventsByDate, error, isLoading, refresh: () => mutate() };
}

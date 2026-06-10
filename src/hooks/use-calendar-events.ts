"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import type { EventsResponse, CalendarEvent } from "@/lib/google-calendar/types";
import { weekRange } from "@/lib/calendar-dates";

function getUserTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/**
 * 以「週」為單位抓事件，切日在 SWR 快取內 instant。
 * 輸入當日 YYYY-MM-DD，回傳：當日事件 + loading/error + refresh。
 */
export function useCalendarEvents(date: string) {
  const tz = getUserTz();
  const { start, end } = useMemo(() => weekRange(date), [date]);

  const key = `/api/calendar/events?date=${start}&endDate=${end}&tz=${encodeURIComponent(tz)}`;
  const { data, error, isLoading, mutate } = useSWR<EventsResponse>(key, fetcher, {
    // 同一週內切日都共用快取；一週資料 5 分鐘內算新鮮
    keepPreviousData: false,
    revalidateOnMount: true,
    revalidateOnFocus: true,
    dedupingInterval: 5 * 60 * 1000,
    shouldRetryOnError: false,
  });

  const filtered = useMemo<EventsResponse | undefined>(() => {
    if (!data) return data;
    if (!data.connected) return data;
    const events: CalendarEvent[] = data.events.filter((e) => {
      // 用 local 日期字串比對開始時間
      const d = new Date(e.start);
      const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return local === date;
    });
    return { connected: true, events };
  }, [data, date]);

  return { data: filtered, error, isLoading, refresh: () => mutate() };
}

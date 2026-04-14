"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import type { EventsResponse } from "@/lib/google-calendar/types";

function getUserTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function useCalendarEvents(date: string) {
  const tz = getUserTz();
  const key = `/api/calendar/events?date=${date}&tz=${encodeURIComponent(tz)}`;
  const { data, error, isLoading, mutate } = useSWR<EventsResponse>(key, fetcher, {
    // 不用快取 — 每次進頁面都重新打 API
    keepPreviousData: false,
    revalidateOnMount: true,
    revalidateIfStale: true,
    revalidateOnFocus: true,
    dedupingInterval: 0,
    shouldRetryOnError: false,
  });

  return { data, error, isLoading, refresh: () => mutate() };
}

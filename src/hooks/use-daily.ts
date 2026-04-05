import useSWR from "swr";
import type { DailyData } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useDaily(date: string) {
  const { data, error, isLoading, mutate } = useSWR<DailyData>(
    `/api/daily/${date}`,
    fetcher
  );

  return {
    data,
    error,
    isLoading,
    mutate,
  };
}

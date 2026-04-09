import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import type { DailyData } from "@/lib/types";

export function useDaily(date: string) {
  const { data, error, isLoading, mutate } = useSWR<DailyData>(
    `/api/daily/${date}`,
    fetcher,
    {
      keepPreviousData: true,
      shouldRetryOnError: false,
    }
  );

  return {
    data,
    error,
    isLoading,
    mutate,
  };
}

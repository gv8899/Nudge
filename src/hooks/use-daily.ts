import useSWR from "swr";
import type { DailyData } from "@/lib/types";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const err = new Error(`API error: ${res.status}`);
    (err as any).status = res.status;
    throw err;
  }
  return res.json();
};

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

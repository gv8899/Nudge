import useSWR from "swr";
import type { DailyData } from "@/lib/types";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 401) {
      window.location.href = "/login";
      throw new Error("Unauthorized");
    }
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
};

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

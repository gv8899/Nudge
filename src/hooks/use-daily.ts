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
      // Smart polling — 每 30s 檢查；server 回 304 時瀏覽器 HTTP cache
      // 自動命中（Cache-Control: no-cache + ETag），SWR 拿到「相同資料」
      // 不會 re-render。
      refreshInterval: 30000,
      refreshWhenHidden: false,
      refreshWhenOffline: false,
    }
  );

  return {
    data,
    error,
    isLoading,
    mutate,
  };
}

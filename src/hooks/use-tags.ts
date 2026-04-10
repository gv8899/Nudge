"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";

export interface Tag {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
}

interface TagsResponse {
  tags: Tag[];
}

export function useTags() {
  const { data, error, isLoading, mutate } = useSWR<TagsResponse>(
    "/api/tags",
    fetcher
  );

  return {
    tags: data?.tags || [],
    isLoading,
    error,
    mutate,
  };
}

"use client";

import useSWRInfinite from "swr/infinite";
import { fetcher } from "@/lib/fetcher";

export interface CardItem {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  tags: Array<{ id: string; name: string; color: string }>;
}

interface CardsPage {
  cards: CardItem[];
  nextCursor: string | null;
}

export function useCardsFeed(query: string, tagIds: string[] = []) {
  // Stable key for the tag filter — sort so [a,b] and [b,a] share a cache entry
  const tagsKey = [...tagIds].sort().join(",");
  const getKey = (pageIndex: number, prev: CardsPage | null) => {
    if (prev && !prev.nextCursor) return null;
    const cursor = prev ? prev.nextCursor : undefined;
    const params = new URLSearchParams({ limit: "20" });
    if (cursor) params.set("cursor", cursor);
    if (query) params.set("q", query);
    if (tagsKey) params.set("tagIds", tagsKey);
    return `/api/cards?${params.toString()}`;
  };

  const { data, error, size, setSize, isLoading, isValidating, mutate } =
    useSWRInfinite<CardsPage>(getKey, fetcher, {
      revalidateFirstPage: false,
    });

  const cards = data ? data.flatMap((page) => page.cards) : [];
  const hasMore = data ? data[data.length - 1]?.nextCursor !== null : false;
  const isLoadingMore =
    isLoading || (size > 0 && data && typeof data[size - 1] === "undefined");

  return {
    cards,
    isLoading,
    isLoadingMore: !!isLoadingMore,
    isValidating,
    hasMore,
    loadMore: () => setSize(size + 1),
    mutate,
    error,
  };
}

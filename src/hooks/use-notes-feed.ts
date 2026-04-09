import useSWRInfinite from "swr/infinite";
import { fetcher } from "@/lib/fetcher";

interface NoteItem {
  id: string;
  date: string;
  content: string;
  createdAt: string;
}

interface FeedPage {
  notes: NoteItem[];
  nextCursor: string | null;
}

export function useNotesFeed(excludeDate?: string) {
  const getKey = (pageIndex: number, prev: FeedPage | null) => {
    if (prev && !prev.nextCursor) return null;
    const cursor = prev ? prev.nextCursor : undefined;
    const params = new URLSearchParams({ limit: "10" });
    if (cursor) params.set("cursor", cursor);
    return `/api/notes/feed?${params.toString()}`;
  };

  const { data, error, size, setSize, isLoading, isValidating, mutate } =
    useSWRInfinite<FeedPage>(getKey, fetcher, {
      revalidateFirstPage: false,
    });

  const allNotes = data ? data.flatMap((page) => page.notes) : [];
  const notes = excludeDate
    ? allNotes.filter((n) => n.date !== excludeDate)
    : allNotes;

  const hasMore = data ? data[data.length - 1]?.nextCursor !== null : false;
  const isLoadingMore =
    isLoading || (size > 0 && data && typeof data[size - 1] === "undefined");

  return {
    notes,
    isLoading,
    isLoadingMore: !!isLoadingMore,
    isValidating,
    hasMore,
    loadMore: () => setSize(size + 1),
    mutate,
    error,
  };
}

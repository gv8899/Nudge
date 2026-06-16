import { mutate } from "swr";

/**
 * Revalidate all pages of the notes feed cache.
 * Called after a canvas save succeeds so the feed reflects new/updated entries.
 */
export function revalidateNotesFeed() {
  mutate(
    (key) => typeof key === "string" && key.startsWith("/api/notes/feed"),
    undefined,
    { revalidate: true }
  );
}

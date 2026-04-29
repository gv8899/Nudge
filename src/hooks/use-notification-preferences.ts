"use client";

import useSWR, { mutate as globalMutate } from "swr";
import { fetcher } from "@/lib/fetcher";

export type NotificationContent = "summary" | "incomplete" | "summary_streak";

export interface NotificationPreferences {
  userId: string;
  morningEnabled: boolean;
  morningTime: string;       // "HH:MM"
  morningContent: NotificationContent;
  eveningEnabled: boolean;
  eveningTime: string;       // "HH:MM"
  eveningContent: NotificationContent;
  perTaskRemindersEnabled: boolean;
  updatedAt: string;
}

/** SWR cache key. Exported so callers can invalidate from anywhere. */
export const NOTIFICATION_PREFERENCES_KEY = "/api/notification-preferences";

export function useNotificationPreferences() {
  const { data, error, isLoading } = useSWR<NotificationPreferences>(
    NOTIFICATION_PREFERENCES_KEY,
    fetcher,
  );

  /**
   * Patch one or more fields. Optimistically updates SWR cache then PATCHes;
   * on error, revalidates to get the canonical state back and rethrows so the
   * caller can show feedback.
   *
   * Throws Error("not loaded") if called before initial GET resolves — caller
   * should disable inputs until `data` is non-null.
   */
  async function patch(updates: Partial<NotificationPreferences>) {
    if (!data) throw new Error("not loaded");
    const optimistic = { ...data, ...updates };
    await globalMutate(NOTIFICATION_PREFERENCES_KEY, optimistic, { revalidate: false });
    try {
      const res = await fetch(NOTIFICATION_PREFERENCES_KEY, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error(`PATCH failed: ${res.status}`);
      const fresh = (await res.json()) as NotificationPreferences;
      await globalMutate(NOTIFICATION_PREFERENCES_KEY, fresh, { revalidate: false });
    } catch (err) {
      await globalMutate(NOTIFICATION_PREFERENCES_KEY); // revalidate to canonical
      throw err;
    }
  }

  return { data, error, isLoading, patch };
}

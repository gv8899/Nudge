"use client";

import { useState } from "react";
import useSWR from "swr";
import { useTranslations } from "next-intl";
import { fetcher } from "@/lib/fetcher";
import type { CalendarsResponse } from "@/lib/google-calendar/types";

export function CalendarSection({ userEmail }: { userEmail: string }) {
  const t = useTranslations("calendar");
  const { data, isLoading, mutate } = useSWR<
    CalendarsResponse | { error: string }
  >("/api/calendar/calendars", fetcher, { shouldRetryOnError: false });

  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const isConnected =
    data !== undefined && "calendars" in data && Array.isArray(data.calendars);

  async function toggleCalendar(id: string, selected: boolean) {
    if (!isConnected) return;
    const current = new Set((data as CalendarsResponse).selectedIds);
    if (selected) current.add(id);
    else current.delete(id);
    const next = Array.from(current);
    await fetch("/api/calendar/calendars", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selectedIds: next }),
    });
    mutate({ ...(data as CalendarsResponse), selectedIds: next }, { revalidate: false });
  }

  async function disconnect() {
    await fetch("/api/calendar/disconnect", { method: "POST" });
    setConfirmDisconnect(false);
    mutate();
  }

  return (
    <section className="py-4">
      <h3 className="text-xs font-bold uppercase tracking-wider text-text-dim mb-3">
        {t("section")}
      </h3>

      {isLoading && <div className="text-xs text-text-dim">{t("panelLoading")}</div>}

      {!isLoading && !isConnected && (
        <div>
          <div className="text-xs text-text-dim mb-2">{t("connectDescription")}</div>
          <a
            href="/api/calendar/connect"
            className="inline-block rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
          >
            {t("connectButton")}
          </a>
        </div>
      )}

      {isConnected && (
        <div className="space-y-3">
          <div className="text-xs text-text-dim">
            {t("connectedAs", { email: userEmail })}
          </div>

          <div>
            <div className="text-xs text-text-faint uppercase tracking-wide mb-1">
              {t("subCalendars")}
            </div>
            <div className="space-y-1">
              {(data as CalendarsResponse).calendars.map((cal) => {
                const selectedIds = (data as CalendarsResponse).selectedIds;
                // "primary" 是 Google API 的別名，對應到 primary calendar 的實際 id
                const checked =
                  selectedIds.includes(cal.id) ||
                  (cal.primary && selectedIds.includes("primary"));
                return (
                  <label
                    key={cal.id}
                    className="flex items-center gap-2 text-sm text-foreground cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => toggleCalendar(cal.id, e.target.checked)}
                    />
                    {cal.backgroundColor && (
                      <span
                        className="inline-block w-3 h-3 rounded-sm"
                        style={{ background: cal.backgroundColor }}
                      />
                    )}
                    <span>{cal.summary}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {!confirmDisconnect ? (
            <button
              type="button"
              onClick={() => setConfirmDisconnect(true)}
              className="text-sm text-destructive hover:underline"
            >
              {t("disconnectButton")}
            </button>
          ) : (
            <div className="rounded-md border border-border p-3 space-y-2">
              <div className="text-sm text-foreground">{t("disconnectConfirmBody")}</div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={disconnect}
                  className="rounded-md bg-destructive px-3 py-1 text-sm text-primary-foreground"
                >
                  {t("disconnectButton")}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDisconnect(false)}
                  className="rounded-md border border-border px-3 py-1 text-sm"
                >
                  ×
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

"use client";

import { useState } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { useTranslations } from "next-intl";
import { fetcher } from "@/lib/fetcher";
import type { CalendarsResponse } from "@/lib/google-calendar/types";

export function CalendarSection() {
  const t = useTranslations("calendar");
  const { data, isLoading } = useSWR<
    CalendarsResponse | { error: string }
  >("/api/calendar/calendars", fetcher, { shouldRetryOnError: false });

  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const isConnected =
    data !== undefined && "calendars" in data && Array.isArray(data.calendars);

  // 使用 primary calendar 的 id（就是日曆擁有者的 email）
  const linkedEmail = isConnected
    ? (data as CalendarsResponse).calendars.find((c) => c.primary)?.id ?? ""
    : "";

  async function disconnect() {
    await fetch("/api/calendar/disconnect", { method: "POST" });
    setConfirmDisconnect(false);
    // 清掉所有 /api/calendar/* SWR cache（settings + Tasks 頁面的 CalendarPanel）
    globalMutate(
      (key) => typeof key === "string" && key.startsWith("/api/calendar"),
      undefined,
      { revalidate: true }
    );
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
            {t("connectedAs", { email: linkedEmail })}
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

"use client";

import { useState } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { useTranslations } from "next-intl";
import { fetcher } from "@/lib/fetcher";
import type { CalendarsResponse } from "@/lib/google-calendar/types";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SettingsRow, SettingsActionRow } from "./settings-primitives";

export function CalendarSection() {
  const t = useTranslations("calendar");
  const { data, isLoading } = useSWR<
    CalendarsResponse | { error: string }
  >("/api/calendar/calendars", fetcher, { shouldRetryOnError: false });

  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  // A33: inline spinner on the connect button — was a bare <a> with no
  // feedback while the browser navigates to the OAuth redirect.
  const [isConnecting, setIsConnecting] = useState(false);

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

  function handleConnect() {
    setIsConnecting(true);
    window.location.href = "/api/calendar/connect";
  }

  if (isLoading) {
    return <SettingsRow>{t("panelLoading")}</SettingsRow>;
  }

  if (isConnected) {
    return (
      <>
        <SettingsRow>
          <span className="block truncate">{t("connectedAs", { email: linkedEmail })}</span>
        </SettingsRow>
        <SettingsActionRow role="destructive" onClick={() => setConfirmDisconnect(true)}>
          {t("disconnectButton")}
        </SettingsActionRow>
        <ConfirmDialog
          open={confirmDisconnect}
          onOpenChange={setConfirmDisconnect}
          title={t("disconnectConfirmTitle")}
          description={t("disconnectConfirmBody")}
          confirmLabel={t("disconnectButton")}
          onConfirm={disconnect}
        />
      </>
    );
  }

  return (
    <>
      <SettingsRow>{t("connectDescription")}</SettingsRow>
      <SettingsActionRow role="primary" loading={isConnecting} onClick={handleConnect}>
        {t("connectButton")}
      </SettingsActionRow>
    </>
  );
}

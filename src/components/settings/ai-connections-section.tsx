"use client";

import { useState, useSyncExternalStore } from "react";
import useSWR from "swr";
import { useLocale, useTranslations } from "next-intl";
import { Copy, Check } from "lucide-react";
import { fetcher } from "@/lib/fetcher";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SettingsRow } from "./settings-primitives";

interface Connection {
  id: string;
  clientName: string | null;
  clientId: string;
  createdAt: string;
  lastUsedAt: string | null;
}

const noopSubscribe = () => () => {};

/** 設定頁：MCP 連接器網址 + 已連線的 AI 服務（可中斷）。 */
export function AiConnectionsSection() {
  const t = useTranslations("settings.aiConnections");
  const locale = useLocale();
  const { data, mutate } = useSWR<{ connections: Connection[] }>(
    "/api/oauth/connections",
    fetcher,
  );
  const [pending, setPending] = useState<Connection | null>(null);
  const [copied, setCopied] = useState(false);

  // 用目前網域組網址（prod = nudge.tw）；SSR 時給空字串，避免 hydration 不一致。
  const mcpUrl = useSyncExternalStore(
    noopSubscribe,
    () => `${window.location.origin}/api/mcp`,
    () => "",
  );
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" });

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(mcpUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 剪貼簿被拒時使用者仍可手動選取網址
    }
  }

  async function disconnect() {
    if (!pending) return;
    await fetch("/api/oauth/connections", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: pending.id }),
    });
    setPending(null);
    mutate();
  }

  const connections = data?.connections ?? [];

  return (
    <>
      <SettingsRow>
        <div className="min-w-0 space-y-2">
          <span className="block text-text-dim">{t("description")}</span>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-2 py-1 text-row-meta text-foreground select-all">
              {mcpUrl}
            </code>
            <button
              type="button"
              onClick={copyUrl}
              aria-label={copied ? t("copied") : t("copy")}
              className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-row-meta text-text-dim hover:bg-surface-hover hover:text-foreground"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? t("copied") : t("copy")}
            </button>
          </div>
        </div>
      </SettingsRow>

      {data && connections.length === 0 && (
        <SettingsRow>
          <span className="text-text-dim">{t("empty")}</span>
        </SettingsRow>
      )}

      {connections.map((c) => (
        <SettingsRow
          key={c.id}
          trailing={
            <button
              type="button"
              onClick={() => setPending(c)}
              className="text-row-title text-destructive hover:underline"
            >
              {t("disconnect")}
            </button>
          }
        >
          <div className="min-w-0 space-y-0.5">
            <span className="block truncate">{c.clientName ?? t("unnamedClient")}</span>
            <span className="block text-row-meta text-text-dim">
              {t("connectedAt", { date: fmt(c.createdAt) })}
              {" · "}
              {c.lastUsedAt ? t("lastUsed", { date: fmt(c.lastUsedAt) }) : t("neverUsed")}
            </span>
          </div>
        </SettingsRow>
      ))}

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title={t("disconnectConfirmTitle", { client: pending?.clientName ?? t("unnamedClient") })}
        description={t("disconnectConfirmBody")}
        confirmLabel={t("disconnect")}
        onConfirm={disconnect}
      />
    </>
  );
}

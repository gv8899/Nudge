"use client";

import useSWR, { useSWRConfig } from "swr";
import { useTranslations } from "next-intl";
import { signOut } from "next-auth/react";
import { Sun, Moon, Monitor, LogOut } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTheme, type Theme } from "@/components/providers/theme-provider";
import { useRouter, usePathname, type Locale } from "@/i18n/routing";
import { fetcher } from "@/lib/fetcher";
import { TagManager } from "@/components/tags/tag-manager";
import { format, parseISO } from "date-fns";

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface MeResponse {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  locale: Locale | null;
  createdAt: string;
}

const themeOptions: { value: Theme; key: "light" | "dark" | "system"; Icon: typeof Sun }[] = [
  { value: "light", key: "light", Icon: Sun },
  { value: "dark", key: "dark", Icon: Moon },
  { value: "system", key: "system", Icon: Monitor },
];

const LOCALE_OPTIONS: {
  key: "zhTW" | "en" | "ja" | "auto";
  value: Locale | null;
}[] = [
  { key: "zhTW", value: "zh-TW" },
  { key: "en", value: "en" },
  { key: "ja", value: "ja" },
  { key: "auto", value: null },
];

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const t = useTranslations("settings");
  const { data: me } = useSWR<MeResponse>(open ? "/api/me" : null, fetcher);
  const { theme, setTheme, paperTexture, setPaperTexture } = useTheme();
  const paperOn = paperTexture === "on";
  const router = useRouter();
  const pathname = usePathname();
  const { mutate } = useSWRConfig();

  const handleSignOut = () => {
    signOut({ callbackUrl: "/login" });
  };

  async function handleLocaleChange(value: Locale | null) {
    try {
      const res = await fetch("/api/me/locale", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: value }),
      });
      if (!res.ok) throw new Error("patch failed");
      await mutate("/api/me");
      if (value === null) {
        window.location.href = "/";
      } else {
        router.replace(pathname, { locale: value });
      }
    } catch {
      alert(t("language.updateFailed"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogTitle className="text-lg font-semibold">{t("title")}</DialogTitle>

        <div className="divide-y divide-border">
          {/* 帳號資料 */}
          <section className="py-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-dim mb-3">
              {t("account.section")}
            </h3>
            {me ? (
              <div className="flex items-center gap-3">
                {me.avatarUrl ? (
                  <img
                    src={me.avatarUrl}
                    alt=""
                    className="h-12 w-12 rounded-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-foreground font-medium">
                    {(me.name || me.email)[0].toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">
                    {me.name || t("account.unnamed")}
                  </div>
                  <div className="text-xs text-text-dim truncate">{me.email}</div>
                  <div className="text-xs text-text-faint mt-0.5">
                    {t("account.joinedAt", { date: format(parseISO(me.createdAt), "yyyy/MM/dd") })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-12 animate-pulse rounded bg-muted" />
            )}
          </section>

          {/* 主題切換 */}
          <section className="py-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-dim mb-3">
              {t("theme.section")}
            </h3>
            <div
              role="radiogroup"
              aria-label={t("theme.section")}
              className="grid grid-cols-3 gap-2"
            >
              {themeOptions.map(({ value, key, Icon }) => {
                const active = theme === value;
                return (
                  <button
                    key={value}
                    role="radio"
                    aria-checked={active}
                    onClick={() => setTheme(value)}
                    className={`flex flex-col items-center gap-1.5 rounded-lg border px-3 py-3 text-xs transition-colors ${
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-text-dim hover:border-border-light hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {t(`theme.${key}`)}
                  </button>
                );
              })}
            </div>
          </section>

          {/* 語言切換 */}
          <section className="py-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-dim mb-3">
              {t("language.section")}
            </h3>
            <div
              role="radiogroup"
              aria-label={t("language.section")}
              className="flex rounded-lg border border-border p-0.5 gap-0.5"
            >
              {LOCALE_OPTIONS.map(({ key, value }) => {
                const active =
                  value === null ? !me?.locale : me?.locale === value;
                return (
                  <button
                    key={key}
                    role="radio"
                    aria-checked={active}
                    onClick={() => handleLocaleChange(value)}
                    className={`flex-1 px-2 py-1.5 text-xs rounded-md transition-colors ${
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-text-dim hover:text-foreground"
                    }`}
                  >
                    {t(`language.${key}`)}
                  </button>
                );
              })}
            </div>
          </section>

          {/* 紙質感開關 */}
          <section className="py-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-dim mb-3">
              {t("appearance.section")}
            </h3>
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm text-foreground">{t("appearance.paperLabel")}</div>
                <div className="text-xs text-text-dim mt-0.5">{t("appearance.paperDesc")}</div>
              </div>
              <button
                role="switch"
                aria-checked={paperOn}
                aria-label={t("appearance.paperLabel")}
                onClick={() => setPaperTexture(paperOn ? "off" : "on")}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                  paperOn ? "bg-primary" : "bg-border"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 rounded-full bg-background shadow transform transition-transform ${
                    paperOn ? "translate-x-[22px]" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
          </section>

          {/* 標籤管理 */}
          <section className="py-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-dim mb-3">
              {t("tags.section")}
            </h3>
            <TagManager />
          </section>

          {/* 登出 */}
          <section className="py-4">
            <button
              onClick={handleSignOut}
              className="flex items-center justify-center gap-2 w-full px-4 py-2 rounded-lg border border-destructive/40 text-destructive hover:bg-destructive/10 transition-colors text-sm font-medium"
            >
              <LogOut className="h-4 w-4" />
              {t("logout.button")}
            </button>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

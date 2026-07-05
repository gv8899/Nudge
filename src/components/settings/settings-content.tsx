"use client";

import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { useTranslations } from "next-intl";
import { signOut } from "next-auth/react";
import {
  UserCircle,
  CreditCard,
  Calendar,
  Palette,
  Globe,
  Tag,
  AlertTriangle,
  ChevronsUpDown,
} from "lucide-react";
import { useTheme, type Theme } from "@/components/providers/theme-provider";
import { useRouter, usePathname, type Locale } from "@/i18n/routing";
import { fetcher } from "@/lib/fetcher";
import { TagManager } from "@/components/tags/tag-manager";
import { CalendarSection } from "./calendar-section";
import { SubscriptionSection } from "./subscription-section";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SettingsGroup, SettingsRow, SettingsActionRow } from "./settings-primitives";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import pkg from "../../../package.json";

interface MeResponse {
  id: string;
  email: string;
  name: string | null;
  locale: Locale | null;
}

// 對齊 Mac NudgeTheme.allCases 順序（UserPreferences.swift:4）。
const THEME_OPTIONS: Theme[] = ["system", "light", "dark"];

// 對齊 Mac NudgeLanguage.allCases 順序（UserPreferences.swift:17）。
const LOCALE_OPTIONS: {
  key: "auto" | "zhTW" | "en" | "ja";
  value: Locale | null;
}[] = [
  { key: "auto", value: null },
  { key: "zhTW", value: "zh-TW" },
  { key: "en", value: "en" },
  { key: "ja", value: "ja" },
];

/** Trigger row shared by theme/language: current value + chevrons icon. */
function DropdownTrigger({ label }: { label: string }) {
  return (
    <DropdownMenuTrigger className="flex items-center gap-1.5 text-row-title text-foreground outline-none">
      {label}
      <ChevronsUpDown className="h-3.5 w-3.5 text-text-dim" aria-hidden />
    </DropdownMenuTrigger>
  );
}

export function SettingsContent() {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const tBilling = useTranslations("billing");
  const tCalendar = useTranslations("calendar");
  const { data: me } = useSWR<MeResponse>("/api/me", fetcher);
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const { mutate } = useSWRConfig();

  // Logout confirm state
  const [confirmLogout, setConfirmLogout] = useState(false);

  // Clean untitled state
  const [confirmClean, setConfirmClean] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [cleanResult, setCleanResult] = useState<string | null>(null);

  // Delete account state
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(false);

  const handleSignOut = () => {
    signOut({ callbackUrl: "/login" });
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    setDeleteError(false);
    try {
      const res = await fetch("/api/me", { method: "DELETE" });
      if (!res.ok) throw new Error(`delete failed: ${res.status}`);
      // 帳號已刪 — 登出並回登入頁
      await signOut({ callbackUrl: "/login" });
    } catch {
      setIsDeleting(false);
      setDeleteError(true);
      setConfirmDelete(false);
    }
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

  async function handleCleanUntitled() {
    if (isCleaning) return;
    setIsCleaning(true);
    setCleanResult(null);
    try {
      const res = await fetch("/api/cards/untitled", { method: "DELETE" });
      if (!res.ok) throw new Error("failed");
      const { deleted } = await res.json();
      setConfirmClean(false);
      setCleanResult(
        deleted > 0
          ? t("cleanUntitled.successWithCount", { count: deleted })
          : t("cleanUntitled.successEmpty")
      );
    } catch {
      setConfirmClean(false);
      setCleanResult(t("cleanUntitled.failed"));
    } finally {
      setIsCleaning(false);
    }
  }

  const currentLocaleKey = LOCALE_OPTIONS.find(
    (opt) => opt.value === (me?.locale ?? null)
  )?.key ?? "auto";

  return (
    <div className="space-y-6">
      {/* 帳號資料 — R18：Email/Name 兩行 key-value（移除 avatar/加入日期） */}
      <SettingsGroup icon={UserCircle} title={t("account.section")}>
        {me ? (
          <>
            <SettingsRow trailing={<span className="text-text-dim truncate">{me.email}</span>}>
              {t("account.email")}
            </SettingsRow>
            <SettingsRow
              trailing={
                me.name ? (
                  <span className="text-text-dim truncate">{me.name}</span>
                ) : (
                  <span className="text-text-faint">{t("account.unnamed")}</span>
                )
              }
            >
              {t("account.name")}
            </SettingsRow>
          </>
        ) : (
          <SettingsRow>
            <span className="text-text-dim">…</span>
          </SettingsRow>
        )}
      </SettingsGroup>

      {/* 訂閱 / 兌換碼 */}
      <SettingsGroup icon={CreditCard} title={tBilling("section")}>
        <SubscriptionSection />
      </SettingsGroup>

      {/* 日曆連接 */}
      <SettingsGroup icon={Calendar} title={tCalendar("section")}>
        <CalendarSection />
      </SettingsGroup>

      {/* 外觀（= theme picker 一區，對齊 Mac；紙紋理已移除） */}
      <SettingsGroup icon={Palette} title={t("appearance.section")}>
        <SettingsRow
          trailing={
            <DropdownMenu>
              <DropdownTrigger label={t(`theme.${theme}`)} />
              <DropdownMenuContent align="end">
                <DropdownMenuRadioGroup
                  value={theme}
                  onValueChange={(v) => setTheme(v as Theme)}
                >
                  {THEME_OPTIONS.map((opt) => (
                    <DropdownMenuRadioItem key={opt} value={opt} closeOnClick>
                      {t(`theme.${opt}`)}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          }
        >
          {t("theme.section")}
        </SettingsRow>
      </SettingsGroup>

      {/* 語言 */}
      <SettingsGroup icon={Globe} title={t("language.section")}>
        <SettingsRow
          trailing={
            <DropdownMenu>
              <DropdownTrigger label={t(`language.${currentLocaleKey}`)} />
              <DropdownMenuContent align="end">
                <DropdownMenuRadioGroup
                  value={currentLocaleKey}
                  onValueChange={(v) => {
                    const opt = LOCALE_OPTIONS.find((o) => o.key === v);
                    if (opt) handleLocaleChange(opt.value);
                  }}
                >
                  {LOCALE_OPTIONS.map((opt) => (
                    <DropdownMenuRadioItem key={opt.key} value={opt.key} closeOnClick>
                      {t(`language.${opt.key}`)}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          }
        >
          {t("language.section")}
        </SettingsRow>
      </SettingsGroup>

      {/* 標籤管理 */}
      <SettingsGroup icon={Tag} title={t("tags.section")}>
        <TagManager />
      </SettingsGroup>

      {/* 危險區 — 對齊 Mac：登出 → 清空白卡片 → 刪除帳號，純紅字整列 action row */}
      <div className="space-y-2">
        <SettingsGroup icon={AlertTriangle} title={t("dangerZone.section")}>
          <SettingsActionRow role="destructive" onClick={() => setConfirmLogout(true)}>
            {t("logout.button")}
          </SettingsActionRow>
          <SettingsActionRow
            role="destructive"
            loading={isCleaning}
            onClick={() => setConfirmClean(true)}
          >
            {isCleaning ? t("cleanUntitled.labelLoading") : t("cleanUntitled.label")}
          </SettingsActionRow>
          <SettingsActionRow
            role="destructive"
            loading={isDeleting}
            onClick={() => setConfirmDelete(true)}
          >
            {isDeleting ? t("deleteAccount.labelLoading") : t("deleteAccount.label")}
          </SettingsActionRow>
        </SettingsGroup>
        {cleanResult && (
          <p className="px-1 text-row-meta text-text-dim" role="status">
            {cleanResult}
          </p>
        )}
        {deleteError && (
          <p className="px-1 text-row-meta text-destructive" role="alert">
            {tCommon("errorSaving")}
          </p>
        )}
      </div>

      {/* A30：版本 footer */}
      <p className="text-center text-chip-label text-text-faint">Nudge {pkg.version}</p>

      <ConfirmDialog
        open={confirmLogout}
        onOpenChange={setConfirmLogout}
        title={t("logout.confirmTitle")}
        description={t("logout.confirmBody")}
        confirmLabel={t("logout.button")}
        onConfirm={handleSignOut}
      />
      <ConfirmDialog
        open={confirmClean}
        onOpenChange={setConfirmClean}
        title={t("cleanUntitled.confirmTitle")}
        description={t("cleanUntitled.confirmBody")}
        confirmLabel={t("cleanUntitled.confirmOk")}
        onConfirm={handleCleanUntitled}
        isLoading={isCleaning}
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t("deleteAccount.confirmTitle")}
        description={t("deleteAccount.confirmBody")}
        confirmLabel={t("deleteAccount.confirmOk")}
        onConfirm={handleDeleteAccount}
        isLoading={isDeleting}
      />
    </div>
  );
}

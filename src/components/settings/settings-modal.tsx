"use client";

import useSWR from "swr";
import { signOut } from "next-auth/react";
import { Sun, Moon, Monitor, LogOut } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTheme, type Theme } from "@/components/providers/theme-provider";
import { fetcher } from "@/lib/fetcher";
import { format, parseISO } from "date-fns";

// 紙感顆粒紋理開關（用於 settings modal）
const PAPER_LABEL = "紙質感";
const PAPER_DESC = "讓背景帶有細微的紙張顆粒紋理";

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface MeResponse {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

const themeOptions: { value: Theme; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "跟隨系統", Icon: Monitor },
];

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const { data: me } = useSWR<MeResponse>(open ? "/api/me" : null, fetcher);
  const { theme, setTheme, paperTexture, setPaperTexture } = useTheme();
  const paperOn = paperTexture === "on";

  const handleSignOut = () => {
    signOut({ callbackUrl: "/login" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle className="text-lg font-semibold">設定</DialogTitle>

        <div className="divide-y divide-border">
          {/* 帳號資料 */}
          <section className="py-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-dim mb-3">
              帳號資料
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
                    {me.name || "未命名"}
                  </div>
                  <div className="text-xs text-text-dim truncate">{me.email}</div>
                  <div className="text-xs text-text-faint mt-0.5">
                    加入於 {format(parseISO(me.createdAt), "yyyy/MM/dd")}
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
              主題
            </h3>
            <div
              role="radiogroup"
              aria-label="主題切換"
              className="grid grid-cols-3 gap-2"
            >
              {themeOptions.map(({ value, label, Icon }) => {
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
                    {label}
                  </button>
                );
              })}
            </div>
          </section>

          {/* 紙質感開關 */}
          <section className="py-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-dim mb-3">
              外觀
            </h3>
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm text-foreground">{PAPER_LABEL}</div>
                <div className="text-xs text-text-dim mt-0.5">{PAPER_DESC}</div>
              </div>
              <button
                role="switch"
                aria-checked={paperOn}
                aria-label={PAPER_LABEL}
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

          {/* 登出 */}
          <section className="py-4">
            <button
              onClick={handleSignOut}
              className="flex items-center justify-center gap-2 w-full px-4 py-2 rounded-lg border border-destructive/40 text-destructive hover:bg-destructive/10 transition-colors text-sm font-medium"
            >
              <LogOut className="h-4 w-4" />
              登出
            </button>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

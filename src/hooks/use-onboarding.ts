"use client";

import { useCallback, useEffect, useState } from "react";
import { useMe } from "./use-me";

// 顯示導覽的三個條件（見 spec §5）：
//   ① onboardedAt 存在且「近期」（避免老用戶換裝置又跳 welcome）
//   ② 本地未讀（per-surface，localStorage）
//   ③（inline 提示）錨定的 seed 項目仍在 —— 由呼叫端判斷
const RECENCY_MS = 7 * 24 * 60 * 60 * 1000; // 7 天內視為「近期 onboard」

// 本地已讀 flag 的 id。
export const ONBOARDING_IDS = {
  welcome: "welcome",
  hintComplete: "hint-complete",
  hintOverdue: "hint-overdue",
} as const;

const ALL_IDS = Object.values(ONBOARDING_IDS);

function lsKey(id: string) {
  return `nudge.onboarding.seen.${id}`;
}

export function useOnboarding() {
  const { me } = useMe();
  const [seen, setSeen] = useState<Record<string, boolean>>({});
  const [hydrated, setHydrated] = useState(false);

  // 掛載後才讀 localStorage（避免 SSR/hydration 不一致）。
  useEffect(() => {
    const s: Record<string, boolean> = {};
    for (const id of ALL_IDS) s[id] = window.localStorage.getItem(lsKey(id)) === "1";
    setSeen(s);
    setHydrated(true);
  }, []);

  const recentlyOnboarded =
    !!me?.onboardedAt && Date.now() - new Date(me.onboardedAt).getTime() < RECENCY_MS;

  // hydrated 前一律不顯示 → 不會有 SSR 閃現。
  const active = hydrated && recentlyOnboarded;

  const dismiss = useCallback((id: string) => {
    window.localStorage.setItem(lsKey(id), "1");
    setSeen((prev) => ({ ...prev, [id]: true }));
  }, []);

  return {
    showWelcome: active && !seen[ONBOARDING_IDS.welcome],
    hintVisible: (id: string) => active && !seen[id],
    dismiss,
  };
}

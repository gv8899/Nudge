"use client";

import { useEffect } from "react";
import { startLiveSync } from "@/lib/live-sync";

/** 登入區殼層掛一次：整個分頁一條同步連線。無 UI。 */
export function LiveSyncProvider() {
  useEffect(() => startLiveSync(), []);
  return null;
}

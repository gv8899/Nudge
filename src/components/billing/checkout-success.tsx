"use client";

// 結帳完成頁：輪詢 /api/me 等 webhook 把 entitlement 翻正（1s × 30 次上限）。
// 逾時顯示「處理中稍後生效」——webhook 一定會到（Paddle 自動重試），只是可能
// 比 redirect 慢。

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";

type MeEntitlement = { entitlement?: { isActive?: boolean } };

// Mac 手遞流程（from=mac）：付款生效後 deep link 喚回 Mac app。app 被喚到
// 前景即觸發 didBecomeActive → 刷新 entitlement → 付費牆消失，不需要 app 端
// 解析 URL 內容。
const MAC_DEEP_LINK = "nudge://checkout/done";

export function CheckoutSuccess({ fromMac = false }: { fromMac?: boolean }) {
  const t = useTranslations("billing.paywall.success");
  const [state, setState] = useState<"waiting" | "active" | "timeout">("waiting");
  const tries = useRef(0);

  // 付款生效 + 來自 Mac → 自動嘗試跳回 app（瀏覽器會問一次「開啟 Nudge?」）。
  useEffect(() => {
    if (state !== "active" || !fromMac) return;
    const timer = setTimeout(() => {
      window.location.href = MAC_DEEP_LINK;
    }, 800);
    return () => clearTimeout(timer);
  }, [state, fromMac]);

  useEffect(() => {
    if (state !== "waiting") return;
    const timer = setInterval(async () => {
      tries.current += 1;
      try {
        const res = await fetch("/api/me");
        if (res.ok) {
          const me: MeEntitlement = await res.json();
          if (me.entitlement?.isActive) {
            setState("active");
            return;
          }
        }
      } catch {
        // 輪詢容錯，下一輪再試
      }
      if (tries.current >= 30) setState("timeout");
    }, 1000);
    return () => clearInterval(timer);
  }, [state]);

  return (
    <div className="text-center space-y-4">
      {state === "waiting" && (
        <p className="text-text-dim animate-pulse">{t("processing")}</p>
      )}
      {state === "active" && (
        <>
          <h1 className="text-3xl font-bold text-foreground">{t("title")}</h1>
          <p className="text-text-dim">{t("subtitle")}</p>
        </>
      )}
      {state === "timeout" && <p className="text-text-dim">{t("processing")}</p>}
      <div className="space-x-4">
        {fromMac ? (
          <a
            href={MAC_DEEP_LINK}
            className="inline-block rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
          >
            {t("backToMac")}
          </a>
        ) : (
          <Link
            href="/"
            className="inline-block rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
          >
            {t("back")}
          </Link>
        )}
      </div>
    </div>
  );
}

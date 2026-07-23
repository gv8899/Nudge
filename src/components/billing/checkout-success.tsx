"use client";

// 結帳完成頁：輪詢 /api/me 等 webhook 把 entitlement 翻正（1s × 30 次上限）。
// 逾時顯示「處理中稍後生效」——webhook 一定會到（Paddle 自動重試），只是可能
// 比 redirect 慢。

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";

type MeEntitlement = { entitlement?: { isActive?: boolean } };

export function CheckoutSuccess() {
  const t = useTranslations("billing.paywall.success");
  const [state, setState] = useState<"waiting" | "active" | "timeout">("waiting");
  const tries = useRef(0);

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
      <div>
        <Link
          href="/"
          className="inline-block rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
        >
          {t("back")}
        </Link>
      </div>
    </div>
  );
}

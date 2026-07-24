// 付費牆頁 —— 刻意放在 (app) group 外：無 app sidebar、不受硬牆 layout 攔截，
// 且 Mac OTT 手遞（checkout cookie，無 NextAuth session）也能進來。
// 身分靠 getUser()（Bearer / NextAuth / checkout cookie 三路皆通）。

import { redirect } from "@/i18n/routing";
import { getTranslations } from "next-intl/server";
import { getUser } from "@/lib/get-user";
import { signOut, auth } from "@/lib/auth";
import { PaywallContent } from "@/components/billing/paywall-content";

export default async function PaywallPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { locale } = await params;
  const user = await getUser();
  if (!user) redirect({ href: "/login", locale });

  const t = await getTranslations({ locale, namespace: "billing.paywall" });
  const session = await auth();
  const { from } = await searchParams;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-foreground">{t("title")}</h1>
          <p className="text-text-dim">{t("subtitle")}</p>
        </div>

        <PaywallContent fromMac={from === "mac"} />

        {/* 硬牆下 settings 不可達 → 登出出口放這（僅 web session 顯示） */}
        {session?.user && (
          <form
            className="text-center"
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="text-xs text-text-faint hover:text-text-dim underline-offset-2 hover:underline transition-colors"
            >
              {t("logout")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

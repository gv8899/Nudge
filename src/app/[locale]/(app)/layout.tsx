import { auth } from "@/lib/auth";
import { redirect } from "@/i18n/routing";
import { SidebarLayout } from "@/components/sidebar/sidebar-layout";
import { getUser } from "@/lib/get-user";
import { hasActiveEntitlement } from "@/lib/entitlement";
import { isPaywallEnforced } from "@/lib/paywall";

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user) redirect({ href: "/login", locale });

  // 硬付費牆（UX 層；API 不擋）。/paywall 與 /checkout/* 在 (app) 外不受此攔。
  // flag 預設關 = soft mode 零行為改變；誤傷時關 env flag 即回復，不用回滾。
  if (isPaywallEnforced("web")) {
    const user = await getUser();
    if (user && !(await hasActiveEntitlement(user.id))) {
      redirect({ href: "/paywall", locale });
    }
  }

  return <SidebarLayout>{children}</SidebarLayout>;
}

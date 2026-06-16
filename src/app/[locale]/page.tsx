import { setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { redirect } from "@/i18n/routing";
import { getToday } from "@/lib/today";
import { LandingPage } from "@/components/landing/landing-page";

export default async function LocaleIndex({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // 已登入 → 進 app（當天 day view）；訪客 → 看行銷 landing
  const session = await auth();
  if (session?.user) {
    const today = await getToday();
    redirect({ href: `/day/${today}`, locale });
  }

  return <LandingPage />;
}

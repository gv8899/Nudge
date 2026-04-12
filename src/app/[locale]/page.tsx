import { format } from "date-fns";
import { redirect } from "@/i18n/routing";

export default async function LocaleIndex({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const today = format(new Date(), "yyyy-MM-dd");
  // (app) layout 會做 auth 檢查，未登入者會被再 redirect 到 /[locale]/login
  redirect({ href: `/day/${today}`, locale });
}

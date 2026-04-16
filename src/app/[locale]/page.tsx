import { redirect } from "@/i18n/routing";
import { getToday } from "@/lib/today";

export default async function LocaleIndex({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const today = await getToday();
  redirect({ href: `/day/${today}`, locale });
}

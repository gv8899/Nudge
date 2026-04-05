import { DailyView } from "@/components/daily/daily-view";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DayPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { date } = await params;
  return <DailyView date={date} />;
}

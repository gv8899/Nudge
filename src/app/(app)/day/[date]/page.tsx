import { DailyView } from "@/components/daily/daily-view";

export default async function DayPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  return <DailyView date={date} />;
}

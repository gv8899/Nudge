import { notFound } from "next/navigation";
import { DailyView } from "@/components/daily/daily-view";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function DayPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  if (!DATE_RE.test(date) || Number.isNaN(new Date(`${date}T00:00:00`).getTime())) {
    notFound();
  }
  return <DailyView date={date} />;
}

import { CalendarHost } from "@/components/calendar/calendar-host";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; date?: string }>;
}) {
  const { mode, date } = await searchParams;
  return <CalendarHost initialMode={mode} initialDate={date} />;
}

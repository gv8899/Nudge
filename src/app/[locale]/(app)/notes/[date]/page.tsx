import { redirect } from "@/i18n/routing";
import { getToday } from "@/lib/today";
import { NotesSplit } from "@/components/notes/notes-split";

export default async function NotesDatePage({
  params,
}: {
  params: Promise<{ locale: string; date: string }>;
}) {
  const { locale, date } = await params;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    redirect({ href: "/notes", locale });
  }

  const today = await getToday();
  if (date === today) {
    redirect({ href: "/notes", locale });
  }

  return <NotesSplit initialDate={date} mobileView="canvas" />;
}

import { format } from "date-fns";
import { redirect } from "@/i18n/routing";
import { NotesCanvas } from "@/components/notes/notes-canvas";

export default async function NotesDatePage({
  params,
}: {
  params: Promise<{ locale: string; date: string }>;
}) {
  const { locale, date } = await params;

  // 驗證格式
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    redirect({ href: "/notes", locale });
  }

  // 若是今天則 redirect 到 /notes 避免 URL 分裂
  const today = format(new Date(), "yyyy-MM-dd");
  if (date === today) {
    redirect({ href: "/notes", locale });
  }

  return <NotesCanvas date={date} isToday={false} />;
}

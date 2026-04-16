import { getToday } from "@/lib/today";
import { NotesCanvas } from "@/components/notes/notes-canvas";

export default async function NotesPage() {
  const today = await getToday();
  return <NotesCanvas date={today} isToday />;
}

import { format } from "date-fns";
import { NotesCanvas } from "@/components/notes/notes-canvas";

export default function NotesPage() {
  const today = format(new Date(), "yyyy-MM-dd");
  return <NotesCanvas date={today} isToday />;
}

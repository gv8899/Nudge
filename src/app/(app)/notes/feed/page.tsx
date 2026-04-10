import { format } from "date-fns";
import { NotesFeedPage } from "@/components/notes/notes-feed-page";

export default function FeedPage() {
  const today = format(new Date(), "yyyy-MM-dd");
  return <NotesFeedPage today={today} />;
}

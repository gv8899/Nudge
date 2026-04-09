"use client";

import { format } from "date-fns";
import { NoteFeed } from "@/components/notes/note-feed";

export default function NotesPage() {
  const today = format(new Date(), "yyyy-MM-dd");
  return <NoteFeed today={today} />;
}

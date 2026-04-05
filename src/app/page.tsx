import { redirect } from "next/navigation";
import { format } from "date-fns";
import { auth } from "@/lib/auth";

export default async function Home() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const today = format(new Date(), "yyyy-MM-dd");
  redirect(`/day/${today}`);
}

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SidebarLayout } from "@/components/sidebar/sidebar-layout";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return <SidebarLayout>{children}</SidebarLayout>;
}

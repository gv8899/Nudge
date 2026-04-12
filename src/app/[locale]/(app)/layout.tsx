import { auth } from "@/lib/auth";
import { redirect } from "@/i18n/routing";
import { SidebarLayout } from "@/components/sidebar/sidebar-layout";

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user) redirect({ href: "/login", locale });

  return <SidebarLayout>{children}</SidebarLayout>;
}

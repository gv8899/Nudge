"use client";

import { AppSidebar } from "./app-sidebar";

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppSidebar />
      <main className="md:ml-14 min-h-screen pb-16 md:pb-0">{children}</main>
    </>
  );
}

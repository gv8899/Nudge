import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import { AdminPanel } from "@/components/admin/admin-panel";

// 內部小後台。非 ADMIN_EMAILS（或未登入）→ 404，不洩漏存在。
export default async function AdminPage() {
  if (!(await isAdmin())) notFound();
  return <AdminPanel />;
}

// Admin 認定：限「已登入的 NextAuth session email ∈ ADMIN_EMAILS」（env，逗號
// 分隔，不分大小寫）。admin 小後台是 web-only，不走 app Bearer。

import { auth } from "@/lib/auth";

export async function getAdminEmail(): Promise<string | null> {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) return null;
  const allow = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allow.includes(email) ? email : null;
}

export async function isAdmin(): Promise<boolean> {
  return (await getAdminEmail()) !== null;
}

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { verifyJWT } from "@/lib/jwt";

export async function getUser() {
  // 1. 優先檢查 Bearer token（App）
  const headersList = await headers();
  const authHeader = headersList.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    try {
      const payload = await verifyJWT(token);
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, payload.userId))
        .limit(1);
      return user || null;
    } catch {
      return null;
    }
  }

  // 2. Fallback 到 NextAuth session（Web）
  const session = await auth();
  if (!session?.user?.email) return null;

  let [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, session.user.email))
    .limit(1);

  if (!user) {
    const now = new Date().toISOString();
    const newUser = {
      id: nanoid(),
      email: session.user.email,
      name: session.user.name || null,
      avatarUrl: session.user.image || null,
      createdAt: now,
    };
    await db.insert(users).values(newUser);
    user = newUser;
  }

  return user;
}

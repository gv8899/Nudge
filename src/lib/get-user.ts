import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

export async function getUser() {
  const session = await auth();
  if (!session?.user?.email) return null;

  let user = db
    .select()
    .from(users)
    .where(eq(users.email, session.user.email))
    .get();

  // Session 有效但 DB 裡沒有（例如 DB 被重建），自動建立
  if (!user) {
    const now = new Date().toISOString();
    const newUser = {
      id: nanoid(),
      email: session.user.email,
      name: session.user.name || null,
      avatarUrl: session.user.image || null,
      createdAt: now,
    };
    db.insert(users).values(newUser).run();
    user = newUser;
  }

  return user;
}

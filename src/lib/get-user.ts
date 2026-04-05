import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function getUser() {
  const session = await auth();
  if (!session?.user?.email) return null;

  const user = db
    .select()
    .from(users)
    .where(eq(users.email, session.user.email))
    .get();

  return user || null;
}

export async function requireUser() {
  const user = await getUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

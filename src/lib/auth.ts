import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [Google],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async signIn({ user }) {
      try {
        if (!user.email) return false;

        const existing = db
          .select()
          .from(users)
          .where(eq(users.email, user.email))
          .get();

        if (!existing) {
          const now = new Date().toISOString();
          db.insert(users)
            .values({
              id: nanoid(),
              email: user.email,
              name: user.name || null,
              avatarUrl: user.image || null,
              createdAt: now,
            })
            .run();
        }

        return true;
      } catch (e) {
        console.error("signIn callback error:", e);
        return false;
      }
    },
    async session({ session }) {
      try {
        if (session.user?.email) {
          const dbUser = db
            .select()
            .from(users)
            .where(eq(users.email, session.user.email))
            .get();

          if (dbUser) {
            session.user.id = dbUser.id;
          }
        }
      } catch (e) {
        console.error("session callback error:", e);
      }
      return session;
    },
  },
});

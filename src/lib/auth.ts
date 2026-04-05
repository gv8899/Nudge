import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [Google],
  callbacks: {
    async signIn({ user, profile }) {
      if (!user.email) return false;

      // 檢查用戶是否已存在
      const existing = db
        .select()
        .from(users)
        .where(eq(users.email, user.email))
        .get();

      if (!existing) {
        // 建立新用戶
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
    },
    async session({ session }) {
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
      return session;
    },
  },
});

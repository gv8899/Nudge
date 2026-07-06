import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { provisionNewUser } from "@/lib/onboarding/provision-user";

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

        const [existing] = await db
          .select()
          .from(users)
          .where(eq(users.email, user.email))
          .limit(1);

        if (!existing) {
          const now = new Date().toISOString();
          const newUserId = nanoid();
          await db.insert(users).values({
            id: newUserId,
            email: user.email,
            name: user.name || null,
            avatarUrl: user.image || null,
            locale: null,
            appleSub: null,
            createdAt: now,
            googleCalendarAccessToken: null,
            googleCalendarRefreshToken: null,
            googleCalendarTokenExpires: null,
            googleCalendarSelectedIds: null,
          });
          // locale 在此 callback 難以取得（無 request headers）→ 交給 seed
          // 的 zh-TW fallback。
          await provisionNewUser(newUserId, { locale: null });
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
          const [dbUser] = await db
            .select()
            .from(users)
            .where(eq(users.email, session.user.email))
            .limit(1);

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

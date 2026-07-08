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
          // 用 NEXT_LOCALE cookie（登入頁在 /[locale]/login，middleware 會設）
          // 當介面語言，讓 seed 內容對上使用者看到的語言。讀失敗就 fallback。
          let webLocale: string | null = null;
          try {
            const { cookies } = await import("next/headers");
            const cookieStore = await cookies();
            webLocale = cookieStore.get("NEXT_LOCALE")?.value ?? null;
          } catch {
            webLocale = null;
          }
          await provisionNewUser(newUserId, { locale: webLocale });
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

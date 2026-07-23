import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Apple from "next-auth/providers/apple";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { provisionNewUser } from "@/lib/onboarding/provision-user";
import { resolveAppleUser, dbAppleAccountDeps } from "@/lib/auth/apple-account";

/** Web 介面語言（NEXT_LOCALE cookie，middleware 設）— seed 內容對齊。 */
async function webLocale(): Promise<string | null> {
  try {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    return cookieStore.get("NEXT_LOCALE")?.value ?? null;
  } catch {
    return null;
  }
}

// Apple provider 只在憑證齊時註冊（feature flag）— 未設時 /login 也不會
// 渲染 Apple 按鈕，現況不變。
const appleEnabled = !!(process.env.AUTH_APPLE_ID && process.env.AUTH_APPLE_SECRET);

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google,
    ...(appleEnabled
      ? [
          Apple({
            clientId: process.env.AUTH_APPLE_ID,
            clientSecret: process.env.AUTH_APPLE_SECRET!,
          }),
        ]
      : []),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      try {
        // Apple：sub 優先併號（隱藏信箱 relay 也認得同一人）
        if (account?.provider === "apple") {
          const sub = profile?.sub;
          if (typeof sub !== "string" || !sub) return false;
          await resolveAppleUser(dbAppleAccountDeps, {
            sub,
            email:
              (typeof profile?.email === "string" ? profile.email : null) ??
              user.email,
            name: user.name ?? null,
            locale: await webLocale(),
          });
          return true;
        }

        // Google：維持 email 比對（Google email 穩定）
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
          await provisionNewUser(newUserId, { locale: await webLocale() });
        }

        return true;
      } catch (e) {
        console.error("signIn callback error:", e);
        return false;
      }
    },
    // 登入當下就把 db user id 釘進 NextAuth JWT — session 不再靠 email
    // 現查（Apple 隱藏信箱帳號的 email 是 relay 位址，用 sub 查才穩）。
    async jwt({ token, account, profile }) {
      try {
        if (account) {
          if (account.provider === "apple" && typeof profile?.sub === "string") {
            const [u] = await db
              .select()
              .from(users)
              .where(eq(users.appleSub, profile.sub))
              .limit(1);
            if (u) {
              token.userId = u.id;
              token.email = u.email;
            }
          } else if (token.email) {
            const [u] = await db
              .select()
              .from(users)
              .where(eq(users.email, token.email))
              .limit(1);
            if (u) token.userId = u.id;
          }
        }
      } catch (e) {
        console.error("jwt callback error:", e);
      }
      return token;
    },
    async session({ session, token }) {
      try {
        if (typeof token.userId === "string") {
          session.user.id = token.userId;
          return session;
        }
        // 舊 session（升級前簽發、無 userId）fallback：email 現查一次
        if (session.user?.email) {
          const [dbUser] = await db
            .select()
            .from(users)
            .where(eq(users.email, session.user.email))
            .limit(1);
          if (dbUser) session.user.id = dbUser.id;
        }
      } catch (e) {
        console.error("session callback error:", e);
      }
      return session;
    },
  },
});

/** Apple 帳號併號核心 — 三個入口共用：
 *  iOS 原生 POST /api/auth/apple、NextAuth signIn callback（web）、
 *  Mac 中繼 /api/auth/apple/callback。
 *  三段策略：① apple_sub 命中 → ② email 併號補 sub → ③ 建新帳號+provision。
 *  deps 注入讓核心是純編排、可單測（fake deps）。 */
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { provisionNewUser } from "@/lib/onboarding/provision-user";

export interface AppleUserRecord {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  locale: string | null;
  appleSub: string | null;
}

export interface AppleAccountDeps {
  findByAppleSub(sub: string): Promise<AppleUserRecord | undefined>;
  findByEmail(email: string): Promise<AppleUserRecord | undefined>;
  linkAppleSub(userId: string, sub: string): Promise<void>;
  createUser(u: AppleUserRecord & { createdAt: string }): Promise<void>;
  provision(userId: string, locale: string | null): Promise<void>;
}

export interface AppleIdentity {
  sub: string;
  email?: string | null;
  name?: string | null;
  locale?: string | null;
}

export async function resolveAppleUser(
  deps: AppleAccountDeps,
  identity: AppleIdentity
): Promise<AppleUserRecord> {
  const { sub } = identity;
  const email = identity.email ?? undefined;

  // ① apple_sub 命中
  const bySub = await deps.findByAppleSub(sub);
  if (bySub) return bySub;

  // ② email 併號（補 apple_sub）
  if (email) {
    const byEmail = await deps.findByEmail(email);
    if (byEmail) {
      await deps.linkAppleSub(byEmail.id, sub);
      return { ...byEmail, appleSub: sub };
    }
  }

  // ③ 建新帳號（relay 信箱自成一帳號；真的沒 email 給穩定 placeholder）
  const newUser: AppleUserRecord & { createdAt: string } = {
    id: nanoid(),
    email: email ?? `${sub}@appleid.nudge.local`,
    name: identity.name?.trim() ? identity.name.trim() : null,
    avatarUrl: null,
    locale: null,
    appleSub: sub,
    createdAt: new Date().toISOString(),
  };
  await deps.createUser(newUser);
  await deps.provision(newUser.id, identity.locale ?? null);
  return newUser;
}

/** drizzle 實作 — production 路徑。 */
export const dbAppleAccountDeps: AppleAccountDeps = {
  async findByAppleSub(sub) {
    const [u] = await db.select().from(users).where(eq(users.appleSub, sub)).limit(1);
    return u;
  },
  async findByEmail(email) {
    const [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return u;
  },
  async linkAppleSub(userId, sub) {
    await db.update(users).set({ appleSub: sub }).where(eq(users.id, userId));
  },
  async createUser(u) {
    await db.insert(users).values({
      id: u.id,
      email: u.email,
      name: u.name,
      avatarUrl: u.avatarUrl,
      locale: u.locale,
      appleSub: u.appleSub,
      createdAt: u.createdAt,
      trialStartedAt: null,
      onboardedAt: null,
      googleCalendarAccessToken: null,
      googleCalendarRefreshToken: null,
      googleCalendarTokenExpires: null,
      googleCalendarSelectedIds: null,
    });
  },
  async provision(userId, locale) {
    await provisionNewUser(userId, { locale });
  },
};

import { describe, expect, it } from "vitest";
import {
  resolveAppleUser,
  type AppleAccountDeps,
  type AppleUserRecord,
} from "./apple-account";

function makeFakeDeps(seed: AppleUserRecord[] = []) {
  const usersById = new Map(seed.map((u) => [u.id, { ...u }]));
  const calls = {
    linked: [] as Array<{ userId: string; sub: string }>,
    provisioned: [] as Array<{ userId: string; locale: string | null }>,
  };
  const deps: AppleAccountDeps = {
    async findByAppleSub(sub) {
      return [...usersById.values()].find((u) => u.appleSub === sub);
    },
    async findByEmail(email) {
      return [...usersById.values()].find((u) => u.email === email);
    },
    async linkAppleSub(userId, sub) {
      calls.linked.push({ userId, sub });
      const u = usersById.get(userId);
      if (u) u.appleSub = sub;
    },
    async createUser(u) {
      usersById.set(u.id, { ...u });
    },
    async provision(userId, locale) {
      calls.provisioned.push({ userId, locale });
    },
  };
  return { deps, usersById, calls };
}

const seedUser: AppleUserRecord = {
  id: "u1",
  email: "mike@example.com",
  name: "Mike",
  avatarUrl: null,
  locale: null,
  appleSub: null,
};

describe("resolveAppleUser", () => {
  it("① apple_sub 命中 → 直接回傳既有帳號", async () => {
    const { deps } = makeFakeDeps([{ ...seedUser, appleSub: "sub-1" }]);
    const user = await resolveAppleUser(deps, { sub: "sub-1" });
    expect(user.id).toBe("u1");
  });

  it("② sub 未命中但 email 命中 → 補 apple_sub 併號", async () => {
    const { deps, calls } = makeFakeDeps([seedUser]);
    const user = await resolveAppleUser(deps, { sub: "sub-2", email: "mike@example.com" });
    expect(user.id).toBe("u1");
    expect(calls.linked).toEqual([{ userId: "u1", sub: "sub-2" }]);
  });

  it("③ 都沒有 → 建新帳號並 provision（帶 locale）", async () => {
    const { deps, usersById, calls } = makeFakeDeps();
    const user = await resolveAppleUser(deps, {
      sub: "sub-3",
      email: "relay@privaterelay.appleid.com",
      name: "Hidden",
      locale: "en",
    });
    expect(usersById.has(user.id)).toBe(true);
    expect(user.email).toBe("relay@privaterelay.appleid.com");
    expect(user.appleSub).toBe("sub-3");
    expect(calls.provisioned).toEqual([{ userId: user.id, locale: "en" }]);
  });

  it("③ 無 email → 用 placeholder 滿足 NOT NULL/unique", async () => {
    const { deps } = makeFakeDeps();
    const user = await resolveAppleUser(deps, { sub: "sub-4" });
    expect(user.email).toBe("sub-4@appleid.nudge.local");
  });

  it("② 之後同 sub 再登入 → 走 ①、不再 link/provision", async () => {
    const { deps, calls } = makeFakeDeps([seedUser]);
    await resolveAppleUser(deps, { sub: "sub-5", email: "mike@example.com" });
    const again = await resolveAppleUser(deps, { sub: "sub-5" });
    expect(again.id).toBe("u1");
    expect(calls.linked.length).toBe(1);
    expect(calls.provisioned.length).toBe(0);
  });
});

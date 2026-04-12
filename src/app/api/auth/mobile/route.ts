import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { signJWT } from "@/lib/jwt";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { idToken } = body;

  if (!idToken) {
    return NextResponse.json({ error: "idToken required" }, { status: 400 });
  }

  // 用 Google tokeninfo endpoint 驗證
  const res = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`
  );

  if (!res.ok) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const googleUser = await res.json();
  const { email, name, picture } = googleUser;

  if (!email) {
    return NextResponse.json({ error: "No email in token" }, { status: 401 });
  }

  // 查找或建立 user
  let [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) {
    const now = new Date().toISOString();
    const newUser = {
      id: nanoid(),
      email,
      name: name || null,
      avatarUrl: picture || null,
      locale: null,
      createdAt: now,
    };
    await db.insert(users).values(newUser);
    user = newUser;
  }

  // 簽發 JWT
  const token = await signJWT({ userId: user.id, email: user.email });

  return NextResponse.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      locale: user.locale,
    },
  });
}

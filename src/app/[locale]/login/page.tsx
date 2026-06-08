import { redirect } from "@/i18n/routing";

// Web 登入已停用 — Nudge 改為 iOS / macOS App 專用。/login 一律導回
// landing（不再顯示 Google 登入鈕）。已登入的既有 session 不受影響：
// landing route 會把已登入者導去 /day。要恢復 web 登入還原此檔即可。
export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect({ href: "/", locale });
}

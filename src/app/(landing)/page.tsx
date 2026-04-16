import { auth, signIn } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getToday } from "@/lib/today";
import { LandingPage } from "@/components/landing/landing-page";

export default async function Home() {
  const session = await auth();
  if (session?.user) {
    const today = await getToday();
    redirect(`/zh-TW/day/${today}`);
  }

  async function handleSignIn() {
    "use server";
    await signIn("google", { redirectTo: "/" });
  }

  return <LandingPage signInAction={handleSignIn} />;
}

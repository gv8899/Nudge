import { auth, signIn } from "@/lib/auth";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { LandingPage } from "@/components/landing/landing-page";

export default async function Home() {
  const session = await auth();
  if (session?.user) {
    const today = format(new Date(), "yyyy-MM-dd");
    redirect(`/day/${today}`);
  }

  async function handleSignIn() {
    "use server";
    await signIn("google", { redirectTo: "/" });
  }

  return <LandingPage signInAction={handleSignIn} />;
}

import { signIn, auth } from "@/lib/auth";
import { redirect } from "@/i18n/routing";
import { getTranslations } from "next-intl/server";

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (session?.user) redirect({ href: "/", locale });

  const t = await getTranslations({ locale, namespace: "login" });

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center space-y-8">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-foreground">Nudge</h1>
          <p className="text-text-dim">{t("tagline")}</p>
        </div>

        <div className="flex flex-col items-center gap-3">
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            className="inline-flex items-center gap-3 rounded-lg bg-white px-6 py-3 text-sm font-medium text-gray-800 shadow hover:bg-gray-50 transition-colors"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            {t("signInWithGoogle")}
          </button>
        </form>

        {/* Apple 按鈕 — 憑證未設時整顆不渲染（feature flag），現況不變 */}
        {process.env.AUTH_APPLE_ID && process.env.AUTH_APPLE_SECRET && (
          <form
            action={async () => {
              "use server";
              await signIn("apple", { redirectTo: "/" });
            }}
          >
            <button
              type="submit"
              className="inline-flex items-center gap-3 rounded-lg bg-black px-6 py-3 text-sm font-medium text-white shadow hover:bg-gray-900 transition-colors"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M17.05 12.54c-.03-2.94 2.4-4.35 2.51-4.42-1.37-2-3.5-2.28-4.25-2.31-1.8-.18-3.53 1.06-4.44 1.06-.92 0-2.34-1.04-3.85-1.01-1.98.03-3.81 1.15-4.83 2.92-2.06 3.58-.53 8.87 1.48 11.77.98 1.42 2.15 3.01 3.68 2.95 1.48-.06 2.04-.95 3.83-.95 1.78 0 2.29.95 3.85.92 1.59-.03 2.6-1.44 3.57-2.87 1.13-1.64 1.59-3.23 1.61-3.31-.03-.02-3.09-1.19-3.16-4.75zM14.13 3.9c.82-.99 1.37-2.37 1.22-3.74-1.18.05-2.6.78-3.45 1.77-.76.88-1.42 2.28-1.24 3.63 1.31.1 2.65-.67 3.47-1.66z"/>
              </svg>
              {t("signInWithApple")}
            </button>
          </form>
        )}
        </div>
      </div>
    </div>
  );
}

import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { routing, type Locale } from "@/i18n/routing";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Nudge",
  description: "輕量型每日任務推進工具",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as Locale)) notFound();
  setRequestLocale(locale);

  const messages = await getMessages();

  const cookieStore = await cookies();
  const resolvedFromCookie = cookieStore.get("nudge:theme-resolved")?.value;
  const initialResolvedTheme: "light" | "dark" =
    resolvedFromCookie === "light" ? "light" : "dark";

  const paperFromCookie = cookieStore.get("nudge:paper-texture")?.value;
  const initialPaperTexture: "on" | "off" =
    paperFromCookie === "off" ? "off" : "on";

  const htmlClass = [
    geistSans.variable,
    "h-full antialiased",
    initialResolvedTheme === "dark" ? "dark" : "",
    initialPaperTexture === "on" ? "paper-texture" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <html lang={locale} className={htmlClass}>
      <body className="min-h-full bg-background text-foreground font-sans">
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider
            initialResolvedTheme={initialResolvedTheme}
            initialPaperTexture={initialPaperTexture}
          >
            {children}
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

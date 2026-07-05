import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { ThemeProvider } from "@/components/providers/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://nudge.tw"),
  title: "Nudge",
  description: "輕量型每日任務推進工具",
  // icons 走 Next.js App Router file conventions：app/favicon.ico、
  // app/icon.png、app/apple-icon.png 自動被 hoist 成 link tag，不需要
  // 在這裡顯式列。openGraph / twitter 走 app/opengraph-image.png 跟
  // app/twitter-image.png 也是同套 file convention。
  openGraph: {
    title: "Nudge",
    description: "輕量型每日任務推進工具",
    url: "https://nudge.tw",
    siteName: "Nudge",
    locale: "zh_TW",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nudge",
    description: "輕量型每日任務推進工具",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const resolvedFromCookie = cookieStore.get("nudge:theme-resolved")?.value;
  const initialResolvedTheme: "light" | "dark" =
    resolvedFromCookie === "light" ? "light" : "dark";

  const htmlClass = [
    "h-full antialiased",
    initialResolvedTheme === "dark" ? "dark" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <html lang="zh-TW" className={htmlClass}>
      <body className="min-h-full bg-background text-foreground font-sans">
        <ThemeProvider initialResolvedTheme={initialResolvedTheme}>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}

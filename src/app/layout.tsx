import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { cookies } from "next/headers";
import { ThemeProvider } from "@/components/providers/theme-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Nudge",
  description: "輕量型每日任務推進工具",
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

  // 紙感顆粒紋理 — 預設 on（首次造訪），明確設為 "off" 才關閉
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
    <html lang="zh-TW" className={htmlClass}>
      <body className="min-h-full bg-background text-foreground font-sans">
        <ThemeProvider
          initialResolvedTheme={initialResolvedTheme}
          initialPaperTexture={initialPaperTexture}
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}

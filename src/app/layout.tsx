import "./globals.css";

// 子 layout（[locale] 和 (landing)）各自提供 <html><body>，
// root layout 僅做 passthrough 和載入全域 CSS。
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}

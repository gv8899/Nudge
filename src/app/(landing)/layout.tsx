import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";

// landing group（root /）沒有 locale segment，固定以 zh-TW 供給 messages。
// 之後要支援多語切換再擴充。
export default async function LandingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  setRequestLocale("zh-TW");
  const messages = await getMessages();
  return (
    <NextIntlClientProvider locale="zh-TW" messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}

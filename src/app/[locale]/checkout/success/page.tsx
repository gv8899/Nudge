// 結帳完成頁 —— (app) group 外（Mac OTT 流程只有 checkout cookie、無
// NextAuth session；輪詢 /api/me 靠 getUser 的 cookie fallback）。

import { CheckoutSuccess } from "@/components/billing/checkout-success";

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <CheckoutSuccess fromMac={from === "mac"} />
    </div>
  );
}

// 分平台硬付費牆開關。各 track（iOS IAP / Web Paddle / Mac）完成付費路徑前
// 一律 off（soft 模式：只讀 entitlement、不硬擋），完成後再逐一翻 on。
//
// env：PAYWALL_ENFORCE_IOS / PAYWALL_ENFORCE_WEB / PAYWALL_ENFORCE_MAC = "1" | "true"
// 相容：PAYWALL_ENFORCE（全域）為任一平台 fallback。

export type PaywallPlatform = "ios" | "web" | "mac";

function flagOn(value: string | undefined): boolean {
  return value === "1" || value === "true";
}

/** 指定平台是否啟用硬付費牆。預設 off。 */
export function isPaywallEnforced(platform: PaywallPlatform): boolean {
  const perPlatform = {
    ios: process.env.PAYWALL_ENFORCE_IOS,
    web: process.env.PAYWALL_ENFORCE_WEB,
    mac: process.env.PAYWALL_ENFORCE_MAC,
  }[platform];
  return flagOn(perPlatform) || flagOn(process.env.PAYWALL_ENFORCE);
}

/** 各平台 enforcement 狀態（給 /api/me 帶給 client 決定是否擋）。 */
export function paywallEnforcement(): Record<PaywallPlatform, boolean> {
  return {
    ios: isPaywallEnforced("ios"),
    web: isPaywallEnforced("web"),
    mac: isPaywallEnforced("mac"),
  };
}

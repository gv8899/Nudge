import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  async redirects() {
    // DMG + appcast 都存在 GitHub release「mac-releases」這個固定檔案桶，
    // nudge.tw 只做 redirect 轉過去。發新版只需 release-mac.sh 上傳，這兩條
    // 不用動。temporary(307) 避免被瀏覽器/Sparkle 永久快取到舊版。
    const BUCKET =
      "https://github.com/gv8899/Nudge/releases/download/mac-releases";
    return [
      // 網站下載鈕 → 固定最新 Nudge.dmg
      {
        source: "/download/mac",
        destination: `${BUCKET}/Nudge.dmg`,
        permanent: false,
      },
      // Sparkle 自動更新 feed（app 的 SUFeedURL 已指向這）
      {
        source: "/downloads/appcast.xml",
        destination: `${BUCKET}/appcast.xml`,
        permanent: false,
      },
    ];
  },
};

export default withNextIntl(nextConfig);

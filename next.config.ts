import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  // Version-skew 保護：每次部署用該 build 的 git SHA 當識別。舊分頁（舊 build）
  // 的 asset/deployment id 對不上現行 server 時，Next 會強制整頁 reload 換到新版，
  // 避免 login/paywall 的 Server Action 送舊 action ID 而噴「Failed to find Server
  // Action」。SHA 由 Zeabur build 階段注入（見 Dockerfile 的 ARG）；本機/無此變數
  // 時為 undefined，等同不啟用。
  deploymentId: process.env.ZEABUR_GIT_COMMIT_SHA,
  async headers() {
    // 關掉 app 端的 HTTP/3：Zeabur 邊緣對每個回應加 `alt-svc: h3`，Apple URLSession
    // 學到後整個 app 生命週期走同一條 QUIC 連線，實測開著約 1 分鐘後傳輸速率崩到
    // 每秒數十 KB（1.2 MB 附件 37–60 s）。`Alt-Svc: clear` 叫 client 清掉已學到的
    // 替代協定，之後走 HTTP/2。Mac 132 已在 app 端關 h3；這條是給 iOS（私有 API
    // 有審核風險，改由伺服器端處理）。只掛 /api/*：app 只打這些路徑。
    // ⚠ 邊緣會不會蓋掉 / 併存這個 header 要部署後用 `curl -sI` 驗證。
    return [
      {
        source: "/api/:path*",
        headers: [{ key: "Alt-Svc", value: "clear" }],
      },
    ];
  },
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

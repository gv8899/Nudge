// 下載連結。Mac 走品牌 redirect /download/mac（next.config → GitHub
// Releases latest）。第一次跑 apple/scripts/release-mac.sh 發布 release 後即生效。
// iOS 仍是 placeholder，拿到 App Store URL 後直接替換 ios。
export const DOWNLOAD_LINKS = {
  mac: "/download/mac",
  ios: "#", // TODO: App Store URL
} as const;

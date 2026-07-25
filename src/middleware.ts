import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // 匹配所有需要 locale prefix 的路徑，但排除：
  // - /download/mac（品牌下載 redirect，由 next.config redirects 處理，不加 locale）
  // - /api, /_next, /_vercel, 含副檔名的檔案
  // 註：/、/download、/privacy、/terms、/refund 都交給 next-intl → 自動補 locale
  //     （/privacy → /zh-TW/privacy）。法務頁已移到 [locale] 並三語化。
  matcher: ['/((?!api|_next|_vercel|download/mac|.*\\..*).*)'],
};

import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // 匹配所有需要 locale prefix 的路徑，但排除：
  // - /privacy、/terms（英文法務頁，locale-independent，留在 (landing) group）
  // - /api, /_next, /_vercel, 含副檔名的檔案
  // 註：/ 與 /download 交給 next-intl 處理 → 自動補 locale（/ → /zh-TW）。
  matcher: ['/((?!api|_next|_vercel|privacy|terms|.*\\..*).*)'],
};

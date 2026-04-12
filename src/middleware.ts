import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // 匹配所有需要 locale prefix 的路徑，但排除：
  // - / 根路徑（landing page 自己 handle，寫死 zh-TW redirect）
  // - /api, /_next, /_vercel, 含副檔名的檔案
  matcher: ['/((?!api|_next|_vercel|$|.*\\..*).*)'],
};

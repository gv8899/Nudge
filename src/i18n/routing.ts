import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';

export const routing = defineRouting({
  locales: ['zh-TW', 'en', 'ja'] as const,
  // 非中日訪客的最終 fallback = 英文（與 iOS「其他→英文」一致）。Accept-Language
  // 為中文 / 日文的訪客仍會被 next-intl 協商到 zh-TW / ja，這只改「都不匹配」時的預設。
  defaultLocale: 'en',
  localePrefix: 'always',
});

export type Locale = (typeof routing.locales)[number];

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);

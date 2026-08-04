import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SUPPORTED_LOCALES = ['en', 'zh-TW', 'zh-CN'] as const;
const DEFAULT_LOCALE = 'en';

function hasFileExtension(pathname: string): boolean {
  return /\.[^/]+$/.test(pathname);
}

function hasLocalePrefix(pathname: string): boolean {
  return SUPPORTED_LOCALES.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    hasFileExtension(pathname)
  ) {
    return NextResponse.next();
  }

  if (hasLocalePrefix(pathname)) {
    return NextResponse.next();
  }

  if (pathname === '/') {
    const url = request.nextUrl.clone();
    url.pathname = `/${DEFAULT_LOCALE}`;
    return NextResponse.redirect(url);
  }

  const url = request.nextUrl.clone();
  url.pathname = `/${DEFAULT_LOCALE}${pathname}`;
  url.search = search;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};

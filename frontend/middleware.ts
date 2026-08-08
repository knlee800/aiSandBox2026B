import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SUPPORTED_LOCALES = ['en', 'zh-TW', 'zh-CN'] as const;
const DEFAULT_LOCALE = 'en';
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

const FORWARDED_CONTROL_OR_SPACE_REGEX = /[\s\x00-\x1F\x7F]/;

function hasFileExtension(pathname: string): boolean {
  return /\.[^/]+$/.test(pathname);
}

function normalizeLocale(segment: string): SupportedLocale | null {
  const normalizedSegment = segment.toLowerCase();
  for (const locale of SUPPORTED_LOCALES) {
    if (locale.toLowerCase() === normalizedSegment) {
      return locale;
    }
  }

  return null;
}

function replaceFirstPathSegment(pathname: string, segment: string): string {
  const segments = pathname.split('/');
  if (segments.length < 2) {
    return `/${segment}`;
  }

  segments[1] = segment;
  return segments.join('/');
}

function isLoopbackHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (
    normalized === 'localhost' ||
    normalized === '127.0.0.1' ||
    normalized === '::1' ||
    normalized === '[::1]'
  );
}

function getSingleForwardedValue(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const parts = value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length !== 1) {
    return null;
  }

  const [candidate] = parts;
  if (FORWARDED_CONTROL_OR_SPACE_REGEX.test(candidate)) {
    return null;
  }

  return candidate;
}

function parseForwardedHost(headerValue: string | null): string | null {
  const candidate = getSingleForwardedValue(headerValue);
  if (!candidate) {
    return null;
  }

  if (candidate.includes('://') || candidate.includes('/') || candidate.includes('\\')) {
    return null;
  }

  try {
    const parsed = new URL(`http://${candidate}`);
    if (
      parsed.username ||
      parsed.password ||
      parsed.pathname !== '/' ||
      parsed.search !== '' ||
      parsed.hash !== ''
    ) {
      return null;
    }

    return parsed.host;
  } catch {
    return null;
  }
}

function parseForwardedProto(headerValue: string | null): 'http' | 'https' | null {
  const candidate = getSingleForwardedValue(headerValue);
  if (!candidate) {
    return null;
  }

  const normalized = candidate.toLowerCase();
  if (normalized === 'http' || normalized === 'https') {
    return normalized;
  }

  return null;
}

function resolveRedirectOrigin(request: NextRequest): string {
  const fallbackProtocol = request.nextUrl.protocol === 'https:' ? 'https' : 'http';
  const fallbackHost = request.nextUrl.host;

  if (!isLoopbackHost(request.nextUrl.hostname)) {
    return `${fallbackProtocol}://${fallbackHost}`;
  }

  const forwardedHost = parseForwardedHost(request.headers.get('x-forwarded-host'));
  if (!forwardedHost) {
    return `${fallbackProtocol}://${fallbackHost}`;
  }

  const forwardedProto = parseForwardedProto(request.headers.get('x-forwarded-proto')) ?? fallbackProtocol;
  return `${forwardedProto}://${forwardedHost}`;
}

function buildRedirectUrl(request: NextRequest, pathname: string, search: string): URL {
  return new URL(`${pathname}${search}`, resolveRedirectOrigin(request));
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

  const firstPathSegment = pathname.split('/')[1] ?? '';
  const canonicalLocale = normalizeLocale(firstPathSegment);

  if (canonicalLocale) {
    if (firstPathSegment === canonicalLocale) {
      return NextResponse.next();
    }

    const normalizedPathname = replaceFirstPathSegment(pathname, canonicalLocale);
    return NextResponse.redirect(buildRedirectUrl(request, normalizedPathname, search));
  }

  if (pathname === '/') {
    return NextResponse.redirect(buildRedirectUrl(request, `/${DEFAULT_LOCALE}`, search));
  }

  return NextResponse.redirect(buildRedirectUrl(request, `/${DEFAULT_LOCALE}${pathname}`, search));
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};

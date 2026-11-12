import { randomBytes } from 'crypto';
import type { CookieOptions, NextFunction, Request, Response } from 'express';

/**
 * Platform cookie names and attributes (COOKIE-PREFIX-01).
 *
 * Two modes, decided per call from the environment:
 * - Secure mode: APP_BASE_URL is an https URL, or NODE_ENV is production.
 *   The three platform cookies carry the __Host- prefix, so a browser
 *   accepts them only with Secure, Path=/ and no Domain. A sibling host
 *   (for example the preview host) cannot plant one for the platform host.
 *   Only these names are read; the old names are ignored.
 * - Otherwise (local http development, Jest): today's names and attributes.
 *
 * Never logs cookie values.
 */

type EnvLike = Record<string, string | undefined>;

export const HOST_COOKIE_PREFIX = '__Host-';

export const LEGACY_SESSION_COOKIE_NAME = 'aisandbox_session';
export const LEGACY_CSRF_COOKIE_NAME = 'aisandbox_csrf';
export const LEGACY_OAUTH_STATE_COOKIE_NAME = 'aisandbox_oauth_state';

export const SECURE_SESSION_COOKIE_NAME = `${HOST_COOKIE_PREFIX}${LEGACY_SESSION_COOKIE_NAME}`;
export const SECURE_CSRF_COOKIE_NAME = `${HOST_COOKIE_PREFIX}${LEGACY_CSRF_COOKIE_NAME}`;
export const SECURE_OAUTH_STATE_COOKIE_NAME = `${HOST_COOKIE_PREFIX}${LEGACY_OAUTH_STATE_COOKIE_NAME}`;

/** Both spellings of the session cookie name. */
export const SESSION_COOKIE_NAMES: readonly string[] = [
  SECURE_SESSION_COOKIE_NAME,
  LEGACY_SESSION_COOKIE_NAME,
];

export const SESSION_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const OAUTH_STATE_MAX_AGE_MS = 10 * 60 * 1000;

export interface PlatformCookieNames {
  session: string;
  csrf: string;
  oauthState: string;
}

/** True for an https APP_BASE_URL or NODE_ENV production. */
export function isSecureCookieMode(env: EnvLike = process.env): boolean {
  if (env.NODE_ENV === 'production') {
    return true;
  }
  const configured = env.APP_BASE_URL?.trim();
  if (!configured) {
    return false;
  }
  try {
    return new URL(configured).protocol === 'https:';
  } catch {
    return false;
  }
}

/** The names used (set and read) in the current mode. */
export function platformCookieNames(env: EnvLike = process.env): PlatformCookieNames {
  return isSecureCookieMode(env)
    ? {
        session: SECURE_SESSION_COOKIE_NAME,
        csrf: SECURE_CSRF_COOKIE_NAME,
        oauthState: SECURE_OAUTH_STATE_COOKIE_NAME,
      }
    : {
        session: LEGACY_SESSION_COOKIE_NAME,
        csrf: LEGACY_CSRF_COOKIE_NAME,
        oauthState: LEGACY_OAUTH_STATE_COOKIE_NAME,
      };
}

/** Options for setting the session cookie. Never a Domain. */
export function sessionCookieSetOptions(env: EnvLike = process.env): CookieOptions {
  return {
    httpOnly: true,
    secure: isSecureCookieMode(env),
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_COOKIE_MAX_AGE_MS,
  };
}

/**
 * Options for clearing the session cookie. In secure mode the clearing
 * header must carry Secure and Path=/, or the browser ignores it for a
 * __Host- cookie. Outside secure mode: path only, exactly as before.
 */
export function sessionCookieClearOptions(env: EnvLike = process.env): CookieOptions {
  if (!isSecureCookieMode(env)) {
    return { path: '/' };
  }
  return { httpOnly: true, secure: true, sameSite: 'lax', path: '/' };
}

/** Options for setting the CSRF cookie (readable by the page). Never a Domain. */
export function csrfCookieSetOptions(env: EnvLike = process.env): CookieOptions {
  return {
    httpOnly: false,
    secure: isSecureCookieMode(env),
    sameSite: 'lax',
    path: '/',
  };
}

/** The session cookie value under the current mode's name, if any. */
export function readSessionCookie(request: Pick<Request, 'cookies'> | undefined): unknown {
  const cookies = (request as { cookies?: Record<string, unknown> } | undefined)?.cookies;
  return cookies?.[platformCookieNames().session];
}

/** The CSRF cookie value under the current mode's name, if any. */
export function readCsrfCookie(request: Pick<Request, 'cookies'> | undefined): unknown {
  const cookies = (request as { cookies?: Record<string, unknown> } | undefined)?.cookies;
  return cookies?.[platformCookieNames().csrf];
}

/**
 * Sets the session cookie. In secure mode it also clears the old
 * aisandbox_session name, so a stale cookie goes at once.
 */
export function setSessionCookie(response: Response, sessionToken: string): void {
  const names = platformCookieNames();
  if (names.session !== LEGACY_SESSION_COOKIE_NAME) {
    response.clearCookie(LEGACY_SESSION_COOKIE_NAME, sessionCookieClearOptions());
  }
  response.cookie(names.session, sessionToken, sessionCookieSetOptions());
}

/** Clears the session cookie; in secure mode the old name too. */
export function clearSessionCookies(response: Response): void {
  const names = platformCookieNames();
  response.clearCookie(names.session, sessionCookieClearOptions());
  if (names.session !== LEGACY_SESSION_COOKIE_NAME) {
    response.clearCookie(LEGACY_SESSION_COOKIE_NAME, sessionCookieClearOptions());
  }
}

/**
 * Exact-name test over a raw Cookie header: true when any pair's name
 * (the text before its first '=', trimmed) equals one of the names.
 * A name that only contains or ends with one of them does not match.
 */
export function cookieHeaderHasName(
  header: string | string[] | undefined,
  names: readonly string[],
): boolean {
  if (!header) {
    return false;
  }
  const text = Array.isArray(header) ? header.join('; ') : header;
  if (text.length === 0) {
    return false;
  }
  return text.split(';').some((part) => {
    const separator = part.indexOf('=');
    if (separator < 0) {
      return false;
    }
    return names.includes(part.slice(0, separator).trim());
  });
}

/**
 * True when the request carries a platform session cookie under either name,
 * in the parsed cookies or in the raw Cookie header (exact-name match).
 */
export function requestHasSessionCookie(request: Request): boolean {
  const parsed = (request as Request & { cookies?: Record<string, unknown> }).cookies;
  if (
    parsed &&
    SESSION_COOKIE_NAMES.some((name) => Object.prototype.hasOwnProperty.call(parsed, name))
  ) {
    return true;
  }
  return cookieHeaderHasName(request.headers?.cookie, SESSION_COOKIE_NAMES);
}

/**
 * Issues the CSRF cookie (double-submit) on every response whose request
 * lacks it under the current mode's name. Runs after cookie-parser.
 */
export function csrfCookieMiddleware(req: Request, res: Response, next: NextFunction): void {
  const names = platformCookieNames();
  if (!req.cookies?.[names.csrf]) {
    res.cookie(names.csrf, randomBytes(32).toString('hex'), csrfCookieSetOptions());
  }
  next();
}

/** Options for the cookie-session middleware that holds the OAuth state. */
export function oauthStateSessionOptions(
  secret: string,
  env: EnvLike = process.env,
): {
  name: string;
  keys: string[];
  maxAge: number;
  httpOnly: boolean;
  sameSite: 'lax';
  secure: boolean;
  path: string;
} {
  return {
    name: platformCookieNames(env).oauthState,
    keys: [secret],
    maxAge: OAUTH_STATE_MAX_AGE_MS,
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecureCookieMode(env),
    path: '/',
  };
}

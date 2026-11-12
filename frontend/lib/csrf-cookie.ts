/**
 * The one CSRF cookie reader for the browser (COOKIE-PREFIX-01).
 *
 * In secure mode the gateway issues __Host-aisandbox_csrf; on local http it
 * issues aisandbox_csrf. The prefixed name is tried first, then the old one.
 * Names match exactly: a cookie whose name only contains or ends with one of
 * them (for example x__Host-aisandbox_csrf) is ignored.
 */
export const CSRF_COOKIE_NAMES = ['__Host-aisandbox_csrf', 'aisandbox_csrf'] as const;

/** The value of the first pair named exactly `name`, or null when absent or empty. */
export function readCookieValue(cookieString: string, name: string): string | null {
  for (const part of cookieString.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) {
      continue;
    }
    if (part.slice(0, separator).trim() !== name) {
      continue;
    }
    const value = part.slice(separator + 1).trim();
    return value.length > 0 ? value : null;
  }
  return null;
}

/**
 * The CSRF token for the X-CSRF-Token header, or null. Reads document.cookie
 * unless a cookie string is given (tests); null outside a browser.
 */
export function readCsrfCookie(cookieString?: string): string | null {
  const source =
    cookieString ?? (typeof document === 'undefined' ? undefined : document.cookie);
  if (typeof source !== 'string' || source.length === 0) {
    return null;
  }
  for (const name of CSRF_COOKIE_NAMES) {
    const value = readCookieValue(source, name);
    if (value) {
      return value;
    }
  }
  return null;
}

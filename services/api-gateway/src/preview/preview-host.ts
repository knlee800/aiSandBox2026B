/**
 * PREVIEW-ORIGIN-01: which host a preview request arrived on.
 *
 * Generated-app previews are served from a separate preview host
 * (PREVIEW_BASE_URL, for example https://preview.staging.ainow.biz) so that
 * app script never runs with the platform origin's rights.
 *
 * How the browser's host reaches the gateway:
 * - Behind Caddy (staging): reverse_proxy passes the browser's Host header
 *   through unchanged and sets X-Forwarded-Host to that same host (it does
 *   not trust a client-sent X-Forwarded-Host unless trusted_proxies is set).
 * - Behind the local Next rewrite (frontend/next.config.js): Next 15 proxies
 *   with changeOrigin, so Host becomes the gateway's own host (for example
 *   localhost:4000), and it sets X-Forwarded-Host to the browser's host.
 * - Straight to the gateway: Host is the browser's host and there is no
 *   X-Forwarded-Host.
 *
 * Rule (fail-closed): a request is on the preview host only when the Host
 * header AND every X-Forwarded-Host value are exactly the preview host. Any
 * mismatch, a missing Host header or an unset or unusable PREVIEW_BASE_URL
 * means "not the preview host", which is the safe side: there the gateway
 * either redirects to the preview host or serves with the CSP sandbox
 * fail-safe, and never serves preview content with platform-origin rights.
 * A header can therefore never turn a platform-host request into a
 * preview-host one, because the Host header must match as well.
 */

export const PREVIEW_COOKIE_NAME = 'aisandbox_preview';

export type PreviewHostConfig = {
  /** For example https://preview.staging.ainow.biz (no trailing slash). */
  origin: string;
  /** Lower-case host[:port], default port left out, as URL.host gives it. */
  host: string;
  protocol: 'http:' | 'https:';
};

type EnvLike = Record<string, string | undefined>;

function parseHttpUrl(raw: string | undefined): URL | null {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (url.username || url.password) return null;
  if (!url.hostname) return null;
  return url;
}

/**
 * Reads PREVIEW_BASE_URL. Returns null (preview host not configured) when it
 * is unset, not an http(s) URL, carries credentials, or names the same host
 * as APP_BASE_URL (the platform host must never be treated as the preview
 * host).
 */
export function readPreviewHostConfig(env: EnvLike = process.env): PreviewHostConfig | null {
  const url = parseHttpUrl(env.PREVIEW_BASE_URL);
  if (!url) return null;
  const host = url.host.toLowerCase();
  const app = parseHttpUrl(env.APP_BASE_URL);
  if (app && app.host.toLowerCase() === host) return null;
  return { origin: url.origin, host, protocol: url.protocol as 'http:' | 'https:' };
}

/** Lower-cases a host header value and drops the scheme's default port. */
export function normalizeHostValue(value: string, protocol: 'http:' | 'https:'): string {
  const lower = value.trim().toLowerCase();
  const defaultPort = protocol === 'https:' ? ':443' : ':80';
  return lower.endsWith(defaultPort) ? lower.slice(0, -defaultPort.length) : lower;
}

function headerValues(value: string | string[] | undefined): string[] | null {
  if (value === undefined) return null;
  const joined = Array.isArray(value) ? value.join(',') : String(value);
  return joined.split(',').map((part) => part.trim());
}

export type HostHeaders = {
  headers?: Record<string, string | string[] | undefined>;
};

/** True only when the request is, beyond doubt, on the preview host. */
export function isPreviewHostRequest(
  req: HostHeaders | undefined | null,
  config: PreviewHostConfig | null = readPreviewHostConfig(),
): boolean {
  if (!config || !req || !req.headers) return false;
  const hostHeader = req.headers.host;
  if (typeof hostHeader !== 'string' || hostHeader.trim().length === 0) return false;
  if (normalizeHostValue(hostHeader, config.protocol) !== config.host) return false;

  const forwarded = headerValues(req.headers['x-forwarded-host']);
  if (forwarded) {
    if (forwarded.length === 0) return false;
    for (const value of forwarded) {
      if (!value || normalizeHostValue(value, config.protocol) !== config.host) return false;
    }
  }
  return true;
}

/** Secure on an https preview host and always in production. */
export function previewCookieSecure(config: PreviewHostConfig, env: EnvLike = process.env): boolean {
  return config.protocol === 'https:' || env.NODE_ENV === 'production';
}

/** Gateway session ids are UUIDs; the specs use ids like session-123. */
export const PREVIEW_SESSION_ID = /^[A-Za-z0-9_-]{1,128}$/;

/** Methods allowed for each exact preview action (CM-AUTH-01 D5). */
const PREVIEW_ACTION_METHODS: Record<string, ReadonlySet<string>> = {
  start: new Set(['POST']),
  stop: new Set(['POST', 'DELETE']),
  status: new Set(['GET', 'HEAD']),
};
const PREVIEW_PROXY_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD']);

export type PreviewForward = {
  /** The session id: exactly the raw path segment the ownership guard checked. */
  sessionId: string;
  /** 'start', 'stop', 'status', 'proxy' or 'proxy/<rest>' (raw, undecoded). */
  suffix: string;
};

function isDotSegment(value: string): boolean {
  return value === '.' || value === '..';
}

/**
 * CM-AUTH-01 (D5): strict allowlist of preview path shapes, checked on the
 * raw (undecoded) req.path. Anything else returns null, and the caller
 * answers 404 without calling container-manager.
 *
 * Accepted:
 * - /api/preview/<sid>/start            POST
 * - /api/preview/<sid>/stop             POST, DELETE
 * - /api/preview/<sid>/status           GET, HEAD
 * - /api/preview/<sid>/proxy            GET, HEAD
 * - /api/preview/<sid>/proxy/<rest>     GET, HEAD
 *
 * Refused: a sid outside [A-Za-z0-9_-]{1,128}; any segment that is, or
 * decodes to, '.' or '..'; %2f, %5c or a backslash anywhere; an empty
 * segment (a double slash), except one trailing slash after proxy/<rest>;
 * a segment that does not decode; a method the shape does not allow.
 *
 * (Moved here from preview.controller.ts by PREVIEW-ORIGIN-01 so the access
 * guard can use it without an import cycle; the controller re-exports it.)
 */
export function resolvePreviewForward(method: unknown, rawPath: unknown): PreviewForward | null {
  if (typeof method !== 'string' || typeof rawPath !== 'string') {
    return null;
  }
  if (rawPath.includes('\\') || /%2f|%5c/i.test(rawPath)) {
    return null;
  }

  const segments = rawPath.split('/');
  if (segments[0] !== '' || segments[1] !== 'api' || segments[2] !== 'preview') {
    return null;
  }

  const sessionId = segments[3];
  const action = segments[4];
  const rest = segments.slice(5);
  if (typeof sessionId !== 'string' || !PREVIEW_SESSION_ID.test(sessionId)) {
    return null;
  }
  if (typeof action !== 'string') {
    return null;
  }

  for (let index = 1; index < segments.length; index += 1) {
    const segment = segments[index];
    if (segment === '') {
      // Only a single trailing slash after proxy/ (a directory in the preview).
      const trailingProxySlash =
        action === 'proxy' && index === segments.length - 1 && index >= 5;
      if (!trailingProxySlash) {
        return null;
      }
      continue;
    }
    let decoded: string;
    try {
      decoded = decodeURIComponent(segment);
    } catch {
      return null;
    }
    if (isDotSegment(segment) || isDotSegment(decoded) || /[\\/]/.test(decoded)) {
      return null;
    }
  }

  const upperMethod = method.toUpperCase();
  if (action === 'proxy') {
    if (!PREVIEW_PROXY_METHODS.has(upperMethod)) {
      return null;
    }
    return { sessionId, suffix: rest.length === 0 ? 'proxy' : `proxy/${rest.join('/')}` };
  }

  const allowedMethods = Object.prototype.hasOwnProperty.call(PREVIEW_ACTION_METHODS, action)
    ? PREVIEW_ACTION_METHODS[action]
    : undefined;
  if (!allowedMethods || rest.length !== 0 || !allowedMethods.has(upperMethod)) {
    return null;
  }
  return { sessionId, suffix: action };
}

/** True for the proxy shapes ('proxy' and 'proxy/<rest>'). */
export function isPreviewProxySuffix(suffix: string): boolean {
  return suffix === 'proxy' || suffix.startsWith('proxy/');
}

/**
 * PREVIEW-ORIGIN-01: GET or HEAD /api/preview/<sid>/enter, exactly. Returns
 * the session id, or null for any other method or shape.
 */
export function resolvePreviewEnter(method: unknown, rawPath: unknown): string | null {
  if (typeof method !== 'string' || typeof rawPath !== 'string') return null;
  const upper = method.toUpperCase();
  if (upper !== 'GET' && upper !== 'HEAD') return null;
  const segments = rawPath.split('/');
  if (
    segments.length !== 5 ||
    segments[0] !== '' ||
    segments[1] !== 'api' ||
    segments[2] !== 'preview' ||
    segments[4] !== 'enter'
  ) {
    return null;
  }
  return PREVIEW_SESSION_ID.test(segments[3]) ? segments[3] : null;
}

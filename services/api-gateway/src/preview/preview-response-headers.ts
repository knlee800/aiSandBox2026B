/**
 * Response-header filter for the preview catch-all proxy (CM-CLEANUP-01B).
 *
 * Hop-by-hop headers (RFC 9110 section 7.6.1) describe one connection, not the
 * message, so a proxy must not forward them. On the non-stream path axios has
 * already decoded the body and Express re-serialises it, so the upstream
 * content-length and content-encoding no longer describe what is sent.
 */
const HOP_BY_HOP_HEADERS: ReadonlySet<string> = new Set([
  'connection',
  'keep-alive',
  'proxy-connection',
  'transfer-encoding',
  'te',
  'trailer',
  'upgrade',
  'proxy-authenticate',
  'proxy-authorization',
]);

const REENCODED_BODY_HEADERS: ReadonlySet<string> = new Set([
  'content-length',
  'content-encoding',
]);

export function filterProxyResponseHeaders(
  headers: Record<string, unknown> | undefined | null,
  options: { streamed: boolean },
): Record<string, any> {
  const result: Record<string, any> = {};
  if (!headers) return result;

  // Header names the upstream listed in its own Connection header.
  const connectionNamed = new Set<string>();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== 'connection' || value === undefined || value === null) continue;
    const text = Array.isArray(value) ? value.join(',') : String(value);
    for (const token of text.split(',')) {
      const name = token.trim().toLowerCase();
      if (name) connectionNamed.add(name);
    }
  }

  for (const [key, value] of Object.entries(headers)) {
    const lower = key.toLowerCase();
    if (value === undefined) continue;
    if (HOP_BY_HOP_HEADERS.has(lower) || connectionNamed.has(lower)) continue;
    if (!options.streamed && REENCODED_BODY_HEADERS.has(lower)) continue;
    result[key] = value;
  }
  return result;
}

/**
 * PREVIEW-ORIGIN-01 fail-safe. Every proxy response served on a host that
 * is not the preview host (including when PREVIEW_BASE_URL is unset) carries
 * this header. Without allow-same-origin the document gets an opaque
 * origin: its script cannot use the platform session, read platform cookies
 * or storage, or reach the parent page. Multi-file previews degrade (their
 * asset requests lose the session cookie) instead of running as the
 * platform.
 */
export const PREVIEW_CSP_HEADER = 'Content-Security-Policy';
export const PREVIEW_SANDBOX_CSP = 'sandbox allow-scripts allow-forms allow-modals allow-popups';

/**
 * Adds the fail-safe policy to forwarded headers. An upstream policy is
 * kept next to it (the browser enforces both), never in its place.
 */
export function withPreviewSandboxPolicy(headers: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  const upstream: string[] = [];
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === PREVIEW_CSP_HEADER.toLowerCase()) {
      for (const item of Array.isArray(value) ? value : [value]) {
        if (item !== undefined && item !== null && String(item).trim()) upstream.push(String(item));
      }
      continue;
    }
    result[key] = value;
  }
  result[PREVIEW_CSP_HEADER] = upstream.length > 0 ? [...upstream, PREVIEW_SANDBOX_CSP] : PREVIEW_SANDBOX_CSP;
  return result;
}

/**
 * Which host a forwarded preview response is served on (COOKIE-PREFIX-01).
 * - 'platform': the platform host (PreviewController: proxy in fail-safe
 *   mode, start, status). Nothing there needs a cookie from a preview or
 *   from container-manager, and on the platform host even a __Host- cookie
 *   could be set, so every upstream Set-Cookie is dropped.
 * - 'preview': the preview host (PreviewEntryController). Host-only app
 *   cookies pass, so a generated app's own sign-in works in the preview.
 */
export type PreviewCookieHost = 'platform' | 'preview';

const SET_COOKIE_HEADER = 'set-cookie';
const CLEAR_SITE_DATA_HEADER = 'clear-site-data';
const RESERVED_COOKIE_NAME_PART = 'aisandbox_';

/**
 * True when a preview-host app may keep this Set-Cookie line: no Domain
 * attribute (in any case, even empty), and a name that does not contain
 * aisandbox_ (in any case). A line without '=' in its first pair is judged
 * by that whole pair.
 */
export function isAllowedPreviewSetCookie(line: unknown): boolean {
  if (typeof line !== 'string') return false;
  const parts = line.split(';');
  const pair = parts[0] ?? '';
  const separator = pair.indexOf('=');
  const name = (separator < 0 ? pair : pair.slice(0, separator)).trim();
  if (name.toLowerCase().includes(RESERVED_COOKIE_NAME_PART)) return false;
  for (const attribute of parts.slice(1)) {
    const equals = attribute.indexOf('=');
    const key = (equals < 0 ? attribute : attribute.slice(0, equals)).trim().toLowerCase();
    if (key === 'domain') return false;
  }
  return true;
}

/**
 * Applies the COOKIE-PREFIX-01 cookie rule to forwarded upstream headers:
 * Clear-Site-Data is dropped on both hosts; Set-Cookie is dropped on the
 * platform host and limited to allowed lines on the preview host. Header
 * names match in any case. The input is not changed.
 */
export function limitPreviewCookieHeaders(
  headers: Record<string, any>,
  host: PreviewCookieHost,
): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(headers)) {
    const lower = key.toLowerCase();
    if (lower === CLEAR_SITE_DATA_HEADER) continue;
    if (lower === SET_COOKIE_HEADER) {
      if (host !== 'preview') continue;
      const kept = (Array.isArray(value) ? value : [value]).filter(isAllowedPreviewSetCookie);
      if (kept.length > 0) result[key] = kept;
      continue;
    }
    result[key] = value;
  }
  return result;
}

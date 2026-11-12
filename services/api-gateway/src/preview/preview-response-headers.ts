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

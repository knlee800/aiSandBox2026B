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

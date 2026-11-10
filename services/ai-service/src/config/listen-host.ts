/**
 * AI-SERVICE-AUTH-01 (D1): the address ai-service listens on.
 *
 * Reads LISTEN_HOST. Blank or unset means 127.0.0.1, so the service is
 * reachable from the host only (a sandbox container's 127.0.0.1 is its own).
 * HOST is deliberately not read: some shells set it to the machine name.
 */
export const DEFAULT_LISTEN_HOST = '127.0.0.1';

export function resolveListenHost(
  env: Record<string, string | undefined> = process.env,
): string {
  const raw = env.LISTEN_HOST;
  if (typeof raw !== 'string') {
    return DEFAULT_LISTEN_HOST;
  }
  const trimmed = raw.trim();
  return trimmed === '' ? DEFAULT_LISTEN_HOST : trimmed;
}

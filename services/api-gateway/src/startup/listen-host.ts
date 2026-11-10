/**
 * AI-SERVICE-AUTH-01 (D1): the address the gateway listens on.
 *
 * Reads LISTEN_HOST. Blank or unset means 127.0.0.1: Caddy, the frontend
 * server, ai-service and container-manager all call the gateway on the host.
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

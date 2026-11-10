/**
 * AI-SERVICE-AUTH-01 (D1): the address container-manager listens on.
 *
 * Reads LISTEN_HOST. Blank or unset means 127.0.0.1: the gateway and
 * ai-service call container-manager on the host, and previews flow the other
 * way (container-manager dials the container). A sandbox container's
 * 127.0.0.1 is its own, so it cannot reach this port.
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

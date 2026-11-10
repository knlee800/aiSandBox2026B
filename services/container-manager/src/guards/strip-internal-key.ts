import type { ClientRequest } from 'http';
import { INTERNAL_SERVICE_KEY_HEADER } from './internal-service-auth.guard';

/**
 * CM-AUTH-01 (D6): http-proxy-middleware `on.proxyReq` handler for every
 * container-manager proxy to a sandbox container. The gateway sends the
 * internal key to container-manager; it must never reach the sandbox's
 * preview server, so it is removed from the outgoing request before any
 * header is written.
 */
export function stripInternalServiceKey(proxyReq: ClientRequest): void {
  proxyReq.removeHeader(INTERNAL_SERVICE_KEY_HEADER);
}

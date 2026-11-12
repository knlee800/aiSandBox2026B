import { All, Controller, Optional, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import axios from 'axios';
import { SessionCookieGuard } from '../auth/session-cookie.guard';
import { PreviewOwnershipGuard } from './preview-ownership.guard';
import {
  isPreviewHostRequest,
  isPreviewProxySuffix,
  PreviewForward,
  PreviewHostConfig,
  readPreviewHostConfig,
  resolvePreviewForward,
} from './preview-host';
import {
  filterProxyResponseHeaders,
  PREVIEW_CSP_HEADER,
  PREVIEW_SANDBOX_CSP,
  withPreviewSandboxPolicy,
} from './preview-response-headers';
import { getProcessPreviewTickets, PreviewTickets } from './preview-ticket';

// CM-AUTH-01 (D5) path shapes; moved to preview-host.ts by PREVIEW-ORIGIN-01
// (the access guard and the entry controller use them too).
export { resolvePreviewForward } from './preview-host';
export type { PreviewForward } from './preview-host';

const PROXY_HEADER_DENYLIST = new Set([
  'host',
  'cookie',
  'authorization',
  'proxy-authorization',
  'x-internal-service-key',
  'x-csrf-token',
  'x-forwarded-user',
  'x-user-id',
  'x-session-id',
]);

export function sanitizeProxyHeaders(
  headers: Record<string, string | string[] | undefined>,
): Record<string, string | string[] | undefined> {
  return Object.fromEntries(
    Object.entries(headers).filter(
      ([key]) => !PROXY_HEADER_DENYLIST.has(key.toLowerCase()),
    ),
  );
}

export const INTERNAL_SERVICE_KEY_HEADER = 'X-Internal-Service-Key';

/**
 * CM-AUTH-01 (D5): build the container-manager URL for an allowed shape from
 * encodeURIComponent(sid) and the allowed suffix, then check that URL parsing
 * kept it on the same origin and inside /api/preview/<sid>/.
 */
export function buildPreviewTargetUrl(
  containerManagerUrl: string,
  forward: PreviewForward,
): string | null {
  let base: URL;
  try {
    base = new URL(containerManagerUrl);
  } catch {
    return null;
  }
  const basePath = base.pathname.replace(/\/+$/, '');
  const prefix = `${basePath}/api/preview/${encodeURIComponent(forward.sessionId)}/`;
  const url = `${base.origin}${prefix}${forward.suffix}`;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.origin !== base.origin || !parsed.pathname.startsWith(prefix)) {
    return null;
  }
  return url;
}

/** Container-manager URL; read where each controller is made. */
export function previewContainerManagerUrl(): string {
  return process.env.CONTAINER_MANAGER_URL || 'http://localhost:4002';
}

/**
 * CM-AUTH-01 (D4): the key header for a container-manager call, or none when
 * the key is unset. Never logged; never sent to the browser.
 */
export function previewInternalKeyHeaders(internalServiceKey: string): Record<string, string> {
  return internalServiceKey ? { [INTERNAL_SERVICE_KEY_HEADER]: internalServiceKey } : {};
}

/**
 * Forwards one allowed preview request to container-manager and copies the
 * answer back. Shared by the platform-host catch-all and the preview-host
 * proxy route, so the container-manager request is the same on both: same
 * path, same stripped headers, same internal key. With failSafe the CSP
 * sandbox policy is added to the response headers.
 */
export async function forwardPreviewRequest(args: {
  req: Request;
  res: Response;
  forward: PreviewForward;
  url: string;
  keyHeaders: Record<string, string>;
  failSafe: boolean;
}): Promise<void> {
  const { req, res, forward, url, keyHeaders, failSafe } = args;
  const isProxy = isPreviewProxySuffix(forward.suffix);
  try {
    console.log(`[Preview Proxy] ${req.method} ${req.path} -> ${url}`);

    const response = await axios({
      method: req.method,
      url,
      data: req.body,
      params: req.query,
      // CM-AUTH-01 (D4): sanitize first, so a browser-sent key is dropped,
      // then add the server key.
      headers: { ...sanitizeProxyHeaders(req.headers), ...keyHeaders },
      responseType: isProxy ? 'stream' : 'json',
      validateStatus: () => true, // Don't throw on any status
    });

    const streamed = Boolean(isProxy && response.data && response.data.pipe);

    // Copy response headers, minus hop-by-hop headers (and, when Express
    // re-serialises the body, content-length / content-encoding).
    const filteredHeaders = filterProxyResponseHeaders(response.headers, { streamed });
    const forwardedHeaders = failSafe ? withPreviewSandboxPolicy(filteredHeaders) : filteredHeaders;
    Object.keys(forwardedHeaders).forEach(key => {
      res.setHeader(key, forwardedHeaders[key]);
    });

    // Set status code
    res.status(response.status);

    // Handle streaming response for proxy
    if (streamed) {
      response.data.pipe(res);
    } else {
      res.send(response.data);
    }
  } catch (error) {
    console.error('[Preview Proxy] Error:', error.message);
    res.status(502).json({
      error: 'Proxy error',
      message: 'Failed to connect to container manager',
    });
  }
}

/** The raw query string of a request, with its leading '?', or ''. */
function rawQueryOf(req: Request): string {
  const raw = typeof req.originalUrl === 'string' ? req.originalUrl : req.url;
  if (typeof raw !== 'string') return '';
  const index = raw.indexOf('?');
  return index < 0 ? '' : raw.slice(index);
}

/**
 * Preview routes on the platform host. PREVIEW-ORIGIN-01: the preview host's
 * enter and proxy routes live in PreviewEntryController, registered before
 * this one; a request reaches this controller only when it is not on the
 * preview host. Proxy responses here are never preview content with
 * platform-origin rights: with PREVIEW_BASE_URL set they are a 302 to the
 * preview host, and without it they carry the CSP sandbox fail-safe.
 */
@UseGuards(SessionCookieGuard, PreviewOwnershipGuard)
@Controller('preview')
export class PreviewController {
  private readonly containerManagerUrl = previewContainerManagerUrl();
  // CM-AUTH-01 (D4): container-manager needs the internal key on every
  // preview route. Read once; never logged; never sent to the browser.
  private readonly internalServiceKey = process.env.INTERNAL_SERVICE_KEY || '';
  private readonly tickets: PreviewTickets;

  constructor(@Optional() tickets?: PreviewTickets) {
    this.tickets = tickets ?? getProcessPreviewTickets();
  }

  /** The key header for a container-manager call, or none when unset. */
  private internalKeyHeaders(): Record<string, string> {
    return previewInternalKeyHeaders(this.internalServiceKey);
  }

  private refuse(res: Response) {
    return res.status(404).json({ statusCode: 404, message: 'Not Found' });
  }

  @Post(':sessionId/stop')
  async stopPreview(
    @Param('sessionId') sessionId: string,
    @Res() res: Response,
    @Req() req?: Request,
  ) {
    // PREVIEW-ORIGIN-01: no preview action except proxy on the preview host.
    if (req && isPreviewHostRequest(req, readPreviewHostConfig())) {
      return this.refuse(res);
    }
    // CM-AUTH-01 (D5): the same sid check as the catch-all, on the raw path
    // the ownership guard read; the decoded param must be that same value.
    const forward = resolvePreviewForward('POST', req?.path ?? `/api/preview/${sessionId}/stop`);
    const url =
      forward && forward.suffix === 'stop' && forward.sessionId === sessionId
        ? buildPreviewTargetUrl(this.containerManagerUrl, forward)
        : null;
    if (!url) {
      return this.refuse(res);
    }

    try {
      console.log(`[Preview Stop] POST /api/preview/${sessionId}/stop -> ${url}`);

      const keyHeaders = this.internalKeyHeaders();
      const response = await axios({
        method: 'POST',
        url,
        responseType: 'json',
        validateStatus: () => true,
        ...(Object.keys(keyHeaders).length > 0 ? { headers: keyHeaders } : {}),
      });

      res.status(response.status).json(response.data);
    } catch (error) {
      console.error('[Preview Stop] Error:', error.message);
      res.status(502).json({
        error: 'Proxy error',
        message: 'Failed to connect to container manager',
      });
    }
  }

  /**
   * PREVIEW-ORIGIN-01: on the platform host with the preview host set, a
   * proxy request is answered with a 302 to the preview host's enter route,
   * carrying a 60-second, single-use ticket bound to this session, this user
   * and this proxy path and query. Container-manager is not called.
   */
  private redirectToPreviewHost(
    req: Request,
    res: Response,
    forward: PreviewForward,
    config: PreviewHostConfig,
  ) {
    const userId = (req as Request & { user?: { userId?: string } }).user?.userId;
    const ticket =
      typeof userId === 'string' && userId.trim().length > 0
        ? this.tickets.issueTicket(forward.sessionId, userId, `${forward.suffix}${rawQueryOf(req)}`)
        : null;
    if (!ticket) {
      return res.status(403).json({ statusCode: 403, message: 'Preview access forbidden' });
    }
    const location =
      `${config.origin}/api/preview/${encodeURIComponent(forward.sessionId)}/enter` +
      `?ticket=${encodeURIComponent(ticket)}`;
    // The ticket is in the Location only: never logged, never cached, and
    // not passed on as a referrer.
    console.log(`[Preview Proxy] ${req.method} ${req.path} -> preview host`);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    return res.redirect(302, location);
  }

  @All('*')
  async proxyToContainerManager(
    @Req() req: Request,
    @Res() res: Response,
  ) {
    // CM-AUTH-01 (D5): only the allowed preview shapes are forwarded, so a
    // key-bearing call can never be steered to another container-manager
    // route (for example /api/preview/<own>/%2e%2e/%2e%2e/files/<other>/list).
    const forward = resolvePreviewForward(req.method, req.path);
    const isProxy = Boolean(forward && isPreviewProxySuffix(forward.suffix));
    const previewHost = readPreviewHostConfig();
    if (isPreviewHostRequest(req, previewHost)) {
      // The preview host is served by PreviewEntryController only.
      return this.refuse(res);
    }
    // PREVIEW-ORIGIN-01 fail-safe: proxy answers off the preview host are
    // always sandboxed to an opaque origin.
    if (isProxy) {
      res.setHeader(PREVIEW_CSP_HEADER, PREVIEW_SANDBOX_CSP);
    }

    const url = forward ? buildPreviewTargetUrl(this.containerManagerUrl, forward) : null;
    if (!forward || !url) {
      return this.refuse(res);
    }

    if (isProxy && previewHost) {
      return this.redirectToPreviewHost(req, res, forward, previewHost);
    }

    return forwardPreviewRequest({
      req,
      res,
      forward,
      url,
      keyHeaders: this.internalKeyHeaders(),
      failSafe: isProxy,
    });
  }
}

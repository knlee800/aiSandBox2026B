import { All, Controller, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import axios from 'axios';
import { SessionCookieGuard } from '../auth/session-cookie.guard';
import { PreviewOwnershipGuard } from './preview-ownership.guard';
import { filterProxyResponseHeaders } from './preview-response-headers';

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

/** Gateway session ids are UUIDs; the specs use ids like session-123. */
const PREVIEW_SESSION_ID = /^[A-Za-z0-9_-]{1,128}$/;

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

@UseGuards(SessionCookieGuard, PreviewOwnershipGuard)
@Controller('preview')
export class PreviewController {
  private readonly containerManagerUrl = process.env.CONTAINER_MANAGER_URL || 'http://localhost:4002';
  // CM-AUTH-01 (D4): container-manager needs the internal key on every
  // preview route. Read once; never logged; never sent to the browser.
  private readonly internalServiceKey = process.env.INTERNAL_SERVICE_KEY || '';

  /** The key header for a container-manager call, or none when unset. */
  private internalKeyHeaders(): Record<string, string> {
    return this.internalServiceKey
      ? { [INTERNAL_SERVICE_KEY_HEADER]: this.internalServiceKey }
      : {};
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

  @All('*')
  async proxyToContainerManager(
    @Req() req: Request,
    @Res() res: Response,
  ) {
    // CM-AUTH-01 (D5): only the allowed preview shapes are forwarded, so a
    // key-bearing call can never be steered to another container-manager
    // route (for example /api/preview/<own>/%2e%2e/%2e%2e/files/<other>/list).
    const forward = resolvePreviewForward(req.method, req.path);
    const url = forward ? buildPreviewTargetUrl(this.containerManagerUrl, forward) : null;
    if (!forward || !url) {
      return this.refuse(res);
    }
    const isProxy = forward.suffix === 'proxy' || forward.suffix.startsWith('proxy/');

    try {
      console.log(`[Preview Proxy] ${req.method} ${req.path} -> ${url}`);

      const response = await axios({
        method: req.method,
        url,
        data: req.body,
        params: req.query,
        // CM-AUTH-01 (D4): sanitize first, so a browser-sent key is dropped,
        // then add the server key.
        headers: { ...sanitizeProxyHeaders(req.headers), ...this.internalKeyHeaders() },
        responseType: isProxy ? 'stream' : 'json',
        validateStatus: () => true, // Don't throw on any status
      });

      const streamed = Boolean(isProxy && response.data && response.data.pipe);

      // Copy response headers, minus hop-by-hop headers (and, when Express
      // re-serialises the body, content-length / content-encoding).
      const forwardedHeaders = filterProxyResponseHeaders(response.headers, { streamed });
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
}

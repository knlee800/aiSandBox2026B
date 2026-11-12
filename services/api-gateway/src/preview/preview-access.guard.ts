import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { SessionService } from '../sessions/session.service';
import {
  isPreviewHostRequest,
  isPreviewProxySuffix,
  PREVIEW_COOKIE_NAME,
  readPreviewHostConfig,
  resolvePreviewEnter,
  resolvePreviewForward,
} from './preview-host';
import { getProcessPreviewTickets, PreviewTickets } from './preview-ticket';

export type PreviewAccessRequest = Request & {
  user?: { userId?: string };
  previewAccess?: { sessionId: string; userId: string };
};

/**
 * Every value the Cookie header carries for one name. A preview script can
 * add a same-named cookie with a longer path; trying each value means it
 * can only add noise, never shadow the real one.
 */
export function readCookieValues(header: unknown, name: string): string[] {
  if (typeof header !== 'string' || header.length === 0) return [];
  const values: string[] = [];
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    if (part.slice(0, index).trim() !== name) continue;
    let value = part.slice(index + 1).trim();
    if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
      value = value.slice(1, -1);
    }
    try {
      values.push(decodeURIComponent(value));
    } catch {
      // A value that does not decode cannot be a valid preview cookie.
    }
  }
  return values;
}

/**
 * PREVIEW-ORIGIN-01: access to proxy content on the preview host.
 *
 * Used only on PreviewEntryController's proxy routes, which are registered
 * before PreviewController's catch-all:
 * - On the preview host it is the only check. The platform session cookie
 *   is never read. The request must be a proxy GET/HEAD shape (anything
 *   else is 404) and carry a valid aisandbox_preview cookie for that
 *   session, whose user still owns the session; otherwise 403. On success
 *   it records request.previewAccess.
 * - On any other host it lets the request through without recording
 *   anything, and the route handler at once hands the request to
 *   PreviewController (next()), whose unchanged SessionCookieGuard and
 *   PreviewOwnershipGuard then apply. It never grants access off the
 *   preview host.
 */
@Injectable()
export class PreviewAccessGuard implements CanActivate {
  private readonly tickets: PreviewTickets;

  constructor(
    @Optional() private readonly sessionService?: SessionService,
    @Optional() tickets?: PreviewTickets,
  ) {
    this.tickets = tickets ?? getProcessPreviewTickets();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<PreviewAccessRequest>();
    delete request.previewAccess;
    if (!isPreviewHostRequest(request, readPreviewHostConfig())) {
      return true;
    }

    const forward = resolvePreviewForward(request.method, request.path);
    if (!forward || !isPreviewProxySuffix(forward.suffix)) {
      throw new NotFoundException();
    }
    const userId = this.previewCookieUser(request, forward.sessionId);
    if (!userId || !(await this.ownsSession(forward.sessionId, userId))) {
      throw new ForbiddenException('Preview access forbidden');
    }
    request.previewAccess = { sessionId: forward.sessionId, userId };
    return true;
  }

  private previewCookieUser(request: Request, sessionId: string): string | null {
    for (const value of readCookieValues(request.headers?.cookie, PREVIEW_COOKIE_NAME)) {
      const claims = this.tickets.verifyAccess(value, sessionId);
      if (claims) return claims.userId;
    }
    return null;
  }

  private async ownsSession(sessionId: string, userId: string): Promise<boolean> {
    if (!this.sessionService) return false;
    try {
      const session = await this.sessionService.getSessionById(sessionId);
      return Boolean(session) && session.userId === userId;
    } catch {
      return false;
    }
  }
}

/**
 * PREVIEW-ORIGIN-01: on the preview host the gateway serves only enter and
 * proxy GET/HEAD. Every other request that arrives there (another preview
 * action, /api/keys, anything) is 404 before routing and before any guard,
 * so the preview host never reaches a platform route or a route that reads
 * the session cookie, even if the host proxy forwards more than
 * /api/preview/*. On any other host this does nothing.
 */
export function previewHostRouteFilter(req: Request, res: Response, next: NextFunction): void {
  if (!isPreviewHostRequest(req, readPreviewHostConfig())) {
    next();
    return;
  }
  const rawUrl = typeof req.originalUrl === 'string' ? req.originalUrl : req.url;
  const rawPath = String(rawUrl ?? '').split('?')[0];
  const forward = resolvePreviewForward(req.method, rawPath);
  const allowed =
    resolvePreviewEnter(req.method, rawPath) !== null ||
    Boolean(forward && isPreviewProxySuffix(forward.suffix));
  if (allowed) {
    next();
    return;
  }
  res.status(404).json({ statusCode: 404, message: 'Not Found' });
}

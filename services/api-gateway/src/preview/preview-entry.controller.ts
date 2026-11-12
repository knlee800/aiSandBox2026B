import { Controller, Get, Next, Optional, Req, Res, UseGuards } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { SessionService } from '../sessions/session.service';
import { PreviewAccessGuard, PreviewAccessRequest } from './preview-access.guard';
import { buildPreviewBridgeScript } from './preview-bridge-script';
import {
  isPreviewBridgeSuffix,
  isPreviewHostRequest,
  isPreviewProxySuffix,
  isReservedPreviewSuffix,
  PREVIEW_COOKIE_NAME,
  previewCookieSecure,
  readPlatformOrigin,
  readPreviewHostConfig,
  resolvePreviewEnter,
  resolvePreviewForward,
} from './preview-host';
import { PREVIEW_CSP_HEADER, PREVIEW_SANDBOX_CSP } from './preview-response-headers';
import { getProcessPreviewTickets, PREVIEW_ACCESS_TTL_MS, PreviewTickets } from './preview-ticket';
import {
  buildPreviewTargetUrl,
  forwardPreviewRequest,
  previewContainerManagerUrl,
  previewInternalKeyHeaders,
} from './preview.controller';

/**
 * PREVIEW-ORIGIN-01: the preview host's two routes.
 *
 * PreviewModule lists this controller before PreviewController, so Express
 * tries these routes before PreviewController's catch-all. A request that is
 * not on the preview host is handed straight on (next()) to
 * PreviewController, whose SessionCookieGuard and PreviewOwnershipGuard are
 * unchanged. On the preview host the platform session cookie is never read.
 *
 * GET /api/preview/<sid>/enter?ticket=…
 *   Only on the preview host (404 anywhere else, including when
 *   PREVIEW_BASE_URL is unset). It checks the ticket the platform host
 *   minted (signed, 60 seconds, single use, bound to this session and
 *   user), checks that the user still owns the session, sets the
 *   aisandbox_preview cookie (httpOnly, SameSite=Lax, host-only, Path
 *   /api/preview/<sid>/, 12 hours, Secure on https or in production) and
 *   redirects to the proxy path the ticket names, on this same host.
 *
 * GET/HEAD /api/preview/<sid>/proxy and /proxy/<rest>
 *   On the preview host, PreviewAccessGuard requires a valid
 *   aisandbox_preview cookie for the session; the request then goes to
 *   container-manager exactly as on the platform host (same path, same
 *   stripped headers, same internal key), without the sandbox policy.
 *
 * PREVIEW-PICKER-01: proxy/__aisb/... is reserved and never forwarded. Behind
 *   the same guard, proxy/__aisb/bridge.js is the preview bridge script with
 *   the platform origin from APP_BASE_URL written in (404 when APP_BASE_URL
 *   is unusable); every other reserved path is 404.
 */
@Controller('preview')
export class PreviewEntryController {
  private readonly containerManagerUrl = previewContainerManagerUrl();
  private readonly internalServiceKey = process.env.INTERNAL_SERVICE_KEY || '';
  private readonly tickets: PreviewTickets;

  constructor(
    @Optional() private readonly sessionService?: SessionService,
    @Optional() tickets?: PreviewTickets,
  ) {
    this.tickets = tickets ?? getProcessPreviewTickets();
  }

  private answer(res: Response, status: 403 | 404) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    return res
      .status(status)
      .json(
        status === 404
          ? { statusCode: 404, message: 'Not Found' }
          : { statusCode: 403, message: 'Preview link expired or invalid' },
      );
  }

  /**
   * PREVIEW-PICKER-01: the bridge script for proxy/__aisb/bridge.js, 404 for
   * any other reserved path or when APP_BASE_URL is unusable.
   */
  private answerReserved(res: Response, suffix: string) {
    const platformOrigin = readPlatformOrigin();
    const script =
      isPreviewBridgeSuffix(suffix) && platformOrigin ? buildPreviewBridgeScript(platformOrigin) : null;
    if (!script) {
      return this.answer(res, 404);
    }
    res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    return res.status(200).send(script);
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

  @Get(':sessionId/enter')
  async enter(@Req() req: Request, @Res() res: Response) {
    const config = readPreviewHostConfig();
    const sessionId = resolvePreviewEnter(req.method, req.path);
    if (!config || !isPreviewHostRequest(req, config) || !sessionId) {
      return this.answer(res, 404);
    }

    const ticket = req.query?.ticket;
    const claims = typeof ticket === 'string' ? this.tickets.verifyTicket(ticket, sessionId) : null;
    if (!claims) {
      return this.answer(res, 403);
    }

    // The ticket's path is signed, but check it is still a proxy shape.
    const targetPath = claims.target.split('?')[0];
    const forward = resolvePreviewForward('GET', `/api/preview/${sessionId}/${targetPath}`);
    if (!forward || forward.sessionId !== sessionId || !isPreviewProxySuffix(forward.suffix)) {
      return this.answer(res, 403);
    }

    if (!(await this.ownsSession(sessionId, claims.userId))) {
      return this.answer(res, 403);
    }

    const access = this.tickets.issueAccess(sessionId, claims.userId);
    if (!access || !this.tickets.consumeTicket(claims)) {
      return this.answer(res, 403);
    }

    res.cookie(PREVIEW_COOKIE_NAME, access, {
      httpOnly: true,
      secure: previewCookieSecure(config),
      sameSite: 'lax',
      path: `/api/preview/${sessionId}/`,
      maxAge: PREVIEW_ACCESS_TTL_MS,
    });
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    // A path on this same host: never an open redirect.
    return res.redirect(302, `/api/preview/${sessionId}/${claims.target}`);
  }

  @UseGuards(PreviewAccessGuard)
  @Get([':sessionId/proxy', ':sessionId/proxy/*'])
  async previewHostProxy(
    @Req() req: PreviewAccessRequest,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    const access = req.previewAccess;
    if (!access) {
      // Not the preview host: PreviewController answers, under its own
      // guards. The fail-safe policy is set now so that a refusal from
      // those guards carries it too.
      res.setHeader(PREVIEW_CSP_HEADER, PREVIEW_SANDBOX_CSP);
      return next();
    }

    const forward = resolvePreviewForward(req.method, req.path);
    const url = forward ? buildPreviewTargetUrl(this.containerManagerUrl, forward) : null;
    if (
      !forward ||
      !url ||
      forward.sessionId !== access.sessionId ||
      !isPreviewProxySuffix(forward.suffix)
    ) {
      return this.answer(res, 404);
    }

    // PREVIEW-PICKER-01: the reserved prefix is answered here, never forwarded.
    if (isReservedPreviewSuffix(forward.suffix)) {
      return this.answerReserved(res, forward.suffix);
    }

    return forwardPreviewRequest({
      req,
      res,
      forward,
      url,
      keyHeaders: previewInternalKeyHeaders(this.internalServiceKey),
      failSafe: false,
      // COOKIE-PREFIX-01: host-only app cookies pass; Domain or platform names do not.
      cookieHost: 'preview',
    });
  }
}

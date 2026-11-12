import { ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import {
  PreviewAccessGuard,
  PreviewAccessRequest,
  previewHostRouteFilter,
  readCookieValues,
} from '../preview-access.guard';
import { PreviewEntryController } from '../preview-entry.controller';
import { PreviewController } from '../preview.controller';
import { PreviewModule } from '../preview.module';
import { PreviewTickets } from '../preview-ticket';

/**
 * PREVIEW-ORIGIN-01 (stage-start 4.3 item 4, guard level): on the preview
 * host only a valid aisandbox_preview cookie for the session, whose user
 * still owns the session, opens proxy content; the session cookie is never
 * read. Off the preview host the guard grants nothing: the request is
 * handed to PreviewController and its unchanged guards.
 */

const PREVIEW = 'preview.staging.ainow.biz';
const PLATFORM = 'staging.ainow.biz';
const SID = 'session-1';

const ENV_NAMES = ['PREVIEW_BASE_URL', 'APP_BASE_URL'] as const;
const savedEnv: Record<string, string | undefined> = {};

beforeAll(() => {
  for (const name of ENV_NAMES) savedEnv[name] = process.env[name];
});
afterAll(() => {
  for (const name of ENV_NAMES) {
    if (savedEnv[name] === undefined) delete process.env[name];
    else process.env[name] = savedEnv[name];
  }
});
beforeEach(() => {
  process.env.PREVIEW_BASE_URL = `https://${PREVIEW}`;
  process.env.APP_BASE_URL = `https://${PLATFORM}`;
});

function makeRequest(args: {
  host?: string;
  forwardedHost?: string;
  method?: string;
  path?: string;
  cookie?: string;
}): PreviewAccessRequest {
  const headers: Record<string, string> = {};
  if (args.host) headers.host = args.host;
  if (args.forwardedHost) headers['x-forwarded-host'] = args.forwardedHost;
  if (args.cookie) headers.cookie = args.cookie;
  return {
    method: args.method ?? 'GET',
    path: args.path ?? `/api/preview/${SID}/proxy`,
    headers,
  } as unknown as PreviewAccessRequest;
}

function contextFor(request: PreviewAccessRequest): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => ({}) }),
  } as unknown as ExecutionContext;
}

describe('PreviewAccessGuard', () => {
  let tickets: PreviewTickets;
  let getSessionById: jest.Mock;
  let guard: PreviewAccessGuard;

  beforeEach(() => {
    tickets = new PreviewTickets({ key: randomBytes(32) });
    getSessionById = jest.fn().mockResolvedValue({ userId: 'user-1' });
    guard = new PreviewAccessGuard({ getSessionById } as never, tickets);
  });

  function cookieFor(sessionId = SID, userId = 'user-1') {
    return `aisandbox_preview=${tickets.issueAccess(sessionId, userId)}`;
  }

  describe('on the preview host', () => {
    it('allows a proxy GET with a valid preview cookie and records the access', async () => {
      const request = makeRequest({ host: PREVIEW, forwardedHost: PREVIEW, cookie: cookieFor() });
      await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
      expect(request.previewAccess).toEqual({ sessionId: SID, userId: 'user-1' });
      expect(getSessionById).toHaveBeenCalledWith(SID);
    });

    it('allows HEAD and an asset path', async () => {
      for (const [method, path] of [
        ['HEAD', `/api/preview/${SID}/proxy`],
        ['GET', `/api/preview/${SID}/proxy/assets/app.js`],
        ['GET', `/api/preview/${SID}/proxy/`],
      ]) {
        const request = makeRequest({ host: PREVIEW, method, path, cookie: cookieFor() });
        await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
      }
    });

    it('refuses no cookie', async () => {
      const request = makeRequest({ host: PREVIEW });
      await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(ForbiddenException);
      expect(request.previewAccess).toBeUndefined();
    });

    it("refuses another session's cookie", async () => {
      const request = makeRequest({ host: PREVIEW, cookie: cookieFor('session-2') });
      await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('refuses when the session now belongs to another user', async () => {
      getSessionById.mockResolvedValue({ userId: 'user-2' });
      const request = makeRequest({ host: PREVIEW, cookie: cookieFor() });
      await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('refuses when the session is gone or the lookup fails', async () => {
      getSessionById.mockRejectedValue(new Error('not found'));
      const request = makeRequest({ host: PREVIEW, cookie: cookieFor() });
      await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('refuses when there is no session service', async () => {
      const bare = new PreviewAccessGuard(undefined, tickets);
      const request = makeRequest({ host: PREVIEW, cookie: cookieFor() });
      await expect(bare.canActivate(contextFor(request))).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('refuses the platform session cookie alone and never reads it', async () => {
      const request = makeRequest({
        host: PREVIEW,
        cookie: 'aisandbox_session=valid-platform-session; aisandbox_csrf=abc',
      });
      await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(ForbiddenException);
      expect(getSessionById).not.toHaveBeenCalled();
    });

    it('refuses an altered or expired cookie and a ticket used as a cookie', async () => {
      let clock = Date.now();
      const timed = new PreviewTickets({ key: randomBytes(32), now: () => clock });
      const timedGuard = new PreviewAccessGuard({ getSessionById } as never, timed);
      const value = timed.issueAccess(SID, 'user-1')!;
      const ticket = timed.issueTicket(SID, 'user-1', 'proxy')!;
      for (const cookie of [`aisandbox_preview=${value}x`, `aisandbox_preview=${ticket}`]) {
        await expect(
          timedGuard.canActivate(contextFor(makeRequest({ host: PREVIEW, cookie }))),
        ).rejects.toBeInstanceOf(ForbiddenException);
      }
      clock += 12 * 60 * 60 * 1000;
      await expect(
        timedGuard.canActivate(contextFor(makeRequest({ host: PREVIEW, cookie: `aisandbox_preview=${value}` }))),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('finds the valid cookie behind a same-named decoy with a longer path', async () => {
      const request = makeRequest({
        host: PREVIEW,
        cookie: `aisandbox_preview=decoy; ${cookieFor()}`,
      });
      await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    });

    it.each([
      ['GET', `/api/preview/${SID}/status`],
      ['POST', `/api/preview/${SID}/start`],
      ['POST', `/api/preview/${SID}/stop`],
      ['DELETE', `/api/preview/${SID}/stop`],
      ['POST', `/api/preview/${SID}/proxy`],
      ['GET', `/api/preview/${SID}/enter`],
      ['GET', `/api/preview/${SID}/proxy/%2e%2e/%2e%2e/files/x/list`],
      ['GET', '/api/keys'],
    ])('answers 404 for %s %s even with a valid cookie', async (method, path) => {
      const request = makeRequest({ host: PREVIEW, method, path, cookie: cookieFor() });
      await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(NotFoundException);
      expect(getSessionById).not.toHaveBeenCalled();
    });
  });

  describe('off the preview host', () => {
    it.each([
      ['the platform host behind Caddy', { host: PLATFORM, forwardedHost: PLATFORM }],
      ['the local Next rewrite', { host: 'localhost:4000', forwardedHost: 'localhost:3000' }],
      ['a spoofed X-Forwarded-Host on the platform host', { host: PLATFORM, forwardedHost: PREVIEW }],
    ])('grants nothing on %s and hands the request on', async (_label, hosts) => {
      const request = makeRequest({ ...hosts, cookie: cookieFor() });
      (request as PreviewAccessRequest).previewAccess = { sessionId: SID, userId: 'stale' };
      await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
      expect(request.previewAccess).toBeUndefined();
      expect(getSessionById).not.toHaveBeenCalled();
    });

    it('grants nothing when PREVIEW_BASE_URL is unset, even with Host equal to a preview name', async () => {
      delete process.env.PREVIEW_BASE_URL;
      const request = makeRequest({ host: PREVIEW, cookie: cookieFor() });
      await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
      expect(request.previewAccess).toBeUndefined();
    });
  });
});

describe('readCookieValues', () => {
  it('returns every value for the name, decoded and unquoted', () => {
    expect(readCookieValues('a=1; aisandbox_preview=x%2Ey; b=2; aisandbox_preview="z"', 'aisandbox_preview')).toEqual([
      'x.y',
      'z',
    ]);
  });

  it('ignores other names, prefixes and undecodable values', () => {
    expect(readCookieValues('xaisandbox_preview=1; aisandbox_previewx=2; aisandbox_preview=%E0%A4%A', 'aisandbox_preview')).toEqual([]);
    expect(readCookieValues(undefined, 'aisandbox_preview')).toEqual([]);
    expect(readCookieValues(['aisandbox_preview=1'], 'aisandbox_preview')).toEqual([]);
  });
});

describe('previewHostRouteFilter', () => {
  function run(request: Record<string, unknown>) {
    const next = jest.fn();
    const json = jest.fn();
    const res = { status: jest.fn().mockReturnValue({ json }) };
    previewHostRouteFilter(request as never, res as never, next);
    return { next, status: res.status, json };
  }

  function previewRequest(method: string, originalUrl: string, host = PREVIEW) {
    return { method, originalUrl, url: originalUrl, headers: { host, 'x-forwarded-host': host } };
  }

  it.each([
    ['GET', `/api/preview/${SID}/enter?ticket=abc`],
    ['HEAD', `/api/preview/${SID}/enter`],
    ['GET', `/api/preview/${SID}/proxy?refresh=2`],
    ['HEAD', `/api/preview/${SID}/proxy`],
    ['GET', `/api/preview/${SID}/proxy/assets/app.js`],
  ])('lets %s %s through on the preview host', (method, url) => {
    const { next, status } = run(previewRequest(method, url));
    expect(next).toHaveBeenCalledTimes(1);
    expect(status).not.toHaveBeenCalled();
  });

  it.each([
    ['GET', `/api/preview/${SID}/status`],
    ['POST', `/api/preview/${SID}/start`],
    ['POST', `/api/preview/${SID}/stop`],
    ['POST', `/api/preview/${SID}/enter`],
    ['POST', `/api/preview/${SID}/proxy`],
    ['GET', `/api/preview/${SID}/enter/x`],
    ['GET', `/api/preview/${SID}/proxy/%2e%2e/%2e%2e/files/x/list`],
    ['GET', '/api/keys'],
    ['GET', '/api/auth/me'],
    ['POST', '/api/admin/entitlements'],
    ['GET', '/api/health'],
  ])('answers 404 to %s %s on the preview host', (method, url) => {
    const { next, status, json } = run(previewRequest(method, url));
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({ statusCode: 404, message: 'Not Found' });
  });

  it.each([
    ['the platform host', PLATFORM],
    ['the local gateway host', 'localhost:4000'],
  ])('does nothing on %s', (_label, host) => {
    for (const url of ['/api/keys', `/api/preview/${SID}/status`, `/api/preview/${SID}/proxy`]) {
      const { next, status } = run(previewRequest('GET', url, host));
      expect(next).toHaveBeenCalledTimes(1);
      expect(status).not.toHaveBeenCalled();
    }
  });

  it('does nothing when PREVIEW_BASE_URL is unset', () => {
    delete process.env.PREVIEW_BASE_URL;
    const { next } = run(previewRequest('GET', '/api/keys'));
    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe('PreviewModule wiring', () => {
  it('registers PreviewEntryController before the PreviewController catch-all', () => {
    expect(Reflect.getMetadata('controllers', PreviewModule)).toEqual([
      PreviewEntryController,
      PreviewController,
    ]);
  });

  it('applies the preview-host route filter to every route', () => {
    const forRoutes = jest.fn();
    const apply = jest.fn().mockReturnValue({ forRoutes });
    new PreviewModule().configure({ apply } as never);
    expect(apply).toHaveBeenCalledWith(previewHostRouteFilter);
    expect(forRoutes).toHaveBeenCalledWith({ path: '*', method: expect.anything() });
  });

  it('guards the preview-host proxy route with PreviewAccessGuard, and not enter', () => {
    const proxyGuards = Reflect.getMetadata('__guards__', PreviewEntryController.prototype.previewHostProxy) || [];
    const enterGuards = Reflect.getMetadata('__guards__', PreviewEntryController.prototype.enter) || [];
    expect(proxyGuards).toEqual([PreviewAccessGuard]);
    expect(enterGuards).toEqual([]);
    expect(Reflect.getMetadata('__guards__', PreviewEntryController) || []).toEqual([]);
  });
});

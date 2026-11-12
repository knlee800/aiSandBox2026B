import { Controller, Get, INestApplication, Post, Req, UseGuards } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import cookieParser from 'cookie-parser';
import cookieSession from 'cookie-session';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { SameOriginWriteGuard } from '../../guards/same-origin-write.guard';
import { ApiKeyAuthGuard } from '../api-key-auth.guard';
import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';
import { CsrfGuard } from '../csrf.guard';
import { EntitlementService } from '../entitlement.service';
import { csrfCookieMiddleware, oauthStateSessionOptions } from '../platform-cookies';
import { SessionCookieGuard } from '../session-cookie.guard';
import { SessionOrApiKeyAuthGuard } from '../session-or-api-key.guard';

/**
 * COOKIE-PREFIX-01 over HTTP: the real cookie-parser, the CSRF middleware and
 * cookie-session wired as in main.ts, the real AuthController login and
 * logout, SessionCookieGuard, SessionOrApiKeyAuthGuard, CsrfGuard and the
 * global SameOriginWriteGuard (stage-start 6.3 items 2 to 5, 8 and 9).
 */

const APP_ORIGIN = 'https://staging.ainow.biz';
const LOCAL_ORIGIN = 'http://localhost:3000';
const GOOD_TOKEN = 'good-session-token';

@Controller('probe')
class ProbeController {
  @Get('session')
  @UseGuards(SessionCookieGuard)
  session(@Req() req: Request & { user?: { userId: string } }) {
    return { userId: req.user?.userId };
  }

  @Get('session-or-key')
  @UseGuards(SessionOrApiKeyAuthGuard)
  sessionOrKey(@Req() req: Request & { apiKeyIdentity?: { userId: string } }) {
    return { userId: req.apiKeyIdentity?.userId };
  }

  @Post('csrf')
  @UseGuards(SessionCookieGuard, CsrfGuard)
  csrf() {
    return { ok: true };
  }

  @Get('oauth-state/write')
  writeState(@Req() req: Request & { session?: { oauthLocale?: string } | null }) {
    req.session = req.session ?? {};
    req.session.oauthLocale = 'zh-TW';
    return { ok: true };
  }

  @Get('oauth-state/read')
  readState(@Req() req: Request & { session?: { oauthLocale?: string } | null }) {
    return { oauthLocale: req.session?.oauthLocale ?? null };
  }
}

function setCookieLines(response: request.Response): string[] {
  const value = response.headers['set-cookie'] as unknown;
  if (!value) return [];
  return Array.isArray(value) ? value : [String(value)];
}

function attributesOf(line: string): string[] {
  return line.split(';').map((part) => part.trim());
}

function lineFor(lines: string[], name: string): string | undefined {
  return lines.find((line) => line.startsWith(`${name}=`));
}

describe('platform cookies over HTTP (COOKIE-PREFIX-01)', () => {
  const ENV_NAMES = ['APP_BASE_URL', 'NODE_ENV'] as const;
  const saved: Record<string, string | undefined> = {};
  let app: INestApplication | undefined;
  const authService = {
    login: jest.fn(async () => ({ sessionToken: 'new-token', user: { id: 'user-1' } })),
    revokeSession: jest.fn(async () => undefined),
    validateSessionToken: jest.fn(async (token: string) =>
      token === GOOD_TOKEN || token === 'new-token'
        ? { id: 'user-1', email: 'u@example.com', role: 'user', planType: 'free' }
        : null,
    ),
  };

  beforeEach(() => {
    for (const name of ENV_NAMES) saved[name] = process.env[name];
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app?.close();
    app = undefined;
    for (const name of ENV_NAMES) {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    }
  });

  async function start(options: { appBaseUrl: string; nodeEnv: string; forceHttps?: boolean }) {
    process.env.APP_BASE_URL = options.appBaseUrl;
    process.env.NODE_ENV = options.nodeEnv;
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 1000 }])],
      controllers: [AuthController, ProbeController],
      providers: [
        { provide: APP_GUARD, useClass: SameOriginWriteGuard },
        { provide: AuthService, useValue: authService },
        { provide: EntitlementService, useValue: { resolveHarnessEntitled: jest.fn(async () => false) } },
        { provide: ApiKeyAuthGuard, useValue: { canActivate: jest.fn(async () => false) } },
        SessionCookieGuard,
        SessionOrApiKeyAuthGuard,
        CsrfGuard,
      ],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    if (options.forceHttps) {
      // Stands in for a TLS connection, so cookie-session may write a Secure cookie.
      app.use((req: Request, _res: Response, next: NextFunction) => {
        Object.defineProperty(req, 'protocol', { value: 'https' });
        next();
      });
    }
    // The same order as main.ts.
    app.use(cookieSession(oauthStateSessionOptions('test-oauth-secret')));
    app.use(cookieParser());
    app.use(csrfCookieMiddleware);
    app.setGlobalPrefix('api');
    await app.init();
    return request(app.getHttpServer());
  }

  describe('secure mode (https APP_BASE_URL)', () => {
    const secure = () => start({ appBaseUrl: APP_ORIGIN, nodeEnv: 'test' });

    // Item 2.
    it('issues __Host-aisandbox_csrf with Secure, Path=/, SameSite=Lax, no Domain, no HttpOnly', async () => {
      const http = await secure();
      const reply = await http.get('/api/probe/oauth-state/read').expect(200);
      const lines = setCookieLines(reply);
      const csrf = lineFor(lines, '__Host-aisandbox_csrf');
      expect(csrf).toBeDefined();
      const attributes = attributesOf(csrf!);
      expect(attributes).toEqual(expect.arrayContaining(['Path=/', 'Secure', 'SameSite=Lax']));
      expect(csrf).not.toMatch(/;\s*Domain=/i);
      expect(csrf).not.toMatch(/;\s*HttpOnly/i);
      expect(lineFor(lines, 'aisandbox_csrf')).toBeUndefined();
    });

    it('issues the prefixed CSRF cookie when only the old name is present, and not when the new one is', async () => {
      const http = await secure();
      const withOld = await http.get('/api/probe/oauth-state/read').set('Cookie', 'aisandbox_csrf=old');
      expect(lineFor(setCookieLines(withOld), '__Host-aisandbox_csrf')).toBeDefined();
      const withNew = await http.get('/api/probe/oauth-state/read').set('Cookie', '__Host-aisandbox_csrf=new');
      expect(setCookieLines(withNew).some((line) => line.includes('aisandbox_csrf'))).toBe(false);
    });

    // Item 3.
    it('login sets __Host-aisandbox_session (HttpOnly, Secure, Path=/, Lax, 7 days, no Domain) and clears the old name', async () => {
      const http = await secure();
      const reply = await http
        .post('/api/auth/login')
        .set('Origin', APP_ORIGIN)
        .set('Cookie', '__Host-aisandbox_csrf=c')
        .send({ email: 'a@example.com', password: 'x' })
        .expect(200);
      const lines = setCookieLines(reply);
      const session = lineFor(lines, '__Host-aisandbox_session');
      expect(session).toBeDefined();
      expect(attributesOf(session!)).toEqual(
        expect.arrayContaining(['__Host-aisandbox_session=new-token', 'Max-Age=604800', 'Path=/', 'HttpOnly', 'Secure', 'SameSite=Lax']),
      );
      expect(session).not.toMatch(/;\s*Domain=/i);
      const oldClear = lineFor(lines, 'aisandbox_session');
      expect(oldClear).toBeDefined();
      expect(attributesOf(oldClear!)).toEqual(
        expect.arrayContaining(['aisandbox_session=', 'Path=/', 'Expires=Thu, 01 Jan 1970 00:00:00 GMT', 'Secure']),
      );
    });

    it('logout clears __Host-aisandbox_session with Secure and Path=/, and the old name too', async () => {
      const http = await secure();
      const reply = await http
        .post('/api/auth/logout')
        .set('Origin', APP_ORIGIN)
        .set('Cookie', `__Host-aisandbox_session=${GOOD_TOKEN}; __Host-aisandbox_csrf=t`)
        .set('X-CSRF-Token', 't')
        .expect(200);
      expect(authService.revokeSession).toHaveBeenCalledWith(GOOD_TOKEN);
      const lines = setCookieLines(reply);
      for (const name of ['__Host-aisandbox_session', 'aisandbox_session']) {
        const line = lineFor(lines, name);
        expect(line).toBeDefined();
        expect(attributesOf(line!)).toEqual(
          expect.arrayContaining([`${name}=`, 'Path=/', 'Expires=Thu, 01 Jan 1970 00:00:00 GMT', 'Secure']),
        );
        expect(line).not.toMatch(/;\s*Domain=/i);
      }
    });

    // Item 4.
    it.each(['/api/probe/session', '/api/probe/session-or-key'])(
      '%s: the old name alone is 401; the same token under the new name passes; with both, only the new one counts',
      async (path) => {
        const http = await secure();
        await http.get(path).set('Cookie', `aisandbox_session=${GOOD_TOKEN}`).expect(401);
        expect(authService.validateSessionToken).not.toHaveBeenCalled();

        const ok = await http.get(path).set('Cookie', `__Host-aisandbox_session=${GOOD_TOKEN}`).expect(200);
        expect(ok.body).toEqual({ userId: 'user-1' });

        authService.validateSessionToken.mockClear();
        await http
          .get(path)
          .set('Cookie', `aisandbox_session=${GOOD_TOKEN}; __Host-aisandbox_session=planted-or-stale`)
          .expect(401);
        expect(authService.validateSessionToken).toHaveBeenCalledTimes(1);
        expect(authService.validateSessionToken).toHaveBeenCalledWith('planted-or-stale');
      },
    );

    // Item 5.
    it('CsrfGuard compares the header with the new cookie only; a planted old name equal to the header is refused', async () => {
      const http = await secure();
      const session = `__Host-aisandbox_session=${GOOD_TOKEN}`;
      await http
        .post('/api/probe/csrf')
        .set('Origin', APP_ORIGIN)
        .set('Cookie', `${session}; __Host-aisandbox_csrf=real`)
        .set('X-CSRF-Token', 'real')
        .expect(201);
      await http
        .post('/api/probe/csrf')
        .set('Origin', APP_ORIGIN)
        .set('Cookie', `${session}; aisandbox_csrf=planted; __Host-aisandbox_csrf=real`)
        .set('X-CSRF-Token', 'planted')
        .expect(403);
      await http
        .post('/api/probe/csrf')
        .set('Origin', APP_ORIGIN)
        .set('Cookie', `${session}; aisandbox_csrf=planted`)
        .set('X-CSRF-Token', 'planted')
        .expect(403);
    });

    it('logout with only old-name cookies is never 200', async () => {
      const http = await secure();
      const reply = await http
        .post('/api/auth/logout')
        .set('Origin', APP_ORIGIN)
        .set('Cookie', `aisandbox_session=${GOOD_TOKEN}; aisandbox_csrf=t`)
        .set('X-CSRF-Token', 't');
      expect([401, 403]).toContain(reply.status);
      expect(authService.revokeSession).not.toHaveBeenCalled();
    });

    // Item 6 at HTTP level.
    it('a write without Origin is refused under either session cookie name', async () => {
      const http = await secure();
      for (const name of ['aisandbox_session', '__Host-aisandbox_session']) {
        await http.post('/api/probe/csrf').set('Cookie', `${name}=${GOOD_TOKEN}`).expect(403);
      }
      await http.post('/api/probe/csrf').set('Cookie', `x__Host-aisandbox_session=${GOOD_TOKEN}`).expect(401);
    });

    // Item 8, with the real cookie-session and cookies libraries.
    it('cookie-session writes and reads __Host-aisandbox_oauth_state (and its .sig) with Secure and path /', async () => {
      const http = await start({ appBaseUrl: APP_ORIGIN, nodeEnv: 'test', forceHttps: true });
      const written = await http.get('/api/probe/oauth-state/write').expect(200);
      const lines = setCookieLines(written);
      const state = lineFor(lines, '__Host-aisandbox_oauth_state');
      const sig = lineFor(lines, '__Host-aisandbox_oauth_state.sig');
      for (const line of [state, sig]) {
        expect(line).toBeDefined();
        const lower = attributesOf(line!).map((part) => part.toLowerCase());
        expect(lower).toEqual(expect.arrayContaining(['path=/', 'secure', 'samesite=lax', 'httponly']));
        expect(line).not.toMatch(/;\s*domain=/i);
      }
      expect(lineFor(lines, 'aisandbox_oauth_state')).toBeUndefined();

      const pairs = [state!, sig!].map((line) => line.split(';')[0]).join('; ');
      const read = await http.get('/api/probe/oauth-state/read').set('Cookie', pairs).expect(200);
      expect(read.body).toEqual({ oauthLocale: 'zh-TW' });

      const oldName = pairs.replace(/__Host-aisandbox_oauth_state/g, 'aisandbox_oauth_state');
      const ignored = await http.get('/api/probe/oauth-state/read').set('Cookie', oldName).expect(200);
      expect(ignored.body).toEqual({ oauthLocale: null });
    });

    // Stage-start 1.4, unchanged by this task (follow-up F2): over plain http
    // without trust proxy the Secure state cookie is not written.
    it('over plain http the Secure OAuth state cookie is not written (stage-start 1.4, unchanged)', async () => {
      const http = await secure();
      const written = await http.get('/api/probe/oauth-state/write').expect(200);
      expect(setCookieLines(written).some((line) => line.includes('aisandbox_oauth_state'))).toBe(false);
    });
  });

  it('NODE_ENV production with no https URL is secure mode too', async () => {
    const http = await start({ appBaseUrl: LOCAL_ORIGIN, nodeEnv: 'production' });
    const reply = await http.get('/api/probe/oauth-state/read');
    expect(lineFor(setCookieLines(reply), '__Host-aisandbox_csrf')).toBeDefined();
    await http.get('/api/probe/session').set('Cookie', `aisandbox_session=${GOOD_TOKEN}`).expect(401);
    await http.get('/api/probe/session').set('Cookie', `__Host-aisandbox_session=${GOOD_TOKEN}`).expect(200);
  });

  // Item 9: local http keeps today's names and attributes.
  describe('local http (today unchanged)', () => {
    const local = () => start({ appBaseUrl: LOCAL_ORIGIN, nodeEnv: 'development' });

    it('issues aisandbox_csrf with Path=/ and SameSite=Lax, without Secure, HttpOnly or Domain', async () => {
      const http = await local();
      const reply = await http.get('/api/probe/oauth-state/read');
      const lines = setCookieLines(reply);
      const csrf = lineFor(lines, 'aisandbox_csrf');
      expect(csrf).toBeDefined();
      expect(attributesOf(csrf!).slice(1).sort()).toEqual(['Path=/', 'SameSite=Lax']);
      expect(lineFor(lines, '__Host-aisandbox_csrf')).toBeUndefined();
    });

    it('login sets aisandbox_session without Secure and clears nothing; logout clears it with Path=/ only', async () => {
      const http = await local();
      const login = await http
        .post('/api/auth/login')
        .set('Origin', LOCAL_ORIGIN)
        .set('Cookie', 'aisandbox_csrf=c')
        .send({ email: 'a@example.com', password: 'x' })
        .expect(200);
      const loginLines = setCookieLines(login);
      expect(loginLines).toHaveLength(1);
      expect(attributesOf(loginLines[0]).slice(1).filter((part) => !part.startsWith('Expires=')).sort()).toEqual(
        ['HttpOnly', 'Max-Age=604800', 'Path=/', 'SameSite=Lax'],
      );
      expect(loginLines[0].startsWith('aisandbox_session=new-token;')).toBe(true);

      const logout = await http
        .post('/api/auth/logout')
        .set('Origin', LOCAL_ORIGIN)
        .set('Cookie', `aisandbox_session=${GOOD_TOKEN}; aisandbox_csrf=t`)
        .set('X-CSRF-Token', 't')
        .expect(200);
      const logoutLines = setCookieLines(logout);
      expect(logoutLines).toEqual(['aisandbox_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT']);
    });

    it('guards read only aisandbox_session and aisandbox_csrf', async () => {
      const http = await local();
      await http.get('/api/probe/session').set('Cookie', `aisandbox_session=${GOOD_TOKEN}`).expect(200);
      await http.get('/api/probe/session').set('Cookie', `__Host-aisandbox_session=${GOOD_TOKEN}`).expect(401);
      await http
        .post('/api/probe/csrf')
        .set('Origin', LOCAL_ORIGIN)
        .set('Cookie', `aisandbox_session=${GOOD_TOKEN}; aisandbox_csrf=t`)
        .set('X-CSRF-Token', 't')
        .expect(201);
    });

    it('cookie-session uses aisandbox_oauth_state', async () => {
      const http = await local();
      const written = await http.get('/api/probe/oauth-state/write').expect(200);
      const lines = setCookieLines(written);
      expect(lineFor(lines, 'aisandbox_oauth_state')).toBeDefined();
      expect(lineFor(lines, 'aisandbox_oauth_state')).not.toMatch(/;\s*secure/i);
      expect(lines.some((line) => line.startsWith('__Host-'))).toBe(false);
    });
  });
});

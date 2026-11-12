import { Controller, Get, INestApplication, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { randomBytes } from 'crypto';
import * as http from 'http';
import { AddressInfo } from 'net';
import { AuthService } from '../../auth/auth.service';
import { SessionService } from '../../sessions/session.service';
import { PreviewAccessGuard } from '../preview-access.guard';
import { PreviewEntryController } from '../preview-entry.controller';
import {
  isPreviewHostRequest,
  normalizeHostValue,
  readPreviewHostConfig,
} from '../preview-host';
import { PreviewOwnershipGuard } from '../preview-ownership.guard';
import { PREVIEW_SANDBOX_CSP } from '../preview-response-headers';
import { PreviewTickets } from '../preview-ticket';
import { PreviewController } from '../preview.controller';
import { PreviewModule } from '../preview.module';

/**
 * PREVIEW-ORIGIN-01: previews never run with the platform origin's rights.
 *
 * Part 1 is the first action of the stage-start (4.6): how the gateway tells
 * the preview host from the platform host behind Caddy, behind the local
 * Next rewrite and straight to the gateway.
 *
 * Part 2 runs the real controllers, guards and route filter against a
 * recording stand-in for container-manager (stage-start 4.3 items 2, 4, 5).
 */

const PREVIEW = 'preview.staging.ainow.biz';
const PLATFORM = 'staging.ainow.biz';

describe('preview host detection (stage-start 4.6 first action)', () => {
  const env = (preview?: string, app?: string) => ({ PREVIEW_BASE_URL: preview, APP_BASE_URL: app });

  describe('readPreviewHostConfig', () => {
    it('reads the host from PREVIEW_BASE_URL', () => {
      expect(readPreviewHostConfig(env(`https://${PREVIEW}`, `https://${PLATFORM}`))).toEqual({
        origin: `https://${PREVIEW}`,
        host: PREVIEW,
        protocol: 'https:',
      });
    });

    it('lower-cases, drops the default port and a path, keeps another port', () => {
      expect(readPreviewHostConfig(env('https://PREVIEW.Staging.AiNow.biz:443/some/path'))?.host).toBe(PREVIEW);
      expect(readPreviewHostConfig(env('http://preview.localhost:4100'))?.host).toBe('preview.localhost:4100');
      expect(readPreviewHostConfig(env(`https://${PREVIEW}/`))?.origin).toBe(`https://${PREVIEW}`);
    });

    it.each([
      ['unset', undefined],
      ['blank', '   '],
      ['not a URL', 'preview.staging.ainow.biz'],
      ['not http(s)', `ftp://${PREVIEW}`],
      ['with credentials', `https://user:pass@${PREVIEW}`],
    ])('is not configured when PREVIEW_BASE_URL is %s', (_label, value) => {
      expect(readPreviewHostConfig(env(value, `https://${PLATFORM}`))).toBeNull();
    });

    it('is not configured when it names the platform host (APP_BASE_URL)', () => {
      expect(readPreviewHostConfig(env(`https://${PLATFORM}`, `https://${PLATFORM}/en`))).toBeNull();
      expect(readPreviewHostConfig(env('http://localhost:3000', 'http://localhost:3000'))).toBeNull();
    });
  });

  describe('isPreviewHostRequest', () => {
    const staging = readPreviewHostConfig(env(`https://${PREVIEW}`, `https://${PLATFORM}`));
    // Local: a preview host straight on the gateway's port while the
    // platform goes through Next on :3000.
    const local = readPreviewHostConfig(env('http://localhost:4000', 'http://localhost:3000'));

    it.each([
      ['Caddy, preview site (Host and X-Forwarded-Host = preview)', staging, { host: PREVIEW, 'x-forwarded-host': PREVIEW }, true],
      ['straight to the gateway (Host = preview, no X-Forwarded-Host)', staging, { host: PREVIEW }, true],
      ['upper case and the default port', staging, { host: `${PREVIEW.toUpperCase()}:443`, 'x-forwarded-host': PREVIEW }, true],
      ['Caddy, platform site', staging, { host: PLATFORM, 'x-forwarded-host': PLATFORM }, false],
      ['platform Host with a spoofed X-Forwarded-Host', staging, { host: PLATFORM, 'x-forwarded-host': PREVIEW }, false],
      ['preview Host with a platform X-Forwarded-Host', staging, { host: PREVIEW, 'x-forwarded-host': PLATFORM }, false],
      ['a forwarding chain with one other host', staging, { host: PREVIEW, 'x-forwarded-host': `${PREVIEW}, ${PLATFORM}` }, false],
      ['an empty X-Forwarded-Host entry', staging, { host: PREVIEW, 'x-forwarded-host': `${PREVIEW},` }, false],
      ['the preview name on another port', staging, { host: `${PREVIEW}:8443` }, false],
      ['a trailing-dot host', staging, { host: `${PREVIEW}.` }, false],
      ['no Host header', staging, {}, false],
      ['Next rewrite to a gateway that is also the local preview host', local, { host: 'localhost:4000', 'x-forwarded-host': 'localhost:3000' }, false],
      ['the local preview host straight on the gateway', local, { host: 'localhost:4000' }, true],
      ['preview host not configured', null, { host: PREVIEW, 'x-forwarded-host': PREVIEW }, false],
    ])('%s -> %p', (_label, config, headers, expected) => {
      expect(isPreviewHostRequest({ headers: headers as Record<string, string> }, config)).toBe(expected);
    });

    it('accepts X-Forwarded-Host given as an array', () => {
      expect(isPreviewHostRequest({ headers: { host: PREVIEW, 'x-forwarded-host': [PREVIEW, PREVIEW] } }, staging)).toBe(true);
      expect(isPreviewHostRequest({ headers: { host: PREVIEW, 'x-forwarded-host': [PREVIEW, PLATFORM] } }, staging)).toBe(false);
    });

    it('normalizes only the scheme default port', () => {
      expect(normalizeHostValue('Example.test:443', 'https:')).toBe('example.test');
      expect(normalizeHostValue('example.test:80', 'https:')).toBe('example.test:80');
      expect(normalizeHostValue('example.test:80', 'http:')).toBe('example.test');
    });
  });
});

type Reply = { status: number; headers: http.IncomingHttpHeaders; body: string };
type Received = { method: string; url: string; headers: http.IncomingHttpHeaders };

function rawRequest(
  port: number,
  method: string,
  path: string,
  headers: Record<string, string> = {},
): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, method, path, headers, timeout: 5000 },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () =>
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString('utf8'),
          }),
        );
      },
    );
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.end();
  });
}

/** Stands in for any platform route, to prove the preview host cannot reach one. */
@Controller('keys')
class FakeKeysController {
  @Get()
  list() {
    return { keys: ['platform-data'] };
  }
}

const SERVER_KEY = 'preview-origin-01-internal-key';
const SID = 'session-1';
const onPreview = { host: PREVIEW, 'x-forwarded-host': PREVIEW };
const onPlatform = { host: PLATFORM, 'x-forwarded-host': PLATFORM };
// COOKIE-PREFIX-01: APP_BASE_URL is https here (secure mode), so the platform
// session cookie is read only under its __Host- name.
const sessionCookie = '__Host-aisandbox_session=platform-session-token';
// COOKIE-PREFIX-01 section 5: upstream answers carry these when the query has
// setcookies=1.
const UPSTREAM_SET_COOKIES = [
  'app_session=a1; Path=/; HttpOnly; SameSite=Lax',
  'theme=dark',
  'tracker=t; Domain=staging.ainow.biz; Path=/api',
  'wide=w; path=/; domain=ainow.biz',
  'aisandbox_session=planted; Path=/api',
  '__Host-aisandbox_session=planted; Path=/; Secure',
  'AISANDBOX_CSRF=planted; Path=/',
];
const KEPT_ON_PREVIEW_HOST = ['app_session=a1; Path=/; HttpOnly; SameSite=Lax', 'theme=dark'];

describe('preview isolation over HTTP (PREVIEW-ORIGIN-01)', () => {
  const ENV_NAMES = [
    'PREVIEW_BASE_URL',
    'APP_BASE_URL',
    'INTERNAL_SERVICE_KEY',
    'CONTAINER_MANAGER_URL',
    'NODE_ENV',
    'HTTP_PROXY',
    'http_proxy',
    'HTTPS_PROXY',
    'https_proxy',
    'NO_PROXY',
    'no_proxy',
  ];
  const savedEnv: Record<string, string | undefined> = {};
  let upstream: http.Server;
  let upstreamUrl: string;
  const received: Received[] = [];
  let app: INestApplication | undefined;
  let port: number;
  let tickets: PreviewTickets;
  const getSessionById = jest.fn();
  const validateSessionToken = jest.fn();
  let logged: string[];

  beforeAll(async () => {
    for (const name of ENV_NAMES) {
      savedEnv[name] = process.env[name];
      if (/proxy/i.test(name)) delete process.env[name];
    }
    upstream = http.createServer((req, res) => {
      received.push({ method: req.method ?? '', url: req.url ?? '', headers: req.headers });
      const cookieHeaders: http.OutgoingHttpHeaders = (req.url ?? '').includes('setcookies=1')
        ? { 'set-cookie': UPSTREAM_SET_COOKIES, 'Clear-Site-Data': '"cookies", "storage"' }
        : {};
      if ((req.url ?? '').includes('/proxy')) {
        const html = '<!doctype html><title>app</title><script src="app.js"></script>';
        res.writeHead(200, {
          'content-type': 'text/html; charset=utf-8',
          'content-length': Buffer.byteLength(html),
          'content-security-policy': "default-src 'self'",
          ...cookieHeaders,
        });
        res.end(req.method === 'HEAD' ? undefined : html);
        return;
      }
      const body = JSON.stringify({ ok: true });
      res.writeHead(200, {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body),
        ...cookieHeaders,
      });
      res.end(req.method === 'HEAD' ? undefined : body);
    });
    await new Promise<void>((resolve) => upstream.listen(0, '127.0.0.1', resolve));
    upstreamUrl = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => upstream.close(() => resolve()));
    for (const name of ENV_NAMES) {
      if (savedEnv[name] === undefined) delete process.env[name];
      else process.env[name] = savedEnv[name];
    }
  });

  async function startApp(previewBaseUrl: string | undefined) {
    if (previewBaseUrl === undefined) delete process.env.PREVIEW_BASE_URL;
    else process.env.PREVIEW_BASE_URL = previewBaseUrl;
    process.env.APP_BASE_URL = `https://${PLATFORM}`;
    process.env.INTERNAL_SERVICE_KEY = SERVER_KEY;
    process.env.CONTAINER_MANAGER_URL = upstreamUrl;
    process.env.NODE_ENV = 'test';

    // The same controllers, order, guards and middleware as PreviewModule,
    // without its database-backed imports; configure() is PreviewModule's own.
    @Module({
      controllers: [PreviewEntryController, PreviewController, FakeKeysController],
      providers: [
        PreviewOwnershipGuard,
        PreviewAccessGuard,
        { provide: SessionService, useValue: { getSessionById } },
        { provide: AuthService, useValue: { validateSessionToken } },
        { provide: PreviewTickets, useValue: tickets },
      ],
    })
    class TestPreviewModule implements NestModule {
      configure(consumer: MiddlewareConsumer) {
        PreviewModule.prototype.configure.call(this, consumer);
      }
    }

    const moduleRef = await Test.createTestingModule({ imports: [TestPreviewModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    await app.listen(0, '127.0.0.1');
    port = (app.getHttpServer().address() as AddressInfo).port;
  }

  beforeEach(() => {
    received.length = 0;
    tickets = new PreviewTickets({ key: randomBytes(32) });
    getSessionById.mockReset();
    getSessionById.mockResolvedValue({ userId: 'user-1' });
    validateSessionToken.mockReset();
    validateSessionToken.mockImplementation(async (token: string) =>
      token === 'platform-session-token'
        ? { id: 'user-1', email: 'u@example.test', role: 'admin', planType: 'free' }
        : null,
    );
    logged = [];
    for (const method of ['log', 'error', 'warn'] as const) {
      jest.spyOn(console, method).mockImplementation((...args: unknown[]) => {
        logged.push(args.map(String).join(' '));
      });
    }
  });

  afterEach(async () => {
    await app?.close();
    app = undefined;
    jest.restoreAllMocks();
  });

  function previewCookie(sessionId = SID, userId = 'user-1') {
    return `aisandbox_preview=${tickets.issueAccess(sessionId, userId)}`;
  }

  describe('PREVIEW_BASE_URL set (stage-start 4.3 items 2 and 4)', () => {
    beforeEach(async () => {
      await startApp(`https://${PREVIEW}`);
    });

    it('platform host: a signed-in proxy GET answers 302 to the preview host enter URL, keeping path and query', async () => {
      const reply = await rawRequest(port, 'GET', `/api/preview/${SID}/proxy/assets/app.js?v=2&x=%20y`, {
        ...onPlatform,
        cookie: sessionCookie,
      });
      expect(reply.status).toBe(302);
      const location = new URL(reply.headers.location as string);
      expect(location.origin).toBe(`https://${PREVIEW}`);
      expect(location.pathname).toBe(`/api/preview/${SID}/enter`);
      const ticket = location.searchParams.get('ticket')!;
      expect(tickets.verifyTicket(ticket, SID)).toEqual(
        expect.objectContaining({ userId: 'user-1', target: 'proxy/assets/app.js?v=2&x=%20y' }),
      );
      expect(reply.headers['content-security-policy']).toBe(PREVIEW_SANDBOX_CSP);
      expect(reply.headers['referrer-policy']).toBe('no-referrer');
      expect(reply.headers['cache-control']).toBe('no-store');
      expect(reply.body).not.toContain('<title>app</title>');
      expect(received).toHaveLength(0);
      expect(logged.join('\n')).not.toContain(ticket);
    });

    it('platform host: HEAD is redirected too, and never served', async () => {
      const reply = await rawRequest(port, 'HEAD', `/api/preview/${SID}/proxy`, { ...onPlatform, cookie: sessionCookie });
      expect(reply.status).toBe(302);
      expect(received).toHaveLength(0);
    });

    it('platform host: no session cookie is 401 as before, with the sandbox policy', async () => {
      const reply = await rawRequest(port, 'GET', `/api/preview/${SID}/proxy`, onPlatform);
      expect(reply.status).toBe(401);
      expect(reply.headers['content-security-policy']).toBe(PREVIEW_SANDBOX_CSP);
      expect(received).toHaveLength(0);
    });

    it("platform host: another user's session is 403 as before", async () => {
      getSessionById.mockResolvedValue({ userId: 'user-2' });
      const reply = await rawRequest(port, 'GET', `/api/preview/${SID}/proxy`, { ...onPlatform, cookie: sessionCookie });
      expect(reply.status).toBe(403);
      expect(received).toHaveLength(0);
    });

    it('platform host: a preview cookie is no substitute for the session', async () => {
      const reply = await rawRequest(port, 'GET', `/api/preview/${SID}/proxy`, { ...onPlatform, cookie: previewCookie() });
      expect(reply.status).toBe(401);
      expect(received).toHaveLength(0);
    });

    it('platform host: start, stop and status still reach container-manager unchanged', async () => {
      for (const [method, path] of [
        ['POST', `/api/preview/${SID}/start`],
        ['POST', `/api/preview/${SID}/stop`],
        ['GET', `/api/preview/${SID}/status`],
      ]) {
        const reply = await rawRequest(port, method, path, { ...onPlatform, cookie: sessionCookie });
        expect(reply.status).toBe(200);
        expect(reply.headers['content-security-policy']).toBeUndefined();
      }
      expect(received.map((call) => `${call.method} ${call.url}`)).toEqual([
        `POST /api/preview/${SID}/start`,
        `POST /api/preview/${SID}/stop`,
        `GET /api/preview/${SID}/status`,
      ]);
    });

    it('the whole path: platform 302, enter sets the cookie, the preview host serves the app', async () => {
      const first = await rawRequest(port, 'GET', `/api/preview/${SID}/proxy?refresh=7`, { ...onPlatform, cookie: sessionCookie });
      const enterUrl = new URL(first.headers.location as string);
      const second = await rawRequest(port, 'GET', `${enterUrl.pathname}${enterUrl.search}`, onPreview);
      expect(second.status).toBe(302);
      expect(second.headers.location).toBe(`/api/preview/${SID}/proxy?refresh=7`);
      const cookie = (second.headers['set-cookie'] ?? [])[0].split(';')[0];

      const third = await rawRequest(port, 'GET', second.headers.location as string, { ...onPreview, cookie });
      expect(third.status).toBe(200);
      expect(third.body).toContain('<title>app</title>');
      // Served on its own origin: no sandbox policy; the app's own policy passes through.
      expect(third.headers['content-security-policy']).toBe("default-src 'self'");

      const asset = await rawRequest(port, 'GET', `/api/preview/${SID}/proxy/app.js`, { ...onPreview, cookie });
      expect(asset.status).toBe(200);

      expect(received.map((call) => `${call.method} ${call.url}`)).toEqual([
        `GET /api/preview/${SID}/proxy?refresh=7`,
        `GET /api/preview/${SID}/proxy/app.js`,
      ]);
      expect(validateSessionToken).toHaveBeenCalledTimes(1);
    });

    it('preview host: the container-manager request drops cookie and authorization and adds the internal key', async () => {
      await rawRequest(port, 'GET', `/api/preview/${SID}/proxy/index.html`, {
        ...onPreview,
        cookie: `${previewCookie()}; ${sessionCookie}`,
        authorization: 'Bearer browser-token',
        'x-internal-service-key': 'browser-sent-key',
        'x-csrf-token': 'csrf',
      });
      expect(received).toHaveLength(1);
      const sent = received[0].headers;
      expect(sent.cookie).toBeUndefined();
      expect(sent.authorization).toBeUndefined();
      expect(sent['x-csrf-token']).toBeUndefined();
      expect(sent['x-internal-service-key']).toBe(SERVER_KEY);
      expect(received[0].url).toBe(`/api/preview/${SID}/proxy/index.html`);
    });

    it('preview host: HEAD with the cookie is forwarded', async () => {
      const reply = await rawRequest(port, 'HEAD', `/api/preview/${SID}/proxy`, { ...onPreview, cookie: previewCookie() });
      expect(reply.status).toBe(200);
      expect(received).toHaveLength(1);
    });

    it.each([
      ['no cookie', ''],
      ["another session's cookie", 'other'],
      ['the session cookie alone', 'session'],
      ['an altered cookie', 'altered'],
    ])('preview host: %s is refused and container-manager is not called', async (_label, kind) => {
      const cookie =
        kind === 'other'
          ? previewCookie('session-2')
          : kind === 'session'
            ? sessionCookie
            : kind === 'altered'
              ? `${previewCookie()}x`
              : '';
      const reply = await rawRequest(port, 'GET', `/api/preview/${SID}/proxy`, {
        ...onPreview,
        ...(cookie ? { cookie } : {}),
      });
      expect(reply.status).toBe(403);
      expect(received).toHaveLength(0);
      expect(validateSessionToken).not.toHaveBeenCalled();
    });

    it('preview host: a session that changed owner is refused', async () => {
      const cookie = previewCookie();
      getSessionById.mockResolvedValue({ userId: 'user-2' });
      const reply = await rawRequest(port, 'GET', `/api/preview/${SID}/proxy`, { ...onPreview, cookie });
      expect(reply.status).toBe(403);
      expect(received).toHaveLength(0);
    });

    it.each([
      ['POST', `/api/preview/${SID}/start`],
      ['POST', `/api/preview/${SID}/stop`],
      ['DELETE', `/api/preview/${SID}/stop`],
      ['GET', `/api/preview/${SID}/status`],
      ['POST', `/api/preview/${SID}/proxy`],
      ['GET', `/api/preview/${SID}/files`],
      ['GET', `/api/preview/${SID}/proxy/%2e%2e/%2e%2e/files/x/list`],
      ['GET', '/api/keys'],
    ])('preview host: %s %s is 404, even with the session and preview cookies', async (method, path) => {
      const reply = await rawRequest(port, method, path, {
        ...onPreview,
        cookie: `${previewCookie()}; ${sessionCookie}`,
      });
      expect(reply.status).toBe(404);
      expect(reply.body).not.toContain('platform-data');
      expect(received).toHaveLength(0);
      expect(validateSessionToken).not.toHaveBeenCalled();
    });

    it('platform routes still work on the platform host', async () => {
      const reply = await rawRequest(port, 'GET', '/api/keys', onPlatform);
      expect(reply.status).toBe(200);
      expect(reply.body).toContain('platform-data');
    });

    // COOKIE-PREFIX-01 section 5.
    it('preview host: host-only app cookies pass; Domain and platform-name lines and Clear-Site-Data do not', async () => {
      for (const method of ['GET', 'HEAD']) {
        const reply = await rawRequest(port, method, `/api/preview/${SID}/proxy/index.html?setcookies=1`, {
          ...onPreview,
          cookie: previewCookie(),
        });
        expect(reply.status).toBe(200);
        expect(reply.headers['set-cookie']).toEqual(KEPT_ON_PREVIEW_HOST);
        expect(reply.headers['clear-site-data']).toBeUndefined();
      }
    });

    it('platform host: status carries no upstream Set-Cookie or Clear-Site-Data', async () => {
      const reply = await rawRequest(port, 'GET', `/api/preview/${SID}/status?setcookies=1`, {
        ...onPlatform,
        cookie: sessionCookie,
      });
      expect(reply.status).toBe(200);
      expect(reply.headers['set-cookie']).toBeUndefined();
      expect(reply.headers['clear-site-data']).toBeUndefined();
      expect(received).toHaveLength(1);
    });

    it('enter still sets the gateway aisandbox_preview cookie', async () => {
      const ticket = tickets.issueTicket(SID, 'user-1', 'proxy')!;
      const reply = await rawRequest(port, 'GET', `/api/preview/${SID}/enter?ticket=${ticket}`, onPreview);
      expect(reply.status).toBe(302);
      const lines = (reply.headers['set-cookie'] ?? []) as string[];
      expect(lines).toHaveLength(1);
      expect(lines[0].startsWith('aisandbox_preview=')).toBe(true);
      expect(lines[0]).toContain(`Path=/api/preview/${SID}/`);
    });

    it('behind the local Next rewrite a request counts as the platform host', async () => {
      const reply = await rawRequest(port, 'GET', `/api/preview/${SID}/proxy`, {
        host: PREVIEW,
        'x-forwarded-host': PLATFORM,
        cookie: previewCookie(),
      });
      expect(reply.status).toBe(401);
      expect(received).toHaveLength(0);
    });
  });

  describe('PREVIEW_BASE_URL unset: the fail-safe (stage-start 4.3 item 5)', () => {
    beforeEach(async () => {
      await startApp(undefined);
    });

    it.each([
      ['GET', `/api/preview/${SID}/proxy?refresh=1`],
      ['GET', `/api/preview/${SID}/proxy/`],
      ['GET', `/api/preview/${SID}/proxy/assets/app.js`],
      ['HEAD', `/api/preview/${SID}/proxy`],
    ])('%s %s is served with the CSP sandbox policy, without allow-same-origin', async (method, path) => {
      for (const hosts of [onPlatform, onPreview, { host: '127.0.0.1:4000' }]) {
        received.length = 0;
        const reply = await rawRequest(port, method, path, { ...hosts, cookie: sessionCookie });
        expect(reply.status).toBe(200);
        const policies = String(reply.headers['content-security-policy']).split(',').map((p) => p.trim());
        expect(policies).toContain(PREVIEW_SANDBOX_CSP);
        // The app's own policy is kept beside it, never in its place.
        expect(policies).toContain("default-src 'self'");
        expect(String(reply.headers['content-security-policy'])).not.toMatch(/allow-same-origin/);
        expect(received).toHaveLength(1);
      }
    });

    it('a refused proxy request carries the policy too', async () => {
      const reply = await rawRequest(port, 'GET', `/api/preview/${SID}/proxy`, onPlatform);
      expect(reply.status).toBe(401);
      expect(reply.headers['content-security-policy']).toBe(PREVIEW_SANDBOX_CSP);
    });

    it('start, stop and status behave as before (no policy header, same container-manager calls)', async () => {
      for (const [method, path] of [
        ['POST', `/api/preview/${SID}/start`],
        ['POST', `/api/preview/${SID}/stop`],
        ['DELETE', `/api/preview/${SID}/stop`],
        ['GET', `/api/preview/${SID}/status`],
      ]) {
        const reply = await rawRequest(port, method, path, { ...onPlatform, cookie: sessionCookie });
        expect(reply.status).toBe(200);
        expect(JSON.parse(reply.body)).toEqual({ ok: true });
        expect(reply.headers['content-security-policy']).toBeUndefined();
      }
      expect(received.map((call) => `${call.method} ${call.url} ${call.headers['x-internal-service-key']}`)).toEqual([
        `POST /api/preview/${SID}/start ${SERVER_KEY}`,
        `POST /api/preview/${SID}/stop ${SERVER_KEY}`,
        `DELETE /api/preview/${SID}/stop ${SERVER_KEY}`,
        `GET /api/preview/${SID}/status ${SERVER_KEY}`,
      ]);
    });

    // COOKIE-PREFIX-01 section 5: on the platform host no upstream cookie passes.
    it('proxy, start and status on the platform host carry no upstream Set-Cookie or Clear-Site-Data', async () => {
      for (const [method, path] of [
        ['GET', `/api/preview/${SID}/proxy?setcookies=1`],
        ['GET', `/api/preview/${SID}/proxy/assets/app.js?setcookies=1`],
        ['HEAD', `/api/preview/${SID}/proxy?setcookies=1`],
        ['POST', `/api/preview/${SID}/start?setcookies=1`],
        ['GET', `/api/preview/${SID}/status?setcookies=1`],
      ]) {
        for (const hosts of [onPlatform, onPreview]) {
          received.length = 0;
          const reply = await rawRequest(port, method, path, { ...hosts, cookie: sessionCookie });
          expect(reply.status).toBe(200);
          expect(received).toHaveLength(1);
          expect(reply.headers['set-cookie']).toBeUndefined();
          expect(reply.headers['clear-site-data']).toBeUndefined();
        }
      }
    });

    it('enter does not exist and nothing is redirected', async () => {
      const ticket = tickets.issueTicket(SID, 'user-1', 'proxy')!;
      const enter = await rawRequest(port, 'GET', `/api/preview/${SID}/enter?ticket=${ticket}`, onPreview);
      expect(enter.status).toBe(404);
      const proxy = await rawRequest(port, 'GET', `/api/preview/${SID}/proxy`, { ...onPlatform, cookie: sessionCookie });
      expect(proxy.status).toBe(200);
      expect(proxy.headers.location).toBeUndefined();
    });

    it('the route filter lets every platform route through', async () => {
      const reply = await rawRequest(port, 'GET', '/api/keys', onPreview);
      expect(reply.status).toBe(200);
    });
  });
});

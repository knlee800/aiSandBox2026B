import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { randomBytes } from 'crypto';
import * as http from 'http';
import { AddressInfo } from 'net';
import { AuthService } from '../../auth/auth.service';
import { SessionService } from '../../sessions/session.service';
import { PreviewAccessGuard } from '../preview-access.guard';
import { PreviewEntryController } from '../preview-entry.controller';
import { PreviewOwnershipGuard } from '../preview-ownership.guard';
import { PREVIEW_TICKET_TTL_MS, PreviewTickets } from '../preview-ticket';
import { PreviewController } from '../preview.controller';

/**
 * PREVIEW-ORIGIN-01 (stage-start 4.3 item 3): GET /api/preview/<sid>/enter
 * exists only on the preview host, takes only a valid, unexpired, unused
 * ticket for that session and sets an httpOnly, host-only, path-scoped
 * aisandbox_preview cookie, then redirects to the proxy path on the same
 * host. It is reached even though PreviewController has a catch-all.
 */

const PREVIEW = 'preview.staging.ainow.biz';
const PLATFORM = 'staging.ainow.biz';
const SID = 'session-1';
const ENV_NAMES = [
  'PREVIEW_BASE_URL',
  'APP_BASE_URL',
  'INTERNAL_SERVICE_KEY',
  'CONTAINER_MANAGER_URL',
  'NODE_ENV',
];

type Reply = { status: number; headers: http.IncomingHttpHeaders; body: string };

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

const onPreview = { host: PREVIEW, 'x-forwarded-host': PREVIEW };
const onPlatform = { host: PLATFORM, 'x-forwarded-host': PLATFORM };

describe('PreviewEntryController enter (PREVIEW-ORIGIN-01)', () => {
  const savedEnv: Record<string, string | undefined> = {};
  let app: INestApplication | undefined;
  let port: number;
  let clock: number;
  let tickets: PreviewTickets;
  const getSessionById = jest.fn();
  const validateSessionToken = jest.fn();
  let logged: string[];

  beforeAll(() => {
    for (const name of ENV_NAMES) savedEnv[name] = process.env[name];
  });

  afterAll(() => {
    for (const name of ENV_NAMES) {
      if (savedEnv[name] === undefined) delete process.env[name];
      else process.env[name] = savedEnv[name];
    }
  });

  async function startApp(previewBaseUrl: string | undefined) {
    if (previewBaseUrl === undefined) delete process.env.PREVIEW_BASE_URL;
    else process.env.PREVIEW_BASE_URL = previewBaseUrl;
    process.env.APP_BASE_URL = `https://${PLATFORM}`;
    process.env.CONTAINER_MANAGER_URL = 'http://127.0.0.1:9';
    process.env.NODE_ENV = 'test';

    const moduleRef = await Test.createTestingModule({
      controllers: [PreviewEntryController, PreviewController],
      providers: [
        PreviewOwnershipGuard,
        PreviewAccessGuard,
        { provide: SessionService, useValue: { getSessionById } },
        { provide: AuthService, useValue: { validateSessionToken } },
        { provide: PreviewTickets, useValue: tickets },
      ],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    await app.listen(0, '127.0.0.1');
    port = (app.getHttpServer().address() as AddressInfo).port;
  }

  beforeEach(() => {
    clock = Date.now();
    tickets = new PreviewTickets({ key: randomBytes(32), now: () => clock });
    getSessionById.mockReset();
    getSessionById.mockResolvedValue({ userId: 'user-1' });
    validateSessionToken.mockReset();
    validateSessionToken.mockResolvedValue({ id: 'user-1', email: 'u@example.test', role: 'user', planType: 'free' });
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

  function enterPath(ticket: string, sid = SID) {
    return `/api/preview/${sid}/enter?ticket=${encodeURIComponent(ticket)}`;
  }

  describe('with PREVIEW_BASE_URL https://preview.staging.ainow.biz', () => {
    beforeEach(async () => {
      await startApp(`https://${PREVIEW}`);
    });

    it('sets the preview cookie and redirects to the proxy path the ticket names', async () => {
      const ticket = tickets.issueTicket(SID, 'user-1', 'proxy?refresh=3')!;
      const reply = await rawRequest(port, 'GET', enterPath(ticket), onPreview);

      expect(reply.status).toBe(302);
      expect(reply.headers.location).toBe(`/api/preview/${SID}/proxy?refresh=3`);
      expect(reply.headers['referrer-policy']).toBe('no-referrer');
      expect(reply.headers['cache-control']).toBe('no-store');

      const setCookie = reply.headers['set-cookie'] ?? [];
      const previewCookies = setCookie.filter((line) => line.startsWith('aisandbox_preview='));
      expect(previewCookies).toHaveLength(1);
      const line = previewCookies[0];
      const attributes = line.split(';').map((part) => part.trim());
      expect(attributes).toContain('HttpOnly');
      expect(attributes).toContain('SameSite=Lax');
      expect(attributes).toContain(`Path=/api/preview/${SID}/`);
      expect(attributes).toContain('Secure');
      expect(attributes).toContain('Max-Age=43200');
      expect(line).not.toMatch(/Domain=/i);
      expect(setCookie.some((cookieLine) => cookieLine.startsWith('aisandbox_session='))).toBe(false);

      const value = decodeURIComponent(attributes[0].slice('aisandbox_preview='.length));
      expect(tickets.verifyAccess(value, SID)).toEqual(
        expect.objectContaining({ sessionId: SID, userId: 'user-1' }),
      );
      expect(getSessionById).toHaveBeenCalledWith(SID);
      // The platform session is never consulted on the preview host.
      expect(validateSessionToken).not.toHaveBeenCalled();
    });

    it('keeps an asset path', async () => {
      const ticket = tickets.issueTicket(SID, 'user-1', 'proxy/assets/app.js')!;
      const reply = await rawRequest(port, 'GET', enterPath(ticket), onPreview);
      expect(reply.status).toBe(302);
      expect(reply.headers.location).toBe(`/api/preview/${SID}/proxy/assets/app.js`);
    });

    it('works straight to the gateway (Host only, no X-Forwarded-Host)', async () => {
      const ticket = tickets.issueTicket(SID, 'user-1', 'proxy')!;
      const reply = await rawRequest(port, 'GET', enterPath(ticket), { host: PREVIEW });
      expect(reply.status).toBe(302);
    });

    it('is reached before the PreviewController catch-all and its session guard', async () => {
      // No session cookie: PreviewController would answer 401. The 403 comes
      // from the enter route itself.
      const reply = await rawRequest(port, 'GET', `/api/preview/${SID}/enter?ticket=bad`, onPreview);
      expect(reply.status).toBe(403);
      expect(validateSessionToken).not.toHaveBeenCalled();
    });

    it('takes a ticket only once', async () => {
      const ticket = tickets.issueTicket(SID, 'user-1', 'proxy')!;
      expect((await rawRequest(port, 'GET', enterPath(ticket), onPreview)).status).toBe(302);
      const second = await rawRequest(port, 'GET', enterPath(ticket), onPreview);
      expect(second.status).toBe(403);
      expect(second.headers['set-cookie']).toBeUndefined();
    });

    it('refuses an expired ticket', async () => {
      const ticket = tickets.issueTicket(SID, 'user-1', 'proxy')!;
      clock += PREVIEW_TICKET_TTL_MS;
      const reply = await rawRequest(port, 'GET', enterPath(ticket), onPreview);
      expect(reply.status).toBe(403);
      expect(reply.headers['set-cookie']).toBeUndefined();
    });

    it("refuses another session's ticket", async () => {
      const ticket = tickets.issueTicket('session-2', 'user-1', 'proxy')!;
      const reply = await rawRequest(port, 'GET', enterPath(ticket, SID), onPreview);
      expect(reply.status).toBe(403);
      expect(reply.headers['set-cookie']).toBeUndefined();
    });

    it('refuses an altered, missing, repeated or foreign-key ticket', async () => {
      const ticket = tickets.issueTicket(SID, 'user-1', 'proxy')!;
      const foreign = new PreviewTickets({ key: randomBytes(32) }).issueTicket(SID, 'user-1', 'proxy')!;
      for (const path of [
        enterPath(`${ticket}x`),
        `/api/preview/${SID}/enter`,
        `/api/preview/${SID}/enter?ticket=${encodeURIComponent(ticket)}&ticket=${encodeURIComponent(ticket)}`,
        enterPath(foreign),
      ]) {
        const reply = await rawRequest(port, 'GET', path, onPreview);
        expect(reply.status).toBe(403);
        expect(reply.headers['set-cookie']).toBeUndefined();
      }
    });

    it('refuses when the session no longer belongs to the ticket user', async () => {
      getSessionById.mockResolvedValue({ userId: 'user-2' });
      const ticket = tickets.issueTicket(SID, 'user-1', 'proxy')!;
      const reply = await rawRequest(port, 'GET', enterPath(ticket), onPreview);
      expect(reply.status).toBe(403);
      expect(reply.headers['set-cookie']).toBeUndefined();
    });

    it('is 404 on the platform host, with or without a session cookie', async () => {
      const ticket = tickets.issueTicket(SID, 'user-1', 'proxy')!;
      for (const extra of [{}, { cookie: 'aisandbox_session=valid' }]) {
        const reply = await rawRequest(port, 'GET', enterPath(ticket), { ...onPlatform, ...extra });
        expect(reply.status).toBe(404);
        expect(reply.headers['set-cookie']).toBeUndefined();
      }
      // The ticket was not used up by those attempts.
      expect((await rawRequest(port, 'GET', enterPath(ticket), onPreview)).status).toBe(302);
    });

    it('is 404 behind the local Next rewrite (Host is the gateway, X-Forwarded-Host the browser)', async () => {
      const ticket = tickets.issueTicket(SID, 'user-1', 'proxy')!;
      const reply = await rawRequest(port, 'GET', enterPath(ticket), {
        host: PREVIEW,
        'x-forwarded-host': PLATFORM,
      });
      expect(reply.status).toBe(404);
    });

    it('never logs the ticket or the cookie value', async () => {
      const ticket = tickets.issueTicket(SID, 'user-1', 'proxy')!;
      const reply = await rawRequest(port, 'GET', enterPath(ticket), onPreview);
      const cookieValue = (reply.headers['set-cookie'] ?? [])[0]?.split(';')[0].split('=')[1] ?? 'none';
      const all = logged.join('\n');
      expect(all).not.toContain(ticket);
      expect(all).not.toContain(cookieValue);
    });
  });

  it('sets the cookie without Secure on an http preview host outside production', async () => {
    await startApp('http://preview.localhost:4100');
    const ticket = tickets.issueTicket(SID, 'user-1', 'proxy')!;
    const reply = await rawRequest(port, 'GET', enterPath(ticket), {
      host: 'preview.localhost:4100',
    });
    expect(reply.status).toBe(302);
    const line = (reply.headers['set-cookie'] ?? [])[0];
    expect(line).toMatch(/^aisandbox_preview=/);
    expect(line.split(';').map((part) => part.trim())).not.toContain('Secure');
  });

  it('is 404 everywhere when PREVIEW_BASE_URL is unset', async () => {
    await startApp(undefined);
    const ticket = tickets.issueTicket(SID, 'user-1', 'proxy')!;
    for (const headers of [onPreview, onPlatform, { host: '127.0.0.1:4000' }]) {
      const reply = await rawRequest(port, 'GET', enterPath(ticket), headers);
      expect(reply.status).toBe(404);
      expect(reply.headers['set-cookie']).toBeUndefined();
    }
  });
});

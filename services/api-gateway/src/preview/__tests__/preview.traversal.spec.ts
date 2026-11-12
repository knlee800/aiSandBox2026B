import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as http from 'http';
import { AddressInfo } from 'net';
import { SessionCookieGuard } from '../../auth/session-cookie.guard';
import { SessionService } from '../../sessions/session.service';
import {
  buildPreviewTargetUrl,
  PreviewController,
  resolvePreviewForward,
} from '../preview.controller';
import { PreviewOwnershipGuard } from '../preview-ownership.guard';
import { PreviewAccessGuard } from '../preview-access.guard';
import { PreviewEntryController } from '../preview-entry.controller';

/**
 * CM-AUTH-01 (D4, D5): the gateway preview proxy sends the internal key to
 * container-manager, so it must only ever reach /api/preview/<sid>/start,
 * stop, status and proxy. A recording loopback server stands in for
 * container-manager, and requests are sent with raw paths (node http, which
 * does not normalize dot segments the way a WHATWG URL parser does).
 */

const serverKey = 'cm-auth-01-gateway-key';
const OWN = 'own-session';
const OTHER = 'other-session';

type Received = { method: string; url: string; key: string | string[] | undefined };

function rawRequest(
  port: number,
  method: string,
  path: string,
  headers: Record<string, string> = {},
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, method, path, headers, timeout: 5000 },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () =>
          resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') }),
        );
      },
    );
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.end();
  });
}

describe('resolvePreviewForward (CM-AUTH-01 D5)', () => {
  it.each([
    ['POST', `/api/preview/${OWN}/start`, 'start'],
    ['POST', `/api/preview/${OWN}/stop`, 'stop'],
    ['DELETE', `/api/preview/${OWN}/stop`, 'stop'],
    ['GET', `/api/preview/${OWN}/status`, 'status'],
    ['HEAD', `/api/preview/${OWN}/status`, 'status'],
    ['GET', `/api/preview/${OWN}/proxy`, 'proxy'],
    ['HEAD', `/api/preview/${OWN}/proxy`, 'proxy'],
    ['GET', `/api/preview/${OWN}/proxy/`, 'proxy/'],
    ['GET', `/api/preview/${OWN}/proxy/assets/main.js`, 'proxy/assets/main.js'],
    ['GET', `/api/preview/${OWN}/proxy/assets/`, 'proxy/assets/'],
    ['GET', `/api/preview/${OWN}/proxy/my%20file.css`, 'proxy/my%20file.css'],
    ['GET', '/api/preview/0b8c3f5e-2a4d-4c1e-9f7a-1d2e3f4a5b6c/proxy', 'proxy'],
  ])('allows %s %s', (method, path, suffix) => {
    const sessionId = path.split('/')[3];
    expect(resolvePreviewForward(method, path)).toEqual({ sessionId, suffix });
  });

  it.each([
    // The stage-start traversal and its variants.
    ['GET', `/api/preview/${OWN}/%2e%2e/%2e%2e/files/${OTHER}/list`],
    ['GET', `/api/preview/${OWN}/%2E%2E/%2e%2E/files/${OTHER}/list`],
    ['POST', `/api/preview/${OWN}/%2E%2E/%2e./executor/x/execute`],
    ['POST', `/api/preview/${OWN}/.%2e/.%2E/executor/x/execute`],
    ['GET', `/api/preview/${OWN}/../../files/${OTHER}/list`],
    ['GET', `/api/preview/${OWN}/proxy/%2e%2e/%2e%2e/%2e%2e/files/${OTHER}/list`],
    ['GET', `/api/preview/${OWN}/proxy/../../../internal/stats`],
    ['GET', `/api/preview/${OWN}/proxy/..%2f..%2f..%2ffiles/${OTHER}/list`],
    ['GET', `/api/preview/${OWN}/proxy/%2e%2e%2F%2e%2e%2Ffiles`],
    ['GET', `/api/preview/${OWN}/proxy/%2e%2e%5c%2e%2e%5cfiles`],
    ['GET', `/api/preview/${OWN}/proxy\\..\\..\\files`],
    ['GET', `/api/preview/${OWN}/proxy/a\\b`],
    ['GET', `/api/preview/${OWN}/proxy//..//files`],
    ['GET', `/api/preview/${OWN}/proxy//assets`],
    ['GET', `/api/preview/${OWN}//status`],
    ['GET', `/api/preview/${OWN}/./status`],
    ['GET', `/api/preview/${OWN}/%2e/status`],
    ['GET', `/api/preview/${OWN}/proxy/.`],
    ['GET', `/api/preview/${OWN}/proxy/%2E`],
    ['GET', `/api/preview/${OWN}/proxy/%E0%A4%A`],
    // Unknown suffixes and extra segments.
    ['GET', `/api/preview/${OWN}/files`],
    ['GET', `/api/preview/${OWN}/status/extra`],
    ['GET', `/api/preview/${OWN}/status/`],
    ['POST', `/api/preview/${OWN}/start/`],
    ['GET', `/api/preview/${OWN}/proxyx`],
    ['GET', `/api/preview/${OWN}/__proto__`],
    ['GET', `/api/preview/${OWN}/constructor`],
    ['GET', `/api/preview/${OWN}`],
    ['GET', `/api/preview/${OWN}/`],
    ['GET', '/api/preview'],
    ['GET', `/API/PREVIEW/${OWN}/status`],
    ['GET', `/api/files/${OTHER}/list`],
    // Methods not allowed for the shape.
    ['GET', `/api/preview/${OWN}/start`],
    ['DELETE', `/api/preview/${OWN}/start`],
    ['GET', `/api/preview/${OWN}/stop`],
    ['PUT', `/api/preview/${OWN}/stop`],
    ['POST', `/api/preview/${OWN}/status`],
    ['PUT', `/api/preview/${OWN}/status`],
    ['POST', `/api/preview/${OWN}/proxy`],
    ['DELETE', `/api/preview/${OWN}/proxy/x`],
    ['OPTIONS', `/api/preview/${OWN}/proxy`],
    // Bad session ids.
    ['GET', '/api/preview/%2e%2e/files/x/list'],
    ['GET', '/api/preview/../files/x/list'],
    ['GET', '/api/preview/own.session/status'],
    ['GET', '/api/preview/own%2Dsession/status'],
    ['GET', '/api/preview/own%20session/status'],
    ['GET', `/api/preview/${'a'.repeat(129)}/status`],
    ['GET', '/api/preview/session%2Fwith%20spaces/proxy'],
  ])('refuses %s %s', (method, path) => {
    expect(resolvePreviewForward(method, path)).toBeNull();
  });

  it('refuses non-string input', () => {
    expect(resolvePreviewForward(undefined, `/api/preview/${OWN}/status`)).toBeNull();
    expect(resolvePreviewForward('GET', undefined)).toBeNull();
  });
});

describe('buildPreviewTargetUrl (CM-AUTH-01 D5)', () => {
  it('builds the container-manager URL from the encoded sid and suffix', () => {
    expect(
      buildPreviewTargetUrl('http://localhost:4002', { sessionId: OWN, suffix: 'proxy/assets/a.js' }),
    ).toBe(`http://localhost:4002/api/preview/${OWN}/proxy/assets/a.js`);
    expect(buildPreviewTargetUrl('http://localhost:4002/', { sessionId: OWN, suffix: 'status' })).toBe(
      `http://localhost:4002/api/preview/${OWN}/status`,
    );
  });

  it('refuses a suffix that URL parsing would move outside /api/preview/<sid>/', () => {
    expect(
      buildPreviewTargetUrl('http://localhost:4002', { sessionId: OWN, suffix: '%2e%2e/%2e%2e/files/x/list' }),
    ).toBeNull();
    expect(buildPreviewTargetUrl('http://localhost:4002', { sessionId: OWN, suffix: '../x' })).toBeNull();
  });

  it('refuses an unparsable base URL', () => {
    expect(buildPreviewTargetUrl('not a url', { sessionId: OWN, suffix: 'status' })).toBeNull();
  });
});

describe('PreviewController over HTTP with a recording container-manager (CM-AUTH-01 D4, D5)', () => {
  const savedEnv: Record<string, string | undefined> = {};
  const envNames = [
    'INTERNAL_SERVICE_KEY',
    'CONTAINER_MANAGER_URL',
    'HTTP_PROXY',
    'http_proxy',
    'HTTPS_PROXY',
    'https_proxy',
    'NO_PROXY',
    'no_proxy',
  ];
  let upstream: http.Server;
  let upstreamUrl: string;
  const received: Received[] = [];
  let app: INestApplication | undefined;
  let port: number;
  const getSessionById = jest.fn();

  async function startApp(key: string | undefined) {
    if (key === undefined) {
      delete process.env.INTERNAL_SERVICE_KEY;
    } else {
      process.env.INTERNAL_SERVICE_KEY = key;
    }
    process.env.CONTAINER_MANAGER_URL = upstreamUrl;

    const moduleRef = await Test.createTestingModule({
      // PREVIEW-ORIGIN-01: the real route order, the preview-host routes first.
      controllers: [PreviewEntryController, PreviewController],
      providers: [
        PreviewOwnershipGuard,
        PreviewAccessGuard,
        { provide: SessionService, useValue: { getSessionById } },
      ],
    })
      .overrideGuard(SessionCookieGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          context.switchToHttp().getRequest().user = { userId: 'user-1' };
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix('api');
    await app.listen(0, '127.0.0.1');
    port = (app.getHttpServer().address() as AddressInfo).port;
  }

  beforeAll(async () => {
    for (const name of envNames) {
      savedEnv[name] = process.env[name];
      if (name !== 'INTERNAL_SERVICE_KEY' && name !== 'CONTAINER_MANAGER_URL') {
        delete process.env[name];
      }
    }
    upstream = http.createServer((req, res) => {
      received.push({
        method: req.method ?? '',
        url: req.url ?? '',
        key: req.headers['x-internal-service-key'],
      });
      // Like Express's res.json: a Content-Length, not chunked.
      const body = JSON.stringify({ ok: true });
      res.writeHead(200, {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body),
      });
      res.end(req.method === 'HEAD' ? undefined : body);
    });
    await new Promise<void>((resolve) => upstream.listen(0, '127.0.0.1', resolve));
    upstreamUrl = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => upstream.close(() => resolve()));
    for (const name of envNames) {
      if (savedEnv[name] === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = savedEnv[name];
      }
    }
  });

  beforeEach(() => {
    received.length = 0;
    getSessionById.mockReset();
    // Worst case: the requester owns every session id the guard is asked
    // about, so only the allowlist stands between a crafted path and a
    // key-bearing call to another container-manager route.
    getSessionById.mockResolvedValue({ userId: 'user-1' });
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    await app?.close();
    app = undefined;
    jest.restoreAllMocks();
  });

  describe('with INTERNAL_SERVICE_KEY set', () => {
    beforeEach(async () => {
      await startApp(serverKey);
    });

    it.each([
      ['GET', `/api/preview/${OWN}/status`, `/api/preview/${OWN}/status`],
      ['HEAD', `/api/preview/${OWN}/status`, `/api/preview/${OWN}/status`],
      ['POST', `/api/preview/${OWN}/start`, `/api/preview/${OWN}/start`],
      ['POST', `/api/preview/${OWN}/stop`, `/api/preview/${OWN}/stop`],
      ['DELETE', `/api/preview/${OWN}/stop`, `/api/preview/${OWN}/stop`],
      ['GET', `/api/preview/${OWN}/proxy?refresh=42`, `/api/preview/${OWN}/proxy?refresh=42`],
      ['GET', `/api/preview/${OWN}/proxy/`, `/api/preview/${OWN}/proxy/`],
      ['GET', `/api/preview/${OWN}/proxy/assets/main.js`, `/api/preview/${OWN}/proxy/assets/main.js`],
    ])('forwards %s %s with the server key', async (method, path, expectedUpstream) => {
      const reply = await rawRequest(port, method, path);
      expect(reply.status).toBe(200);
      expect(received).toEqual([{ method, url: expectedUpstream, key: serverKey }]);
    });

    it('replaces a browser-sent key with the server key and never forwards it', async () => {
      for (const [method, path] of [
        ['GET', `/api/preview/${OWN}/status`],
        ['GET', `/api/preview/${OWN}/proxy/a.js`],
      ]) {
        await rawRequest(port, method, path, { 'x-internal-service-key': 'browser-sent-key' });
      }
      expect(received).toHaveLength(2);
      for (const call of received) {
        expect(call.key).toBe(serverKey);
      }
      expect(JSON.stringify(received)).not.toContain('browser-sent-key');
    });

    it('never returns the server key to the browser', async () => {
      const reply = await rawRequest(port, 'GET', `/api/preview/${OWN}/status`);
      expect(reply.body).not.toContain(serverKey);
    });

    it.each([
      ['GET', `/api/preview/${OWN}/%2e%2e/%2e%2e/files/${OTHER}/list`],
      ['GET', `/api/preview/${OWN}/%2E%2E/%2e%2E/files/${OTHER}/list`],
      ['POST', `/api/preview/${OWN}/%2E%2E/%2e./executor/x/execute`],
      ['DELETE', `/api/preview/${OWN}/%2e%2e/%2e%2e/internal/sessions/${OTHER}/container`],
      ['POST', `/api/preview/${OWN}/%2e%2e/%2e%2e/internal/sessions/${OTHER}/exec`],
      ['GET', `/api/preview/${OWN}/proxy/%2e%2e/%2e%2e/%2e%2e/files/${OTHER}/list`],
      ['GET', `/api/preview/${OWN}/proxy/%2e%2e/%2e%2e/%2e%2e/internal/stats`],
      ['GET', `/api/preview/${OWN}/../../files/${OTHER}/list`],
      ['GET', `/api/preview/${OWN}/proxy/..%2f..%2f..%2ffiles/${OTHER}/list`],
      ['GET', `/api/preview/${OWN}/proxy/%2e%2e%5c%2e%2e%5cfiles`],
      ['GET', `/api/preview/${OWN}/proxy\\..\\..\\files`],
      ['GET', `/api/preview/${OWN}/proxy//..//files`],
      ['GET', `/api/preview/${OWN}/files`],
      ['GET', `/api/preview/${OWN}/status/extra`],
      ['PUT', `/api/preview/${OWN}/status`],
      ['GET', `/api/preview/${OWN}/start`],
      ['POST', `/api/preview/${OWN}/proxy`],
      ['GET', '/api/preview/%2e%2e/files/x/list'],
      ['GET', '/api/preview/own.session/status'],
    ])('refuses %s %s with 404 and never calls container-manager', async (method, path) => {
      const reply = await rawRequest(port, method, path);
      expect(reply.status).toBe(404);
      expect(received).toHaveLength(0);
    });

    it('the stop handler applies the same sid check', async () => {
      const reply = await rawRequest(port, 'POST', '/api/preview/own.session/stop');
      expect(reply.status).toBe(404);
      expect(received).toHaveLength(0);
    });
  });

  describe('with INTERNAL_SERVICE_KEY unset', () => {
    beforeEach(async () => {
      await startApp(undefined);
    });

    it.each([
      ['GET', `/api/preview/${OWN}/status`],
      ['POST', `/api/preview/${OWN}/stop`],
      ['GET', `/api/preview/${OWN}/proxy/a.js`],
    ])('%s %s leaves the header out', async (method, path) => {
      await rawRequest(port, method, path, { 'x-internal-service-key': 'browser-sent-key' });
      expect(received).toHaveLength(1);
      expect(received[0].key).toBeUndefined();
    });
  });
});

import 'reflect-metadata';
import { INestApplication, Module } from '@nestjs/common';
import { APP_GUARD, NestFactory } from '@nestjs/core';
import * as http from 'http';
import { AddressInfo } from 'net';

jest.mock('better-sqlite3', () => jest.fn());

import { InternalServiceAuthGuard } from '../guards/internal-service-auth.guard';
import { PreviewController } from '../preview/preview.controller';
import { PreviewService } from '../preview/preview.service';

/**
 * CM-AUTH-01 (D6, D7) and CM-CLEANUP-01: container-manager's one proxy to a
 * sandbox container, GET /api/preview/:sessionId/proxy*, which the gateway
 * preview catch-all calls. (CM-CLEANUP-01 removed the uncalled previews/* and
 * internal-previews/proxy/* proxies.) Loopback upstreams stand in for the
 * containers' preview servers and record what they receive.
 */

const internalKey = 'cm-auth-01-proxy-key';

type Received = { url: string; headers: http.IncomingHttpHeaders };

type Upstream = {
  server: http.Server;
  url: string;
  received: Received[];
  upgrades: Received[];
};

async function startUpstream(body: string): Promise<Upstream> {
  const received: Received[] = [];
  const upgrades: Received[] = [];
  const server = http.createServer((req, res) => {
    received.push({ url: req.url ?? '', headers: req.headers });
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end(body);
  });
  server.on('upgrade', (req, socket) => {
    upgrades.push({ url: req.url ?? '', headers: req.headers });
    socket.destroy();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { server, url, received, upgrades };
}

describe('container-manager preview proxy (CM-AUTH-01 D6, D7; CM-CLEANUP-01)', () => {
  const originalKey = process.env.INTERNAL_SERVICE_KEY;
  let upstream: Upstream;
  let otherUpstream: Upstream;
  let closedTarget: string;
  let app: INestApplication;
  let server: http.Server;
  let baseUrl: string;
  let closeListenersAtStart: number;

  const previewService = {
    getPreviewStatus: jest.fn(),
    getProxyTargetUrl: jest.fn(),
  };

  beforeAll(async () => {
    process.env.INTERNAL_SERVICE_KEY = internalKey;

    upstream = await startUpstream('upstream-ok');
    otherUpstream = await startUpstream('other-upstream-ok');

    // A port with nothing listening: reserve one, then close it.
    const probe = http.createServer();
    await new Promise<void>((resolve) => probe.listen(0, '127.0.0.1', resolve));
    closedTarget = `http://127.0.0.1:${(probe.address() as AddressInfo).port}`;
    await new Promise<void>((resolve) => probe.close(() => resolve()));

    @Module({
      controllers: [PreviewController],
      providers: [
        { provide: PreviewService, useValue: previewService },
        { provide: APP_GUARD, useClass: InternalServiceAuthGuard },
      ],
    })
    class PreviewProxiesTestModule {}

    app = await NestFactory.create(PreviewProxiesTestModule, { logger: false });
    app.setGlobalPrefix('api');
    await app.listen(0, '127.0.0.1');
    server = app.getHttpServer() as http.Server;
    closeListenersAtStart = server.listenerCount('close');
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await app?.close();
    for (const up of [upstream, otherUpstream]) {
      if (up) {
        await new Promise<void>((resolve) => up.server.close(() => resolve()));
      }
    }
    if (originalKey === undefined) {
      delete process.env.INTERNAL_SERVICE_KEY;
    } else {
      process.env.INTERNAL_SERVICE_KEY = originalKey;
    }
  });

  beforeEach(() => {
    for (const up of [upstream, otherUpstream]) {
      up.received.length = 0;
      up.upgrades.length = 0;
    }
    jest.clearAllMocks();
    previewService.getPreviewStatus.mockReturnValue({ status: 'running', framework: 'Vite' });
    previewService.getProxyTargetUrl.mockResolvedValue(upstream.url);
  });

  async function get(path: string, headers: Record<string, string>) {
    const response = await fetch(`${baseUrl}${path}`, {
      headers,
      signal: AbortSignal.timeout(5000),
    });
    return { status: response.status, text: await response.text() };
  }

  it('forwards to the container without x-internal-service-key', async () => {
    const reply = await get('/api/preview/p1/proxy/assets/main.js', {
      'x-internal-service-key': internalKey,
      'x-probe': 'kept',
    });

    expect(reply.status).toBe(200);
    expect(reply.text).toBe('upstream-ok');
    expect(upstream.received).toHaveLength(1);
    expect(upstream.received[0].headers['x-probe']).toBe('kept');
    expect(upstream.received[0].headers['x-internal-service-key']).toBeUndefined();
    expect(JSON.stringify(upstream.received[0].headers)).not.toContain(internalKey);
  });

  it('still rewrites the path for the container', async () => {
    await get('/api/preview/p1/proxy/assets/main.js', { 'x-internal-service-key': internalKey });
    expect(upstream.received[0].url).toBe('/assets/main.js');
  });

  it('sends the bare proxy path to the container root', async () => {
    await get('/api/preview/p1/proxy', { 'x-internal-service-key': internalKey });
    expect(upstream.received[0].url).toBe('/');
  });

  it('refuses without the key (no request reaches the container)', async () => {
    const reply = await get('/api/preview/p1/proxy/assets/main.js', {});
    expect(reply.status).toBe(403);
    expect(upstream.received).toHaveLength(0);
    expect(previewService.getProxyTargetUrl).not.toHaveBeenCalled();
  });

  it("sends each session's request to that session's own target", async () => {
    previewService.getProxyTargetUrl.mockImplementation(async (sessionId: string) =>
      sessionId === 'p2' ? otherUpstream.url : upstream.url,
    );

    const first = await get('/api/preview/p1/proxy/a.js', { 'x-internal-service-key': internalKey });
    const second = await get('/api/preview/p2/proxy/b.js', { 'x-internal-service-key': internalKey });
    const third = await get('/api/preview/p1/proxy/c.js', { 'x-internal-service-key': internalKey });

    expect([first.text, second.text, third.text]).toEqual([
      'upstream-ok',
      'other-upstream-ok',
      'upstream-ok',
    ]);
    expect(upstream.received.map((r) => r.url)).toEqual(['/a.js', '/c.js']);
    expect(otherUpstream.received.map((r) => r.url)).toEqual(['/b.js']);
    expect(otherUpstream.received[0].headers['x-internal-service-key']).toBeUndefined();
  });

  it('answers 502 when the container cannot be reached', async () => {
    previewService.getProxyTargetUrl.mockResolvedValue(closedTarget);
    const reply = await get('/api/preview/p1/proxy/x', { 'x-internal-service-key': internalKey });
    expect(reply.status).toBe(502);
    expect(JSON.parse(reply.text)).toMatchObject({ error: 'Proxy error' });
  });

  it('CM-CLEANUP-01: many proxied requests add no server close listeners', async () => {
    const requests = 30;
    for (let i = 0; i < requests; i += 1) {
      const sessionId = i % 2 === 0 ? 'p1' : 'p2';
      const reply = await get(`/api/preview/${sessionId}/proxy/file-${i}.js`, {
        'x-internal-service-key': internalKey,
      });
      expect(reply.status).toBe(200);
    }
    expect(upstream.received).toHaveLength(requests);
    // The one shared proxy subscribes the server's 'close' event once at
    // most. Before CM-CLEANUP-01 every request built a new proxy, and each
    // added a listener.
    expect(server.listenerCount('close') - closeListenersAtStart).toBeLessThanOrEqual(1);
  });

  it('registers no upgrade listener after proxied requests (no ws: true)', async () => {
    const before = server.listenerCount('upgrade');
    await get('/api/preview/p1/proxy/', { 'x-internal-service-key': internalKey });
    await get('/api/preview/p1/proxy/x', { 'x-internal-service-key': internalKey });
    expect(upstream.received).toHaveLength(2);
    expect(before).toBe(0);
    expect(server.listenerCount('upgrade')).toBe(0);
  });

  it('a WebSocket upgrade without the key is never proxied to the container', async () => {
    // A proxied request first: with ws: true this used to subscribe the
    // server's 'upgrade' event, which no Nest guard ever sees.
    await get('/api/preview/p1/proxy/', { 'x-internal-service-key': internalKey });
    upstream.received.length = 0;

    const port = (server.address() as AddressInfo).port;
    const outcome = await new Promise<string>((resolve) => {
      const req = http.request({
        host: '127.0.0.1',
        port,
        path: '/api/preview/p1/proxy/ws',
        headers: {
          connection: 'Upgrade',
          upgrade: 'websocket',
          'sec-websocket-version': '13',
          'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ==',
        },
        timeout: 3000,
      });
      req.on('upgrade', (_res, socket) => {
        socket.destroy();
        resolve('upgraded');
      });
      req.on('response', (res) => {
        res.resume();
        resolve(`response ${res.statusCode}`);
      });
      req.on('timeout', () => {
        req.destroy();
        resolve('timeout');
      });
      req.on('error', () => resolve('closed'));
      req.end();
    });

    expect(outcome).not.toBe('upgraded');
    expect(['response 403', 'closed', 'timeout']).toContain(outcome);
    expect(upstream.upgrades).toHaveLength(0);
    expect(upstream.received).toHaveLength(0);
  });
});

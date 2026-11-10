import 'reflect-metadata';
import { INestApplication, Module } from '@nestjs/common';
import { APP_GUARD, NestFactory } from '@nestjs/core';
import * as http from 'http';
import { AddressInfo } from 'net';

jest.mock('better-sqlite3', () => jest.fn());

import { InternalServiceAuthGuard } from '../guards/internal-service-auth.guard';
import { PreviewController } from '../preview/preview.controller';
import { PreviewService } from '../preview/preview.service';
import { InternalPreviewsProxyController } from '../previews/internal-previews-proxy.controller';
import { PreviewProxyService } from '../previews/preview-proxy.service';
import { PreviewsController } from '../previews/previews.controller';
import { SessionsService } from '../sessions/sessions.service';

/**
 * CM-AUTH-01 (D6, D7): the three container-manager proxies to a sandbox
 * container. A loopback upstream stands in for the container's preview
 * server and records what it receives.
 */

const internalKey = 'cm-auth-01-proxy-key';

type Received = { url: string; headers: http.IncomingHttpHeaders };

describe('container-manager preview proxies (CM-AUTH-01 D6, D7)', () => {
  const originalKey = process.env.INTERNAL_SERVICE_KEY;
  const originalAccessControl = process.env.ENABLE_PREVIEW_ACCESS_CONTROL;
  let upstream: http.Server;
  let upstreamUrl: string;
  const received: Received[] = [];
  const upgrades: Received[] = [];
  let app: INestApplication;
  let baseUrl: string;

  const previewService = {
    getPreviewStatus: jest.fn(),
    getProxyTargetUrl: jest.fn(),
  };
  const previewProxyService = { getProxyTarget: jest.fn() };
  const sessionsService = { assertSessionUsable: jest.fn() };

  beforeAll(async () => {
    process.env.INTERNAL_SERVICE_KEY = internalKey;
    delete process.env.ENABLE_PREVIEW_ACCESS_CONTROL;

    upstream = http.createServer((req, res) => {
      received.push({ url: req.url ?? '', headers: req.headers });
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('upstream-ok');
    });
    upstream.on('upgrade', (req, socket) => {
      upgrades.push({ url: req.url ?? '', headers: req.headers });
      socket.destroy();
    });
    await new Promise<void>((resolve) => upstream.listen(0, '127.0.0.1', resolve));
    upstreamUrl = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`;

    @Module({
      controllers: [PreviewController, PreviewsController, InternalPreviewsProxyController],
      providers: [
        { provide: PreviewService, useValue: previewService },
        { provide: PreviewProxyService, useValue: previewProxyService },
        { provide: SessionsService, useValue: sessionsService },
        { provide: APP_GUARD, useClass: InternalServiceAuthGuard },
      ],
    })
    class PreviewProxiesTestModule {}

    app = await NestFactory.create(PreviewProxiesTestModule, { logger: false });
    app.setGlobalPrefix('api');
    await app.listen(0, '127.0.0.1');
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await app?.close();
    await new Promise<void>((resolve) => upstream.close(() => resolve()));
    if (originalKey === undefined) {
      delete process.env.INTERNAL_SERVICE_KEY;
    } else {
      process.env.INTERNAL_SERVICE_KEY = originalKey;
    }
    if (originalAccessControl === undefined) {
      delete process.env.ENABLE_PREVIEW_ACCESS_CONTROL;
    } else {
      process.env.ENABLE_PREVIEW_ACCESS_CONTROL = originalAccessControl;
    }
  });

  beforeEach(() => {
    received.length = 0;
    upgrades.length = 0;
    jest.clearAllMocks();
    previewService.getPreviewStatus.mockReturnValue({ status: 'running', framework: 'Vite' });
    previewService.getProxyTargetUrl.mockResolvedValue(upstreamUrl);
    previewProxyService.getProxyTarget.mockResolvedValue(upstreamUrl);
    sessionsService.assertSessionUsable.mockReturnValue(undefined);
  });

  async function get(path: string, headers: Record<string, string>) {
    const response = await fetch(`${baseUrl}${path}`, {
      headers,
      signal: AbortSignal.timeout(5000),
    });
    return { status: response.status, text: await response.text() };
  }

  it.each([
    ['PreviewController', '/api/preview/p1/proxy/assets/main.js'],
    ['PreviewsController', '/api/previews/p1/assets/main.js'],
    ['InternalPreviewsProxyController', '/api/internal-previews/proxy/p1/assets/main.js'],
  ])('%s forwards to the container without x-internal-service-key', async (_name, path) => {
    const reply = await get(path, {
      'x-internal-service-key': internalKey,
      'x-probe': 'kept',
    });

    expect(reply.status).toBe(200);
    expect(reply.text).toBe('upstream-ok');
    expect(received).toHaveLength(1);
    expect(received[0].headers['x-probe']).toBe('kept');
    expect(received[0].headers['x-internal-service-key']).toBeUndefined();
    expect(JSON.stringify(received[0].headers)).not.toContain(internalKey);
  });

  it('PreviewController still rewrites the path for the container', async () => {
    await get('/api/preview/p1/proxy/assets/main.js', { 'x-internal-service-key': internalKey });
    expect(received[0].url).toBe('/assets/main.js');
  });

  it('refuses every proxy without the key (no request reaches the container)', async () => {
    for (const path of [
      '/api/preview/p1/proxy/assets/main.js',
      '/api/previews/p1/assets/main.js',
      '/api/internal-previews/proxy/p1/assets/main.js',
    ]) {
      const reply = await get(path, {});
      expect(reply.status).toBe(403);
    }
    expect(received).toHaveLength(0);
  });

  it('registers no upgrade listener after proxied requests (no ws: true)', async () => {
    const server = app.getHttpServer() as http.Server;
    const before = server.listenerCount('upgrade');
    for (const path of [
      '/api/preview/p1/proxy/',
      '/api/previews/p1/x',
      '/api/internal-previews/proxy/p1/x',
    ]) {
      await get(path, { 'x-internal-service-key': internalKey });
    }
    expect(received).toHaveLength(3);
    expect(before).toBe(0);
    expect(server.listenerCount('upgrade')).toBe(0);
  });

  it('a WebSocket upgrade without the key is never proxied to the container', async () => {
    // A proxied request first: with ws: true this used to subscribe the
    // server's 'upgrade' event, which no Nest guard ever sees.
    await get('/api/preview/p1/proxy/', { 'x-internal-service-key': internalKey });
    received.length = 0;

    const port = (app.getHttpServer().address() as AddressInfo).port;
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
    expect(upgrades).toHaveLength(0);
    expect(received).toHaveLength(0);
  });
});

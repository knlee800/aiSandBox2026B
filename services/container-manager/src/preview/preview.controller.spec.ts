import 'reflect-metadata';
import { INestApplication, Module } from '@nestjs/common';
import { APP_GUARD, NestFactory } from '@nestjs/core';
import * as http from 'http';
import { AddressInfo } from 'net';

jest.mock('better-sqlite3', () => jest.fn());

import { InternalServiceAuthGuard } from '../guards/internal-service-auth.guard';
import { DockerRuntimeService } from '../docker/docker-runtime.service';
import { SessionsService } from '../sessions/sessions.service';
import { PreviewController } from './preview.controller';
import { PreviewService } from './preview.service';
import { PreviewStrategyResolver } from './preview-strategy.resolver';
import { PreviewService as PreviewPortRegistry } from '../previews/preview.service';

/**
 * CM-BINARY-01: a static preview served over real HTTP, through the real
 * PreviewController and PreviewService. Only the container read is a fake.
 * Binary files must arrive byte for byte; HTML still gets its base tag.
 */

const internalKey = 'cm-binary-01-preview-key';
const SESSION = 'static-session';

// A PNG signature, every byte value, and sequences that are invalid UTF-8.
const PNG_LIKE = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from(Array.from({ length: 256 }, (_, index) => index)),
  Buffer.from([0x80, 0xc3, 0xff, 0xfe, 0x00, 0xe2, 0x82]),
]);

describe('PreviewController static preview over HTTP (CM-BINARY-01)', () => {
  const originalKey = process.env.INTERNAL_SERVICE_KEY;
  let app: INestApplication;
  let baseUrl: string;

  const dockerRuntimeService = {
    readFileBufferFromContainer: jest.fn<Promise<Buffer>, [string, string]>(),
  };
  // BROWSER-SMOKE-02: PreviewService subscribes to session ends on init.
  const sessionsService = { assertSessionUsable: jest.fn(), onSessionEnded: jest.fn() };
  const previewStrategyResolver = {
    resolve: jest.fn(async () => ({
      type: 'static-html',
      framework: 'Static HTML',
      command: 'npx serve -s . -l tcp://0.0.0.0:$PORT',
      appRoot: '/workspace',
      servingMode: 'direct-read',
    })),
  };

  beforeAll(async () => {
    process.env.INTERNAL_SERVICE_KEY = internalKey;

    @Module({
      controllers: [PreviewController],
      providers: [
        PreviewService,
        { provide: SessionsService, useValue: sessionsService },
        { provide: DockerRuntimeService, useValue: dockerRuntimeService },
        { provide: PreviewStrategyResolver, useValue: previewStrategyResolver },
        // BROWSER-SMOKE-01: the browser-smoke port registry PreviewService injects.
        {
          provide: PreviewPortRegistry,
          useValue: {
            registerPreviewPort: jest.fn(),
            unregisterPreviewPort: jest.fn(),
            getRegisteredPort: jest.fn(),
            // BROWSER-SMOKE-02: a static preview registers its app root.
            registerStaticPreview: jest.fn(async (_sessionId: string, appRoot: string) => ({
              sessionId: _sessionId,
              appRoot,
              registered: true,
            })),
            getStaticRoot: jest.fn(() => '/workspace'),
            unregisterStaticPreview: jest.fn(),
          },
        },
        { provide: APP_GUARD, useClass: InternalServiceAuthGuard },
      ],
    })
    class PreviewStaticTestModule {}

    app = await NestFactory.create(PreviewStaticTestModule, { logger: false });
    app.setGlobalPrefix('api');
    await app.listen(0, '127.0.0.1');
    const server = app.getHttpServer() as http.Server;
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    await app.get(PreviewService).startPreview(SESSION);
  });

  afterAll(async () => {
    await app?.close();
    if (originalKey === undefined) {
      delete process.env.INTERNAL_SERVICE_KEY;
    } else {
      process.env.INTERNAL_SERVICE_KEY = originalKey;
    }
  });

  beforeEach(() => {
    dockerRuntimeService.readFileBufferFromContainer.mockReset();
  });

  async function get(path: string) {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: { 'x-internal-service-key': internalKey },
      signal: AbortSignal.timeout(5000),
    });
    return {
      status: response.status,
      contentType: response.headers.get('content-type'),
      contentLength: response.headers.get('content-length'),
      body: Buffer.from(await response.arrayBuffer()),
    };
  }

  it('serves a binary file byte for byte with its content type', async () => {
    dockerRuntimeService.readFileBufferFromContainer.mockResolvedValue(PNG_LIKE);

    const reply = await get(`/api/preview/${SESSION}/proxy/images/logo.png`);

    expect(reply.status).toBe(200);
    expect(reply.contentType).toBe('image/png');
    expect(reply.contentLength).toBe(String(PNG_LIKE.length));
    expect(reply.body.equals(PNG_LIKE)).toBe(true);
    expect(dockerRuntimeService.readFileBufferFromContainer).toHaveBeenCalledWith(
      SESSION,
      'images/logo.png',
    );
  });

  it('serves a .woff2 font as bytes with Content-Type font/woff2', async () => {
    dockerRuntimeService.readFileBufferFromContainer.mockResolvedValue(PNG_LIKE);

    const reply = await get(`/api/preview/${SESSION}/proxy/fonts/inter.woff2`);

    expect(reply.status).toBe(200);
    expect(reply.contentType).toBe('font/woff2');
    expect(reply.contentLength).toBe(String(PNG_LIKE.length));
    expect(reply.body.equals(PNG_LIKE)).toBe(true);
  });

  it('serves HTML with the base tag, UTF-8 encoded', async () => {
    dockerRuntimeService.readFileBufferFromContainer.mockResolvedValue(
      Buffer.from('<html><head><title>Café 😀</title></head></html>', 'utf8'),
    );

    const reply = await get(`/api/preview/${SESSION}/proxy/`);

    expect(reply.status).toBe(200);
    expect(reply.contentType).toBe('text/html; charset=utf-8');
    expect(reply.body.toString('utf8')).toBe(
      `<html><head><base href="/api/preview/${SESSION}/proxy/"><script src="/api/preview/${SESSION}/proxy/__aisb/bridge.js" async data-aisb-preview-bridge></script><title>Café 😀</title></head></html>`,
    );
    expect(dockerRuntimeService.readFileBufferFromContainer).toHaveBeenCalledWith(SESSION, 'index.html');
  });

  it('serves CSS text unchanged with its content type', async () => {
    dockerRuntimeService.readFileBufferFromContainer.mockResolvedValue(Buffer.from('body { color: red; }'));

    const reply = await get(`/api/preview/${SESSION}/proxy/style.css`);

    expect(reply.status).toBe(200);
    expect(reply.contentType).toBe('text/css; charset=utf-8');
    expect(reply.body.toString('utf8')).toBe('body { color: red; }');
  });

  it('still answers 503 for a session with no running preview', async () => {
    const reply = await get('/api/preview/other-session/proxy/logo.png');

    expect(reply.status).toBe(503);
    expect(dockerRuntimeService.readFileBufferFromContainer).not.toHaveBeenCalled();
  });

  it('still refuses a traversal path with 400 before any read', async () => {
    const reply = await get(`/api/preview/${SESSION}/proxy/a/..%2F..%2Fsecret.png`);

    expect(reply.status).toBe(400);
    expect(dockerRuntimeService.readFileBufferFromContainer).not.toHaveBeenCalled();
  });
});

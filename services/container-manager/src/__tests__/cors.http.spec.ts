import 'reflect-metadata';
import { INestApplication, Module } from '@nestjs/common';
import { APP_GUARD, NestFactory } from '@nestjs/core';
import * as fs from 'fs';
import * as path from 'path';
import { AddressInfo } from 'net';

import { configureApp } from '../app-setup';
import { HealthController } from '../health/health.controller';
import { InternalServiceAuthGuard } from '../guards/internal-service-auth.guard';

/**
 * CM-CLEANUP-01 (F5): container-manager answers no cross-origin request with
 * CORS headers. No browser calls it; the old setting (origin: true,
 * credentials: true) allowed any origin with credentials.
 */

const internalKey = 'cm-cleanup-01-cors-key';
const foreignOrigin = 'https://evil.example';

@Module({
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: InternalServiceAuthGuard }],
})
class CorsTestModule {}

async function startApp(withOldCors: boolean): Promise<{ app: INestApplication; baseUrl: string }> {
  const app = await NestFactory.create(CorsTestModule, { logger: false });
  configureApp(app);
  if (withOldCors) {
    // Positive control only: the setting main.ts had before CM-CLEANUP-01.
    app.enableCors({ origin: true, credentials: true });
  }
  await app.listen(0, '127.0.0.1');
  const port = (app.getHttpServer().address() as AddressInfo).port;
  return { app, baseUrl: `http://127.0.0.1:${port}` };
}

async function preflight(baseUrl: string, urlPath: string) {
  const response = await fetch(`${baseUrl}${urlPath}`, {
    method: 'OPTIONS',
    headers: {
      origin: foreignOrigin,
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'content-type,x-internal-service-key',
    },
    signal: AbortSignal.timeout(5000),
  });
  await response.text();
  return response;
}

describe('container-manager CORS (CM-CLEANUP-01 F5)', () => {
  const originalKey = process.env.INTERNAL_SERVICE_KEY;
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    process.env.INTERNAL_SERVICE_KEY = internalKey;
    ({ app, baseUrl } = await startApp(false));
  });

  afterAll(async () => {
    await app?.close();
    if (originalKey === undefined) {
      delete process.env.INTERNAL_SERVICE_KEY;
    } else {
      process.env.INTERNAL_SERVICE_KEY = originalKey;
    }
  });

  it.each(['/api/health', '/api/internal/stats', '/api/internal/sessions/p1/exec'])(
    'a cross-origin preflight to %s gets no Access-Control-Allow-Origin',
    async (urlPath) => {
      const response = await preflight(baseUrl, urlPath);
      expect(response.headers.get('access-control-allow-origin')).toBeNull();
      expect(response.headers.get('access-control-allow-credentials')).toBeNull();
      expect(response.headers.get('access-control-allow-methods')).toBeNull();
      expect(response.headers.get('access-control-allow-headers')).toBeNull();
    },
  );

  it('a cross-origin GET /api/health is served with no CORS headers', async () => {
    const response = await fetch(`${baseUrl}/api/health`, {
      headers: { origin: foreignOrigin },
      signal: AbortSignal.timeout(5000),
    });
    expect(response.status).toBe(200);
    await response.text();
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
    expect(response.headers.get('access-control-allow-credentials')).toBeNull();
  });

  it('positive control: the old setting would have answered the preflight', async () => {
    const old = await startApp(true);
    try {
      const response = await preflight(old.baseUrl, '/api/health');
      expect(response.headers.get('access-control-allow-origin')).toBe(foreignOrigin);
      expect(response.headers.get('access-control-allow-credentials')).toBe('true');
    } finally {
      await old.app.close();
    }
  });

  it('main.ts uses configureApp and enables no CORS', () => {
    const mainSource = fs.readFileSync(path.join(__dirname, '..', 'main.ts'), 'utf8');
    expect(mainSource).toContain('configureApp(app)');
    expect(mainSource).not.toMatch(/enableCors/);
    expect(mainSource).not.toMatch(/\bcors\s*:/);
    const setupSource = fs.readFileSync(path.join(__dirname, '..', 'app-setup.ts'), 'utf8');
    expect(setupSource).not.toMatch(/enableCors\s*\(/);
  });
});

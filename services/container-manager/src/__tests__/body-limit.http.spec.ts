import 'reflect-metadata';
import { Body, Controller, INestApplication, Module, Post } from '@nestjs/common';
import { APP_GUARD, NestFactory } from '@nestjs/core';
import { IsString } from 'class-validator';
import { randomBytes } from 'crypto';
import { AddressInfo } from 'net';

// SessionsService is never constructed here (it is mocked), but its module
// graph is imported through the controller. Keep the native SQLite binding out.
jest.mock('better-sqlite3', () => jest.fn());

import { configureApp, JSON_BODY_LIMIT } from '../app-setup';
import { InternalServiceAuthGuard } from '../guards/internal-service-auth.guard';
import { BrowserSmokeService } from '../browser-smoke/browser-smoke.service';
import { InternalSessionsController } from '../sessions/internal-sessions.controller';
import { SessionsService } from '../sessions/sessions.service';

/**
 * SNAPSHOT-SIZE-01: container-manager accepts JSON bodies up to 16 MB, set
 * once in configureApp, so snapshot files of ordinary size (images, fonts)
 * survive a restore through POST /api/internal/sessions/:id/files.
 *
 * Real HTTP over a Nest app on a random loopback port, using Node's built-in
 * fetch (no supertest, no @nestjs/testing), like the other HTTP specs.
 */

const internalKey = 'snapshot-size-01-http-key';
const LIMIT_BYTES = 16 * 1024 * 1024;
const EXPRESS_DEFAULT_LIMIT_BYTES = 100 * 1024;

class ProbeDto {
  @IsString()
  name: string;
}

@Controller('body-limit-probe')
class BodyLimitProbeController {
  /** Metatype Object: the ValidationPipe passes the body through untouched. */
  @Post('size')
  size(@Body() body: Record<string, unknown>) {
    return { length: typeof body.data === 'string' ? body.data.length : -1 };
  }

  @Post('whitelist')
  whitelist(@Body() body: ProbeDto) {
    return body;
  }
}

const sessionsServiceMock = { writeFileToContainer: jest.fn() };

@Module({
  controllers: [BodyLimitProbeController, InternalSessionsController],
  providers: [
    { provide: SessionsService, useValue: sessionsServiceMock },
    { provide: BrowserSmokeService, useValue: {} },
    { provide: APP_GUARD, useClass: InternalServiceAuthGuard },
  ],
})
class BodyLimitTestModule {}

async function startApp(withConfigureApp: boolean): Promise<{ app: INestApplication; baseUrl: string }> {
  const app = await NestFactory.create(BodyLimitTestModule, { logger: false });
  if (withConfigureApp) {
    configureApp(app);
  } else {
    // Control only: Nest's defaults (100 KB JSON parser) with the same prefix.
    app.setGlobalPrefix('api');
  }
  await app.listen(0, '127.0.0.1');
  const port = (app.getHttpServer().address() as AddressInfo).port;
  return { app, baseUrl: `http://127.0.0.1:${port}` };
}

type Reply = { status: number; text: string };

async function postRaw(baseUrl: string, path: string, body: string, key?: string): Promise<Reply> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (key !== undefined) {
    headers['x-internal-service-key'] = key;
  }
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers,
    body,
    signal: AbortSignal.timeout(20000),
  });
  return { status: response.status, text: await response.text() };
}

/** A JSON body `{"data":"aaa..."}` of exactly `bytes` bytes. */
function jsonBodyOfSize(bytes: number): string {
  const overhead = Buffer.byteLength('{"data":""}');
  const body = `{"data":"${'a'.repeat(bytes - overhead)}"}`;
  expect(Buffer.byteLength(body)).toBe(bytes);
  return body;
}

describe('container-manager JSON body limit (SNAPSHOT-SIZE-01)', () => {
  const originalKey = process.env.INTERNAL_SERVICE_KEY;
  let app: INestApplication;
  let baseUrl: string;

  jest.setTimeout(60000);

  beforeAll(async () => {
    process.env.INTERNAL_SERVICE_KEY = internalKey;
    ({ app, baseUrl } = await startApp(true));
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
    sessionsServiceMock.writeFileToContainer.mockReset();
    sessionsServiceMock.writeFileToContainer.mockResolvedValue(undefined);
  });

  it('sets the limit to 16 MB', () => {
    expect(JSON_BODY_LIMIT).toBe('16mb');
  });

  it('control: without configureApp a 1 MB JSON body gets 413 (the default 100 KB parser)', async () => {
    const control = await startApp(false);
    try {
      const small = await postRaw(control.baseUrl, '/api/body-limit-probe/size', jsonBodyOfSize(EXPRESS_DEFAULT_LIMIT_BYTES - 1024), internalKey);
      expect(small.status).toBe(201);
      const reply = await postRaw(control.baseUrl, '/api/body-limit-probe/size', jsonBodyOfSize(1024 * 1024), internalKey);
      expect(reply.status).toBe(413);
    } finally {
      await control.app.close();
    }
  });

  it('accepts a JSON body of about 1 MB (the default 100 KB parser no longer applies)', async () => {
    const body = jsonBodyOfSize(1024 * 1024);
    const reply = await postRaw(baseUrl, '/api/body-limit-probe/size', body, internalKey);
    expect(reply.status).toBe(201);
    expect(JSON.parse(reply.text)).toEqual({ length: 1024 * 1024 - Buffer.byteLength('{"data":""}') });
  });

  it('accepts a JSON body of exactly 16 MB', async () => {
    const reply = await postRaw(baseUrl, '/api/body-limit-probe/size', jsonBodyOfSize(LIMIT_BYTES), internalKey);
    expect(reply.status).toBe(201);
    expect(JSON.parse(reply.text)).toEqual({ length: LIMIT_BYTES - Buffer.byteLength('{"data":""}') });
  });

  it('answers 413 to a JSON body one byte over 16 MB', async () => {
    const reply = await postRaw(baseUrl, '/api/body-limit-probe/size', jsonBodyOfSize(LIMIT_BYTES + 1), internalKey);
    expect(reply.status).toBe(413);
  });

  it('registers exactly one JSON parser (the default one is not added beside it)', () => {
    const stack = (app.getHttpAdapter().getInstance()._router?.stack ?? []) as Array<{ handle?: { name?: string } }>;
    expect(stack.filter((layer) => layer.handle?.name === 'jsonParser')).toHaveLength(1);
  });

  describe('POST /api/internal/sessions/:id/files', () => {
    const payload = randomBytes(2 * 1024 * 1024);
    const fileBody = JSON.stringify({ path: 'assets/big.png', content: payload.toString('base64'), encoding: 'base64' });

    it('the base64 body for a 2 MB binary is over the old default limit', () => {
      expect(Buffer.byteLength(fileBody)).toBeGreaterThan(EXPRESS_DEFAULT_LIMIT_BYTES);
    });

    it('with the key, writes the exact 2 MB of bytes', async () => {
      const reply = await postRaw(baseUrl, '/api/internal/sessions/p1/files', fileBody, internalKey);
      expect(reply.status).toBe(204);
      expect(sessionsServiceMock.writeFileToContainer).toHaveBeenCalledTimes(1);
      const [sessionId, filePath, bytes] = sessionsServiceMock.writeFileToContainer.mock.calls[0];
      expect(sessionId).toBe('p1');
      expect(filePath).toBe('assets/big.png');
      expect(Buffer.isBuffer(bytes)).toBe(true);
      expect(Buffer.compare(bytes as Buffer, payload)).toBe(0);
    });

    it('with the key, writes a 1 MB text file unchanged', async () => {
      const text = 'line of text\n'.repeat(80000);
      const reply = await postRaw(
        baseUrl,
        '/api/internal/sessions/p1/files',
        JSON.stringify({ path: 'notes.txt', content: text }),
        internalKey,
      );
      expect(reply.status).toBe(204);
      expect(sessionsServiceMock.writeFileToContainer).toHaveBeenCalledWith('p1', 'notes.txt', text);
    });

    it('without the key, still answers 403 and the handler is not reached', async () => {
      const reply = await postRaw(baseUrl, '/api/internal/sessions/p1/files', fileBody);
      expect(reply.status).toBe(403);
      expect(sessionsServiceMock.writeFileToContainer).not.toHaveBeenCalled();
    });

    it('with a wrong key, answers 403 and the handler is not reached', async () => {
      const reply = await postRaw(baseUrl, '/api/internal/sessions/p1/files', fileBody, 'snapshot-size-01-http-kez');
      expect(reply.status).toBe(403);
      expect(sessionsServiceMock.writeFileToContainer).not.toHaveBeenCalled();
    });
  });

  it('the ValidationPipe still strips unknown fields (whitelist)', async () => {
    const reply = await postRaw(
      baseUrl,
      '/api/body-limit-probe/whitelist',
      JSON.stringify({ name: 'x', extra: 'dropped' }),
      internalKey,
    );
    expect(reply.status).toBe(201);
    expect(JSON.parse(reply.text)).toEqual({ name: 'x' });
  });

  it("routes are still served under the 'api' prefix only", async () => {
    const prefixed = await postRaw(baseUrl, '/api/body-limit-probe/size', '{"data":"a"}', internalKey);
    expect(prefixed.status).toBe(201);
    const bare = await postRaw(baseUrl, '/body-limit-probe/size', '{"data":"a"}', internalKey);
    expect(bare.status).toBe(404);
  });
});

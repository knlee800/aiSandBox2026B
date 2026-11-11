import 'reflect-metadata';
import { Body, Controller, INestApplication, Module, Post } from '@nestjs/common';
import { APP_GUARD, NestFactory } from '@nestjs/core';
import { IsString } from 'class-validator';
import { randomBytes } from 'crypto';
import { request as httpRequest } from 'http';
import { AddressInfo } from 'net';

// SessionsService is never constructed here (it is mocked), but its module
// graph is imported through the controller. Keep the native SQLite binding out.
jest.mock('better-sqlite3', () => jest.fn());

import { configureApp, DEFAULT_JSON_BODY_LIMIT, isFileWriteRequest, JSON_BODY_LIMIT } from '../app-setup';
import { InternalServiceAuthGuard } from '../guards/internal-service-auth.guard';
import { BrowserSmokeService } from '../browser-smoke/browser-smoke.service';
import { InternalSessionsController } from '../sessions/internal-sessions.controller';
import { SessionsService } from '../sessions/sessions.service';

/**
 * SNAPSHOT-SIZE-01 / CM-BODY-ROUTE-01: container-manager accepts JSON bodies
 * up to 16 MB only on POST /api/internal/sessions/:id/files (snapshot
 * restores write images and fonts through it); every other route keeps the
 * 100 KB default, because Express parses bodies before the guard runs.
 * CM-BODY-KEY-01: the 16 MB parser also needs the valid internal key, so a
 * file write without it gets the 100 KB parser (413 when larger, else 403).
 *
 * Real HTTP over a Nest app on a random loopback port, using Node's built-in
 * fetch (no supertest, no @nestjs/testing), like the other HTTP specs.
 */

const internalKey = 'cm-body-route-01-http-key';
const LIMIT_BYTES = 16 * 1024 * 1024;
const DEFAULT_LIMIT_BYTES = 100 * 1024;
const ONE_MB = 1024 * 1024;
const FILE_ROUTE = '/api/internal/sessions/p1/files';
const SEARCH_ROUTE = '/api/internal/sessions/p1/files/search';

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

const sessionsServiceMock = {
  writeFileToContainer: jest.fn(),
  deleteFileFromContainer: jest.fn(),
  searchFilesInContainer: jest.fn(),
};

@Module({
  controllers: [BodyLimitProbeController, InternalSessionsController],
  providers: [
    { provide: SessionsService, useValue: sessionsServiceMock },
    { provide: BrowserSmokeService, useValue: {} },
    { provide: APP_GUARD, useClass: InternalServiceAuthGuard },
  ],
})
class BodyLimitTestModule {}

const KEEP_ENV = Symbol('keep the environment key at configureApp');

/**
 * `keyAtSetup` (CM-BODY-KEY-01): what INTERNAL_SERVICE_KEY holds when
 * configureApp runs (null = unset). The guard is built before that with
 * the test key, so only the body parsers see the other value. The caller
 * restores the environment.
 */
async function startApp(
  withConfigureApp: boolean,
  keyAtSetup: string | null | typeof KEEP_ENV = KEEP_ENV,
): Promise<{ app: INestApplication; baseUrl: string }> {
  const app = await NestFactory.create(BodyLimitTestModule, { logger: false });
  if (keyAtSetup !== KEEP_ENV) {
    if (keyAtSetup === null) {
      delete process.env.INTERNAL_SERVICE_KEY;
    } else {
      process.env.INTERNAL_SERVICE_KEY = keyAtSetup;
    }
  }
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

async function sendRaw(
  baseUrl: string,
  method: string,
  path: string,
  body: string,
  key?: string,
): Promise<Reply> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (key !== undefined) {
    headers['x-internal-service-key'] = key;
  }
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body,
    signal: AbortSignal.timeout(20000),
  });
  return { status: response.status, text: await response.text() };
}

function postRaw(baseUrl: string, path: string, body: string, key?: string): Promise<Reply> {
  return sendRaw(baseUrl, 'POST', path, body, key);
}

/**
 * POST with the key header sent once per entry of `keyLines`, as separate
 * header lines on the wire (fetch would fold them into one value first).
 */
function postWithKeyLines(baseUrl: string, path: string, body: string, keyLines: string[]): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const request = httpRequest(
      new URL(path, baseUrl),
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(body),
          'x-internal-service-key': keyLines,
        },
        timeout: 20000,
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () =>
          resolve({ status: response.statusCode ?? 0, text: Buffer.concat(chunks).toString('utf8') }),
        );
        response.on('error', reject);
      },
    );
    request.on('timeout', () => request.destroy(new Error('timeout')));
    request.on('error', reject);
    request.end(body);
  });
}

/** A JSON body `{"data":"aaa..."}` of exactly `bytes` bytes. */
function jsonBodyOfSize(bytes: number): string {
  const overhead = Buffer.byteLength('{"data":""}');
  const body = `{"data":"${'a'.repeat(bytes - overhead)}"}`;
  expect(Buffer.byteLength(body)).toBe(bytes);
  return body;
}

/** A file write body `{"path":"big.txt","content":"aaa..."}` of exactly `bytes` bytes. */
function fileBodyOfSize(bytes: number): { body: string; contentLength: number } {
  const overhead = Buffer.byteLength('{"path":"big.txt","content":""}');
  const contentLength = bytes - overhead;
  const body = `{"path":"big.txt","content":"${'a'.repeat(contentLength)}"}`;
  expect(Buffer.byteLength(body)).toBe(bytes);
  return { body, contentLength };
}

/** A search body `{"query":"aaa..."}` of exactly `bytes` bytes. */
function searchBodyOfSize(bytes: number): string {
  const overhead = Buffer.byteLength('{"query":""}');
  const body = `{"query":"${'a'.repeat(bytes - overhead)}"}`;
  expect(Buffer.byteLength(body)).toBe(bytes);
  return body;
}

type StackLayer = { handle?: { name?: string } & ((...args: unknown[]) => unknown) };

function jsonParserLayers(app: INestApplication): StackLayer[] {
  const stack = (app.getHttpAdapter().getInstance()._router?.stack ?? []) as StackLayer[];
  return stack.filter((layer) => layer.handle?.name === 'jsonParser');
}

describe('container-manager JSON body limits (SNAPSHOT-SIZE-01, CM-BODY-ROUTE-01, CM-BODY-KEY-01)', () => {
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
    sessionsServiceMock.deleteFileFromContainer.mockReset();
    sessionsServiceMock.deleteFileFromContainer.mockResolvedValue(undefined);
    sessionsServiceMock.searchFilesInContainer.mockReset();
    sessionsServiceMock.searchFilesInContainer.mockImplementation(async (_id: string, query: string) => ({
      query,
      results: [],
      truncated: false,
    }));
  });

  it('sets the file write limit to 16 MB and the default to 100 KB', () => {
    expect(JSON_BODY_LIMIT).toBe('16mb');
    expect(DEFAULT_JSON_BODY_LIMIT).toBe('100kb');
  });

  it('control: without configureApp a 1 MB JSON body gets 413 (the default 100 KB parser)', async () => {
    const control = await startApp(false);
    try {
      const small = await postRaw(control.baseUrl, '/api/body-limit-probe/size', jsonBodyOfSize(DEFAULT_LIMIT_BYTES - 1024), internalKey);
      expect(small.status).toBe(201);
      const reply = await postRaw(control.baseUrl, '/api/body-limit-probe/size', jsonBodyOfSize(ONE_MB), internalKey);
      expect(reply.status).toBe(413);
    } finally {
      await control.app.close();
    }
  });

  describe('isFileWriteRequest (which requests get the 16 MB parser)', () => {
    it.each([
      ['POST', '/api/internal/sessions/p1/files'],
      ['POST', '/api/internal/sessions/11111111-1111-4111-8111-111111111111/files'],
      ['POST', '/api/internal/sessions/k3j9x0a2/files'],
    ])('matches %s %s', (method, path) => {
      expect(isFileWriteRequest(method, path)).toBe(true);
    });

    it.each([
      ['GET', '/api/internal/sessions/p1/files'],
      ['DELETE', '/api/internal/sessions/p1/files'],
      ['PUT', '/api/internal/sessions/p1/files'],
      ['post', '/api/internal/sessions/p1/files'],
      ['POST', '/api/internal/sessions/p1/files/'],
      ['POST', '/api/internal/sessions/p1/files/search'],
      ['POST', '/api/internal/sessions/p1/files/x'],
      ['POST', '/api/internal/sessions/p1/filesx'],
      ['POST', '/api/internal/sessions/p1/%66iles'],
      ['POST', '/api/internal/sessions/p1/Files'],
      ['POST', '/API/internal/sessions/p1/files'],
      ['POST', '/api/internal/sessions//files'],
      ['POST', '/api/internal/sessions/a/b/files'],
      ['POST', '/api/internal/sessions/files'],
      ['POST', '/internal/sessions/p1/files'],
      ['POST', '/x/api/internal/sessions/p1/files'],
      ['POST', '/api/internal/sessions/p1/files?x=1'],
      ['POST', '/api/internal/sessions/p1/previews'],
      ['POST', '/api/body-limit-probe/size'],
      [undefined, '/api/internal/sessions/p1/files'],
      ['POST', undefined],
    ])('does not match %s %s', (method, path) => {
      expect(isFileWriteRequest(method as string | undefined, path as string | undefined)).toBe(false);
    });
  });

  it('registers two JSON parsers (the 16 MB and the 100 KB one) and Nest adds no default beside them', () => {
    expect(jsonParserLayers(app)).toHaveLength(2);
  });

  describe('POST /api/internal/sessions/:id/files (16 MB)', () => {
    const payload = randomBytes(2 * 1024 * 1024);
    const fileBody = JSON.stringify({ path: 'assets/big.png', content: payload.toString('base64'), encoding: 'base64' });

    it('the base64 body for a 2 MB binary is over the default limit', () => {
      expect(Buffer.byteLength(fileBody)).toBeGreaterThan(DEFAULT_LIMIT_BYTES);
    });

    it('with the key, accepts a body of about 1 MB', async () => {
      const { body, contentLength } = fileBodyOfSize(ONE_MB);
      const reply = await postRaw(baseUrl, FILE_ROUTE, body, internalKey);
      expect(reply.status).toBe(204);
      expect(sessionsServiceMock.writeFileToContainer).toHaveBeenCalledTimes(1);
      const [, filePath, content] = sessionsServiceMock.writeFileToContainer.mock.calls[0];
      expect(filePath).toBe('big.txt');
      expect((content as string).length).toBe(contentLength);
    });

    it('with the key, accepts a body of exactly 16 MB', async () => {
      const { body, contentLength } = fileBodyOfSize(LIMIT_BYTES);
      const reply = await postRaw(baseUrl, FILE_ROUTE, body, internalKey);
      expect(reply.status).toBe(204);
      expect(sessionsServiceMock.writeFileToContainer).toHaveBeenCalledTimes(1);
      expect((sessionsServiceMock.writeFileToContainer.mock.calls[0][2] as string).length).toBe(contentLength);
    });

    it('with the key, answers 413 to a body one byte over 16 MB and the handler is not reached', async () => {
      const reply = await postRaw(baseUrl, FILE_ROUTE, fileBodyOfSize(LIMIT_BYTES + 1).body, internalKey);
      expect(reply.status).toBe(413);
      expect(sessionsServiceMock.writeFileToContainer).not.toHaveBeenCalled();
    });

    it('with the key, writes the exact 2 MB of bytes', async () => {
      const reply = await postRaw(baseUrl, FILE_ROUTE, fileBody, internalKey);
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
      const reply = await postRaw(baseUrl, FILE_ROUTE, JSON.stringify({ path: 'notes.txt', content: text }), internalKey);
      expect(reply.status).toBe(204);
      expect(sessionsServiceMock.writeFileToContainer).toHaveBeenCalledWith('p1', 'notes.txt', text);
    });

    it('with the key and a UUID session id and a query string, still gets the 16 MB limit', async () => {
      const id = '11111111-1111-4111-8111-111111111111';
      const reply = await postRaw(baseUrl, `/api/internal/sessions/${id}/files?x=1`, fileBody, internalKey);
      expect(reply.status).toBe(204);
      expect(sessionsServiceMock.writeFileToContainer.mock.calls[0][0]).toBe(id);
    });

    it('without the key, the 2 MB body gets 413 (CM-BODY-KEY-01: not parsed at 16 MB) and the handler is not reached', async () => {
      const reply = await postRaw(baseUrl, FILE_ROUTE, fileBody);
      expect(reply.status).toBe(413);
      expect(sessionsServiceMock.writeFileToContainer).not.toHaveBeenCalled();
    });

    it('with a wrong key, the 2 MB body gets 413 (CM-BODY-KEY-01) and the handler is not reached', async () => {
      const reply = await postRaw(baseUrl, FILE_ROUTE, fileBody, 'cm-body-route-01-http-kez');
      expect(reply.status).toBe(413);
      expect(sessionsServiceMock.writeFileToContainer).not.toHaveBeenCalled();
    });

    it('with the key, a bad session id still gets 400 from SessionIdPipe', async () => {
      const reply = await postRaw(baseUrl, '/api/internal/sessions/a%2Fb/files', '{"path":"x","content":"y"}', internalKey);
      expect(reply.status).toBe(400);
      expect(sessionsServiceMock.writeFileToContainer).not.toHaveBeenCalled();
    });
  });

  describe('the file write route without a valid key gets the 100 KB parser (CM-BODY-KEY-01)', () => {
    const smallWrite = '{"path":"x","content":"y"}';

    it.each([
      ['no key', undefined],
      ['an empty key', ''],
      ['a wrong key of the same length', 'cm-body-route-01-http-kez'],
      ['a wrong key that is one character shorter', internalKey.slice(0, -1)],
      ['a wrong key that is one character longer', `${internalKey}x`],
      ['the key with other letter case', internalKey.toUpperCase()],
    ])('%s: a 1 MB body gives 413, a small body gives 403, the handler is never reached', async (_label, key) => {
      expect(key === undefined || key !== internalKey).toBe(true);

      const big = await postRaw(baseUrl, FILE_ROUTE, fileBodyOfSize(ONE_MB).body, key);
      expect(big.status).toBe(413);

      const overDefault = await postRaw(baseUrl, FILE_ROUTE, fileBodyOfSize(DEFAULT_LIMIT_BYTES + 1).body, key);
      expect(overDefault.status).toBe(413);

      const small = await postRaw(baseUrl, FILE_ROUTE, smallWrite, key);
      expect(small.status).toBe(403);

      expect(sessionsServiceMock.writeFileToContainer).not.toHaveBeenCalled();
    });

    it('a body of exactly 100 KB without the key reaches the guard and gets 403', async () => {
      const reply = await postRaw(baseUrl, FILE_ROUTE, fileBodyOfSize(DEFAULT_LIMIT_BYTES).body);
      expect(reply.status).toBe(403);
      expect(sessionsServiceMock.writeFileToContainer).not.toHaveBeenCalled();
    });

    it('control: the key sent once as its own header line gets the 16 MB parser', async () => {
      const big = await postWithKeyLines(baseUrl, FILE_ROUTE, fileBodyOfSize(ONE_MB).body, [internalKey]);
      expect(big.status).toBe(204);
      expect(sessionsServiceMock.writeFileToContainer).toHaveBeenCalledTimes(1);
    });

    it('the key header sent twice (both lines the right key): a 1 MB body gives 413, a small body gives 403', async () => {
      const big = await postWithKeyLines(baseUrl, FILE_ROUTE, fileBodyOfSize(ONE_MB).body, [internalKey, internalKey]);
      expect(big.status).toBe(413);
      const small = await postWithKeyLines(baseUrl, FILE_ROUTE, smallWrite, [internalKey, internalKey]);
      expect(small.status).toBe(403);
      expect(sessionsServiceMock.writeFileToContainer).not.toHaveBeenCalled();
    });

    it('the key header sent twice (a wrong line, then the right key): a 1 MB body gives 413, a small body gives 403', async () => {
      const big = await postWithKeyLines(baseUrl, FILE_ROUTE, fileBodyOfSize(ONE_MB).body, ['wrong', internalKey]);
      expect(big.status).toBe(413);
      const small = await postWithKeyLines(baseUrl, FILE_ROUTE, smallWrite, ['wrong', internalKey]);
      expect(small.status).toBe(403);
      expect(sessionsServiceMock.writeFileToContainer).not.toHaveBeenCalled();
    });
  });

  describe.each([
    ['unset', null],
    ['empty', ''],
  ])('INTERNAL_SERVICE_KEY %s when configureApp runs: the 16 MB parser never applies (CM-BODY-KEY-01)', (_label, keyAtSetup) => {
    let noKeyApp: { app: INestApplication; baseUrl: string };

    beforeAll(async () => {
      try {
        noKeyApp = await startApp(true, keyAtSetup);
      } catch (error) {
        process.env.INTERNAL_SERVICE_KEY = internalKey;
        throw error;
      }
      // The environment stays as configureApp saw it while these tests run.
    });

    afterAll(async () => {
      await noKeyApp?.app.close();
      process.env.INTERNAL_SERVICE_KEY = internalKey;
    });

    it('the environment holds no usable key during these tests', () => {
      expect(process.env.INTERNAL_SERVICE_KEY || undefined).toBeUndefined();
    });

    it('with the header the guard accepts, a 1 MB file write gives 413', async () => {
      const reply = await postRaw(noKeyApp.baseUrl, FILE_ROUTE, fileBodyOfSize(ONE_MB).body, internalKey);
      expect(reply.status).toBe(413);
      expect(sessionsServiceMock.writeFileToContainer).not.toHaveBeenCalled();
    });

    it('with the header the guard accepts, a small file write still passes the guard (only the limit changed)', async () => {
      const reply = await postRaw(noKeyApp.baseUrl, FILE_ROUTE, '{"path":"x","content":"y"}', internalKey);
      expect(reply.status).toBe(204);
      expect(sessionsServiceMock.writeFileToContainer).toHaveBeenCalledWith('p1', 'x', 'y');
    });

    it.each([
      ['an empty header', ''],
      ['no header', undefined],
    ])('with %s, a 1 MB file write gives 413 and a small one 403', async (_headerLabel, key) => {
      const big = await postRaw(noKeyApp.baseUrl, FILE_ROUTE, fileBodyOfSize(ONE_MB).body, key);
      expect(big.status).toBe(413);
      const small = await postRaw(noKeyApp.baseUrl, FILE_ROUTE, '{"path":"x","content":"y"}', key);
      expect(small.status).toBe(403);
      expect(sessionsServiceMock.writeFileToContainer).not.toHaveBeenCalled();
    });

    it('another route keeps 100 KB', async () => {
      const reply = await postRaw(noKeyApp.baseUrl, SEARCH_ROUTE, searchBodyOfSize(DEFAULT_LIMIT_BYTES + 1), internalKey);
      expect(reply.status).toBe(413);
      const ok = await postRaw(noKeyApp.baseUrl, SEARCH_ROUTE, searchBodyOfSize(DEFAULT_LIMIT_BYTES), internalKey);
      expect(ok.status).toBe(200);
    });
  });

  describe('variants of the file write path get the 100 KB limit', () => {
    // Express routes the trailing-slash and letter-case variants to the same
    // handler (non-strict, case-insensitive routing); they still get only the
    // default parser. A percent-encoded literal is no route at all.
    it.each([
      ['a trailing slash', '/api/internal/sessions/p1/files/', 204],
      ['other letter case', '/api/internal/sessions/p1/FILES', 204],
      ['a percent-encoded literal', '/api/internal/sessions/p1/%66iles', 404],
    ])('%s (%s): a small body gives %i, a 1 MB body gives 413', async (_label, path, smallStatus) => {
      const small = await postRaw(baseUrl, path, '{"path":"x","content":"y"}', internalKey);
      expect(small.status).toBe(smallStatus);
      sessionsServiceMock.writeFileToContainer.mockClear();

      const big = await postRaw(baseUrl, path, fileBodyOfSize(ONE_MB).body, internalKey);
      expect(big.status).toBe(413);
      expect(sessionsServiceMock.writeFileToContainer).not.toHaveBeenCalled();
    });

    it('DELETE on the same path: a body over 100 KB gives 413', async () => {
      const big = await sendRaw(baseUrl, 'DELETE', FILE_ROUTE, fileBodyOfSize(DEFAULT_LIMIT_BYTES + 1).body, internalKey);
      expect(big.status).toBe(413);
      expect(sessionsServiceMock.deleteFileFromContainer).not.toHaveBeenCalled();
      const small = await sendRaw(baseUrl, 'DELETE', FILE_ROUTE, '{"path":"x"}', internalKey);
      expect(small.status).toBe(204);
      expect(sessionsServiceMock.deleteFileFromContainer).toHaveBeenCalledWith('p1', 'x');
    });
  });

  describe('POST /api/internal/sessions/:id/files/search (another guarded route, 100 KB)', () => {
    it('with the key, a small body still works', async () => {
      const reply = await postRaw(baseUrl, SEARCH_ROUTE, '{"query":"needle"}', internalKey);
      expect(reply.status).toBe(200);
      expect(JSON.parse(reply.text)).toEqual({ query: 'needle', results: [], truncated: false });
    });

    it('with the key, a body of exactly 100 KB is accepted', async () => {
      const reply = await postRaw(baseUrl, SEARCH_ROUTE, searchBodyOfSize(DEFAULT_LIMIT_BYTES), internalKey);
      expect(reply.status).toBe(200);
      expect(sessionsServiceMock.searchFilesInContainer).toHaveBeenCalledTimes(1);
    });

    it('with the key, a body one byte over 100 KB gives 413 and the handler is not reached', async () => {
      const reply = await postRaw(baseUrl, SEARCH_ROUTE, searchBodyOfSize(DEFAULT_LIMIT_BYTES + 1), internalKey);
      expect(reply.status).toBe(413);
      expect(sessionsServiceMock.searchFilesInContainer).not.toHaveBeenCalled();
    });

    it('without the key, a 1 MB body gives 413 (not parsed at 16 MB)', async () => {
      const reply = await postRaw(baseUrl, SEARCH_ROUTE, searchBodyOfSize(ONE_MB));
      expect(reply.status).toBe(413);
    });

    it('with the key, a 1 MB body gives 413 too (the key does not raise the limit off the file write route)', async () => {
      const reply = await postRaw(baseUrl, SEARCH_ROUTE, searchBodyOfSize(ONE_MB), internalKey);
      expect(reply.status).toBe(413);
      expect(sessionsServiceMock.searchFilesInContainer).not.toHaveBeenCalled();
    });

    it('without the key, a small body gives 403', async () => {
      const reply = await postRaw(baseUrl, SEARCH_ROUTE, '{"query":"needle"}');
      expect(reply.status).toBe(403);
      expect(sessionsServiceMock.searchFilesInContainer).not.toHaveBeenCalled();
    });
  });

  describe('other paths', () => {
    it('a guarded probe route: 1 MB gives 413, a small body still works', async () => {
      const big = await postRaw(baseUrl, '/api/body-limit-probe/size', jsonBodyOfSize(ONE_MB), internalKey);
      expect(big.status).toBe(413);
      const small = await postRaw(baseUrl, '/api/body-limit-probe/size', jsonBodyOfSize(DEFAULT_LIMIT_BYTES - 1024), internalKey);
      expect(small.status).toBe(201);
    });

    it('a guarded probe route without the key: 1 MB gives 413, a small body gives 403', async () => {
      const big = await postRaw(baseUrl, '/api/body-limit-probe/size', jsonBodyOfSize(ONE_MB));
      expect(big.status).toBe(413);
      const small = await postRaw(baseUrl, '/api/body-limit-probe/size', '{"data":"a"}');
      expect(small.status).toBe(403);
    });

    it('an unknown path: a 1 MB body without the key gives 413 (the 100 KB parser runs before routing)', async () => {
      const big = await postRaw(baseUrl, '/api/no-such-route', jsonBodyOfSize(ONE_MB));
      expect(big.status).toBe(413);
      const small = await postRaw(baseUrl, '/api/no-such-route', '{"data":"a"}');
      expect(small.status).toBe(404);
    });
  });

  describe('exactly one JSON parser runs per request', () => {
    let counted: { app: INestApplication; baseUrl: string };
    const parsedBy: number[] = [];

    beforeAll(async () => {
      counted = await startApp(true);
      // Wrap each JSON parser layer: record its index when it starts reading a
      // body (body-parser sets req._body before it reads, also on a 413).
      jsonParserLayers(counted.app).forEach((layer, index) => {
        const original = layer.handle as (req: { _body?: boolean }, res: unknown, next: (err?: unknown) => void) => void;
        const wrapped = function jsonParser(req: { _body?: boolean }, res: unknown, next: (err?: unknown) => void) {
          const before = Boolean(req._body);
          original(req, res, (err?: unknown) => {
            if (!before && req._body) {
              parsedBy.push(index);
            }
            next(err);
          });
        };
        (layer as { handle: unknown }).handle = wrapped;
      });
    });

    afterAll(async () => {
      await counted?.app.close();
    });

    beforeEach(() => {
      parsedBy.length = 0;
    });

    it('the file write route and another route are each parsed once, by different parsers', async () => {
      const write = await postRaw(counted.baseUrl, FILE_ROUTE, '{"path":"x","content":"y"}', internalKey);
      expect(write.status).toBe(204);
      expect(parsedBy).toHaveLength(1);
      const fileParser = parsedBy[0];

      parsedBy.length = 0;
      const search = await postRaw(counted.baseUrl, SEARCH_ROUTE, '{"query":"needle"}', internalKey);
      expect(search.status).toBe(200);
      expect(parsedBy).toHaveLength(1);
      expect(parsedBy[0]).not.toBe(fileParser);
    });

    it('a 1 MB file write is parsed once, by the large parser only (no 413 from the small one first)', async () => {
      const probe = await postRaw(counted.baseUrl, FILE_ROUTE, '{"path":"x","content":"y"}', internalKey);
      expect(probe.status).toBe(204);
      const fileParser = parsedBy[0];

      parsedBy.length = 0;
      const reply = await postRaw(counted.baseUrl, FILE_ROUTE, fileBodyOfSize(ONE_MB).body, internalKey);
      expect(reply.status).toBe(204);
      expect(parsedBy).toEqual([fileParser]);
    });

    it('a request without the key is parsed once too', async () => {
      const reply = await postRaw(counted.baseUrl, FILE_ROUTE, '{"path":"x","content":"y"}');
      expect(reply.status).toBe(403);
      expect(parsedBy).toHaveLength(1);
    });

    describe('CM-BODY-KEY-01: a file write without a valid key is parsed once, by the 100 KB parser', () => {
      let fileParser: number;
      let defaultParser: number;

      beforeEach(async () => {
        // Learn which wrapped parser is which from two requests with the key.
        const write = await postRaw(counted.baseUrl, FILE_ROUTE, '{"path":"x","content":"y"}', internalKey);
        expect(write.status).toBe(204);
        const search = await postRaw(counted.baseUrl, SEARCH_ROUTE, '{"query":"needle"}', internalKey);
        expect(search.status).toBe(200);
        expect(parsedBy).toHaveLength(2);
        [fileParser, defaultParser] = parsedBy;
        expect(fileParser).not.toBe(defaultParser);
        parsedBy.length = 0;
        sessionsServiceMock.writeFileToContainer.mockClear();
      });

      it.each([
        ['no key', undefined],
        ['an empty key', ''],
        ['a wrong key of the same length', 'cm-body-route-01-http-kez'],
        ['a wrong key of another length', `${internalKey}x`],
      ])('%s: a small body (403) and a 1 MB body (413) each by the default parser only', async (_label, key) => {
        const small = await postRaw(counted.baseUrl, FILE_ROUTE, '{"path":"x","content":"y"}', key);
        expect(small.status).toBe(403);
        expect(parsedBy).toEqual([defaultParser]);

        parsedBy.length = 0;
        const big = await postRaw(counted.baseUrl, FILE_ROUTE, fileBodyOfSize(ONE_MB).body, key);
        expect(big.status).toBe(413);
        expect(parsedBy).toEqual([defaultParser]);
        expect(sessionsServiceMock.writeFileToContainer).not.toHaveBeenCalled();
      });

      it('the key header sent twice: parsed once, by the default parser', async () => {
        const big = await postWithKeyLines(counted.baseUrl, FILE_ROUTE, fileBodyOfSize(ONE_MB).body, [internalKey, internalKey]);
        expect(big.status).toBe(413);
        expect(parsedBy).toEqual([defaultParser]);
      });

      it('with the valid key: a 1 MB body parsed once, by the 16 MB parser', async () => {
        const big = await postRaw(counted.baseUrl, FILE_ROUTE, fileBodyOfSize(ONE_MB).body, internalKey);
        expect(big.status).toBe(204);
        expect(parsedBy).toEqual([fileParser]);
      });

      it('another route with the key: parsed once, by the default parser', async () => {
        const big = await postRaw(counted.baseUrl, SEARCH_ROUTE, searchBodyOfSize(ONE_MB), internalKey);
        expect(big.status).toBe(413);
        expect(parsedBy).toEqual([defaultParser]);
      });
    });
  });

  describe('the scoping does not depend on the parser order', () => {
    let swapped: { app: INestApplication; baseUrl: string };

    beforeAll(async () => {
      swapped = await startApp(true);
      // Run the two JSON parsers in the other order: each parser's own type
      // check must keep the file write route and the other routes apart.
      const stack = swapped.app.getHttpAdapter().getInstance()._router.stack as StackLayer[];
      const [first, second] = jsonParserLayers(swapped.app).map((layer) => stack.indexOf(layer));
      [stack[first], stack[second]] = [stack[second], stack[first]];
    });

    afterAll(async () => {
      await swapped?.app.close();
    });

    it('a 1 MB file write is still accepted', async () => {
      const reply = await postRaw(swapped.baseUrl, FILE_ROUTE, fileBodyOfSize(ONE_MB).body, internalKey);
      expect(reply.status).toBe(204);
      expect(sessionsServiceMock.writeFileToContainer).toHaveBeenCalledTimes(1);
    });

    it('a 1 MB file write without the key still gives 413 (CM-BODY-KEY-01)', async () => {
      const reply = await postRaw(swapped.baseUrl, FILE_ROUTE, fileBodyOfSize(ONE_MB).body);
      expect(reply.status).toBe(413);
      const small = await postRaw(swapped.baseUrl, FILE_ROUTE, '{"path":"x","content":"y"}');
      expect(small.status).toBe(403);
      expect(sessionsServiceMock.writeFileToContainer).not.toHaveBeenCalled();
    });

    it('another route still gives 413 one byte over 100 KB', async () => {
      const reply = await postRaw(swapped.baseUrl, SEARCH_ROUTE, searchBodyOfSize(DEFAULT_LIMIT_BYTES + 1), internalKey);
      expect(reply.status).toBe(413);
      expect(sessionsServiceMock.searchFilesInContainer).not.toHaveBeenCalled();
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

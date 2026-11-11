import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BadRequestException, INestApplication, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as http from 'http';
import { AddressInfo } from 'net';
import { BrowserSmokeService } from '../browser-smoke/browser-smoke.service';
import { decodeStrictBase64, InternalSessionsController } from './internal-sessions.controller';
import { SessionsService } from './sessions.service';

describe('InternalSessionsController file routes', () => {
  let controller: InternalSessionsController;
  let sessionsService: any;
  let browserSmokeService: any;

  beforeEach(() => {
    sessionsService = {
      startSessionContainer: jest.fn<any>(),
      deleteFileFromContainer: jest.fn<any>(),
      searchFilesInContainer: jest.fn<any>(),
    };
    browserSmokeService = {
      run: jest.fn<any>(),
    };
    controller = new InternalSessionsController(
      sessionsService,
      browserSmokeService,
    );
  });

  it('delegates delete requests to SessionsService with session id and path', async () => {
    await controller.deleteFile('session-123', 'src/delete-test.html');

    expect(sessionsService.deleteFileFromContainer).toHaveBeenCalledWith(
      'session-123',
      'src/delete-test.html',
    );
  });

  it('rejects missing path', async () => {
    await expect(controller.deleteFile('session-123', undefined)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('delegates search requests to SessionsService with session id and query', async () => {
    const expected = {
      query: 'SPECIAL_TEST_KEYWORD',
      results: [{ path: 'src/app.ts', line: 12, preview: 'const SPECIAL_TEST_KEYWORD = true;' }],
      truncated: false,
    };
    sessionsService.searchFilesInContainer.mockImplementation(async () => expected);

    await expect(
      controller.searchFiles('session-123', 'SPECIAL_TEST_KEYWORD'),
    ).resolves.toEqual(expected);

    expect(sessionsService.searchFilesInContainer).toHaveBeenCalledWith(
      'session-123',
      'SPECIAL_TEST_KEYWORD',
    );
  });

  it('rejects missing search query', async () => {
    await expect(controller.searchFiles('session-123', undefined)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('delegates browser-smoke requests to BrowserSmokeService', async () => {
    const expected = {
      success: true,
      url: 'http://172.17.0.2:3000/',
      pageTitle: 'App',
      consoleErrors: [],
      consoleWarnings: [],
      networkErrors: [],
      visibleTextSnippet: '',
      durationMs: 500,
      truncated: false,
    };
    browserSmokeService.run.mockResolvedValue(expected);

    const result = await controller.runBrowserSmoke('session-123', '/', 60000);

    expect(browserSmokeService.run).toHaveBeenCalledWith({
      sessionId: 'session-123',
      url: '/',
      timeoutMs: 60000,
    });
    expect(result).toEqual(expected);
  });

  it('throws BadRequestException for invalid browser-smoke URL', async () => {
    browserSmokeService.run.mockRejectedValue(
      new Error('Absolute URLs are not allowed; provide a relative path starting with /'),
    );

    await expect(
      controller.runBrowserSmoke('session-123', 'https://evil.com'),
    ).rejects.toThrow(BadRequestException);
  });

  describe('file read route (CM-BINARY-01)', () => {
    const BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x80, 0xc3, 0xff]);

    beforeEach(() => {
      sessionsService.readFileFromContainer = jest.fn<any>().mockResolvedValue('hello\n');
      sessionsService.readFileBufferFromContainer = jest.fn<any>().mockResolvedValue(BYTES);
    });

    it('without encoding keeps the text read and exactly { path, content }', async () => {
      const result = await controller.readFile('session-123', 'README.md');

      expect(result).toStrictEqual({ path: 'README.md', content: 'hello\n' });
      expect(Object.keys(result)).toEqual(['path', 'content']);
      expect(sessionsService.readFileFromContainer).toHaveBeenCalledWith('session-123', 'README.md');
      expect(sessionsService.readFileBufferFromContainer).not.toHaveBeenCalled();
    });

    it('with encoding=base64 reads bytes and returns them as base64 with the encoding named', async () => {
      const result = await controller.readFile('session-123', 'img/logo.png', 'base64');

      expect(result).toStrictEqual({
        path: 'img/logo.png',
        content: BYTES.toString('base64'),
        encoding: 'base64',
      });
      expect(Buffer.from(result.content, 'base64').equals(BYTES)).toBe(true);
      expect(sessionsService.readFileBufferFromContainer).toHaveBeenCalledWith(
        'session-123',
        'img/logo.png',
      );
      expect(sessionsService.readFileFromContainer).not.toHaveBeenCalled();
    });

    it.each([['utf8'], ['BASE64'], ['hex'], [''], [['base64', 'base64']], [{ a: 'b' }]])(
      'refuses encoding %j with 400 before any read',
      async (encoding) => {
        await expect(controller.readFile('session-123', 'a.png', encoding)).rejects.toThrow(
          BadRequestException,
        );
        expect(sessionsService.readFileFromContainer).not.toHaveBeenCalled();
        expect(sessionsService.readFileBufferFromContainer).not.toHaveBeenCalled();
      },
    );

    it('still refuses a missing path first, with or without encoding', async () => {
      await expect(controller.readFile('session-123', undefined)).rejects.toThrow(
        'Query parameter "path" is required',
      );
      await expect(controller.readFile('session-123', undefined, 'base64')).rejects.toThrow(
        'Query parameter "path" is required',
      );
      expect(sessionsService.readFileBufferFromContainer).not.toHaveBeenCalled();
    });

    it('passes a read error through on the base64 path', async () => {
      const failure = new Error('Failed to read file from container for session session-123: nope');
      sessionsService.readFileBufferFromContainer.mockRejectedValue(failure);

      await expect(controller.readFile('session-123', 'a.png', 'base64')).rejects.toBe(failure);
    });
  });

  describe('file write route (SNAPSHOT-BINARY-01)', () => {
    const BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00, 0xff, 0xfe, 0x80, 0x0a]);

    beforeEach(() => {
      sessionsService.writeFileToContainer = jest.fn<any>().mockResolvedValue(undefined);
    });

    it('without encoding writes the text content unchanged, as before', async () => {
      await expect(controller.writeFile('session-123', 'README.md', 'h\u00e9llo\n')).resolves.toBeUndefined();

      expect(sessionsService.writeFileToContainer).toHaveBeenCalledWith('session-123', 'README.md', 'h\u00e9llo\n');
    });

    it('with encoding base64 decodes and writes the exact bytes', async () => {
      await controller.writeFile('session-123', 'img/red.png', BYTES.toString('base64'), 'base64');

      expect(sessionsService.writeFileToContainer).toHaveBeenCalledTimes(1);
      const [sessionId, filePath, written] = sessionsService.writeFileToContainer.mock.calls[0];
      expect(sessionId).toBe('session-123');
      expect(filePath).toBe('img/red.png');
      expect(Buffer.isBuffer(written)).toBe(true);
      expect((written as Buffer).equals(BYTES)).toBe(true);
    });

    it('with encoding base64 writes an empty file for empty content', async () => {
      await controller.writeFile('session-123', 'empty.bin', '', 'base64');

      const written = sessionsService.writeFileToContainer.mock.calls[0][2] as Buffer;
      expect(Buffer.isBuffer(written)).toBe(true);
      expect(written.length).toBe(0);
    });

    it.each([['utf8'], ['BASE64'], ['hex'], [''], [null], [['base64']], [{ a: 'b' }], [1]])(
      'refuses encoding %j with 400 before any write',
      async (encoding) => {
        await expect(
          controller.writeFile('session-123', 'a.png', BYTES.toString('base64'), encoding),
        ).rejects.toThrow('Request body field "encoding" must be "base64" when given');
        expect(sessionsService.writeFileToContainer).not.toHaveBeenCalled();
      },
    );

    it.each([['not base64!'], ['QUJ'], ['QUJ='], ['QU=J'], ['QUJD\n'], ['Q U J D'], ['QUJDRA']])(
      'refuses invalid base64 %j with 400 before any write',
      async (content) => {
        await expect(controller.writeFile('session-123', 'a.png', content, 'base64')).rejects.toThrow(
          'Request body field "content" must be valid base64',
        );
        expect(sessionsService.writeFileToContainer).not.toHaveBeenCalled();
      },
    );

    it('refuses non-string content with encoding base64', async () => {
      await expect(
        controller.writeFile('session-123', 'a.png', 1234 as unknown as string, 'base64'),
      ).rejects.toThrow(BadRequestException);
      expect(sessionsService.writeFileToContainer).not.toHaveBeenCalled();
    });

    it('still refuses a missing path or content first', async () => {
      await expect(controller.writeFile('session-123', undefined, 'QUJD', 'base64')).rejects.toThrow(
        'Request body field "path" is required',
      );
      await expect(controller.writeFile('session-123', 'a.png', undefined, 'base64')).rejects.toThrow(
        'Request body field "content" is required',
      );
      expect(sessionsService.writeFileToContainer).not.toHaveBeenCalled();
    });

    it('passes a write error (including a path refusal) through on the base64 path', async () => {
      const refusal = new BadRequestException('Path traversal not allowed');
      sessionsService.writeFileToContainer.mockRejectedValue(refusal);

      await expect(
        controller.writeFile('session-123', '../etc/passwd', BYTES.toString('base64'), 'base64'),
      ).rejects.toBe(refusal);
    });

    it('decodeStrictBase64 accepts only canonical padded base64', () => {
      expect(decodeStrictBase64('')?.length).toBe(0);
      expect(decodeStrictBase64('AA==')?.equals(Buffer.from([0]))).toBe(true);
      expect(decodeStrictBase64('/w==')?.equals(Buffer.from([0xff]))).toBe(true);
      expect(decodeStrictBase64('AB==')).toBeNull();
      expect(decodeStrictBase64('AA')).toBeNull();
      expect(decodeStrictBase64('AA-_')).toBeNull();
      expect(decodeStrictBase64(undefined)).toBeNull();
      expect(decodeStrictBase64(Buffer.from('AA=='))).toBeNull();
    });
  });

  describe('internal start route (AGENT-HARNESS-05B5A)', () => {
    it('delegates with browserCapable true', async () => {
      const result = await controller.startContainer('session-123', 'user-1', true);

      expect(sessionsService.startSessionContainer).toHaveBeenCalledWith(
        'session-123',
        'user-1',
        { browserCapable: true },
      );
      expect(result).toEqual({ message: 'Session container started successfully' });
    });

    it('delegates without browserCapable when omitted', async () => {
      await controller.startContainer('session-123', 'user-1', undefined);

      expect(sessionsService.startSessionContainer).toHaveBeenCalledWith(
        'session-123',
        'user-1',
        undefined,
      );
    });

    it('delegates without browserCapable when false', async () => {
      await controller.startContainer('session-123', 'user-1', false);

      expect(sessionsService.startSessionContainer).toHaveBeenCalledWith(
        'session-123',
        'user-1',
        undefined,
      );
    });
  });
});

/**
 * CM-BINARY-01: GET /api/internal/sessions/:id/files over real HTTP, with the
 * controller's own guard and SessionIdPipe. Only SessionsService is a fake.
 */
describe('GET /api/internal/sessions/:id/files over HTTP (CM-BINARY-01)', () => {
  const internalKey = 'cm-binary-01-files-key';
  const originalKey = process.env.INTERNAL_SERVICE_KEY;
  const BYTES = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from(Array.from({ length: 256 }, (_, index) => index)),
  ]);
  const sessionsService = {
    readFileFromContainer: jest.fn<any>(),
    readFileBufferFromContainer: jest.fn<any>(),
  };
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    process.env.INTERNAL_SERVICE_KEY = internalKey;

    @Module({
      controllers: [InternalSessionsController],
      providers: [
        { provide: SessionsService, useValue: sessionsService },
        { provide: BrowserSmokeService, useValue: { run: jest.fn() } },
      ],
    })
    class InternalFilesTestModule {}

    app = await NestFactory.create(InternalFilesTestModule, { logger: false });
    app.setGlobalPrefix('api');
    await app.listen(0, '127.0.0.1');
    baseUrl = `http://127.0.0.1:${((app.getHttpServer() as http.Server).address() as AddressInfo).port}`;
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
    sessionsService.readFileFromContainer.mockReset().mockResolvedValue('héllo\n');
    sessionsService.readFileBufferFromContainer.mockReset().mockResolvedValue(BYTES);
  });

  async function get(query: string, headers: Record<string, string> = { 'x-internal-service-key': internalKey }, id = 's1') {
    const response = await fetch(`${baseUrl}/api/internal/sessions/${id}/files${query}`, {
      headers,
      signal: AbortSignal.timeout(5000),
    });
    return { status: response.status, text: await response.text() };
  }

  it('default response is byte-identical to the text body it has always been', async () => {
    const reply = await get('?path=README.md');

    expect(reply.status).toBe(200);
    expect(reply.text).toBe(JSON.stringify({ path: 'README.md', content: 'héllo\n' }));
    expect(sessionsService.readFileFromContainer).toHaveBeenCalledWith('s1', 'README.md');
    expect(sessionsService.readFileBufferFromContainer).not.toHaveBeenCalled();
  });

  it('encoding=base64 returns the exact bytes as base64', async () => {
    const reply = await get('?path=img%2Flogo.png&encoding=base64');

    expect(reply.status).toBe(200);
    const body = JSON.parse(reply.text);
    expect(body).toEqual({ path: 'img/logo.png', content: BYTES.toString('base64'), encoding: 'base64' });
    expect(Buffer.from(body.content, 'base64').equals(BYTES)).toBe(true);
    expect(sessionsService.readFileFromContainer).not.toHaveBeenCalled();
  });

  it.each(['?path=a.png&encoding=utf8', '?path=a.png&encoding=', '?path=a.png&encoding=base64&encoding=base64'])(
    'refuses %s with 400',
    async (query) => {
      const reply = await get(query);

      expect(reply.status).toBe(400);
      expect(sessionsService.readFileFromContainer).not.toHaveBeenCalled();
      expect(sessionsService.readFileBufferFromContainer).not.toHaveBeenCalled();
    },
  );

  it.each([[{}], [{ 'x-internal-service-key': 'wrong' }]])(
    'keeps the guard: 403 without the right key, also with encoding=base64 (%j)',
    async (headers) => {
      const reply = await get('?path=a.png&encoding=base64', headers as Record<string, string>);

      expect(reply.status).toBe(403);
      expect(sessionsService.readFileBufferFromContainer).not.toHaveBeenCalled();
    },
  );

  it('keeps the SessionIdPipe: a session id with an encoded slash is 400 before any read', async () => {
    const reply = await get('?path=a.png&encoding=base64', undefined, 'a%2F..');

    expect(reply.status).toBe(400);
    expect(reply.text).toContain('Invalid session id');
    expect(sessionsService.readFileBufferFromContainer).not.toHaveBeenCalled();
  });
});

/**
 * SNAPSHOT-BINARY-01: POST /api/internal/sessions/:id/files over real HTTP,
 * with the controller's own guard and SessionIdPipe. Only SessionsService is
 * a fake.
 */
describe('POST /api/internal/sessions/:id/files over HTTP (SNAPSHOT-BINARY-01)', () => {
  const internalKey = 'snapshot-binary-01-files-key';
  const originalKey = process.env.INTERNAL_SERVICE_KEY;
  const BYTES = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]),
    Buffer.from(Array.from({ length: 256 }, (_, index) => index)),
  ]);
  const sessionsService = {
    writeFileToContainer: jest.fn<any>(),
  };
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    process.env.INTERNAL_SERVICE_KEY = internalKey;

    @Module({
      controllers: [InternalSessionsController],
      providers: [
        { provide: SessionsService, useValue: sessionsService },
        { provide: BrowserSmokeService, useValue: { run: jest.fn() } },
      ],
    })
    class InternalWriteTestModule {}

    app = await NestFactory.create(InternalWriteTestModule, { logger: false });
    app.setGlobalPrefix('api');
    await app.listen(0, '127.0.0.1');
    baseUrl = `http://127.0.0.1:${((app.getHttpServer() as http.Server).address() as AddressInfo).port}`;
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
    sessionsService.writeFileToContainer.mockReset().mockResolvedValue(undefined);
  });

  async function post(
    body: unknown,
    headers: Record<string, string> = { 'x-internal-service-key': internalKey },
    id = 's1',
  ) {
    const response = await fetch(`${baseUrl}/api/internal/sessions/${id}/files`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    return { status: response.status, text: await response.text() };
  }

  it('a text write without encoding is 204 and passes the same string', async () => {
    const reply = await post({ path: 'README.md', content: 'h\u00e9llo\n' });

    expect(reply.status).toBe(204);
    expect(sessionsService.writeFileToContainer).toHaveBeenCalledWith('s1', 'README.md', 'h\u00e9llo\n');
  });

  it('encoding base64 writes the exact bytes (NUL and 0xFF included)', async () => {
    const reply = await post({ path: 'img/red.png', content: BYTES.toString('base64'), encoding: 'base64' });

    expect(reply.status).toBe(204);
    const written = sessionsService.writeFileToContainer.mock.calls[0][2] as Buffer;
    expect(Buffer.isBuffer(written)).toBe(true);
    expect(written.equals(BYTES)).toBe(true);
  });

  it.each([
    [{ path: 'a.png', content: 'QUJD', encoding: 'utf8' }],
    [{ path: 'a.png', content: 'QUJD', encoding: null }],
    [{ path: 'a.png', content: 'QUJD', encoding: ['base64'] }],
    [{ path: 'a.png', content: 'not base64!', encoding: 'base64' }],
    [{ path: 'a.png', content: 'QUJ', encoding: 'base64' }],
  ])('refuses %j with 400 before any write', async (body) => {
    const reply = await post(body);

    expect(reply.status).toBe(400);
    expect(sessionsService.writeFileToContainer).not.toHaveBeenCalled();
  });

  it.each([[{}], [{ 'x-internal-service-key': 'wrong' }]])(
    'keeps the guard: 403 without the right key, also with encoding base64 (%j)',
    async (headers) => {
      const reply = await post(
        { path: 'a.png', content: BYTES.toString('base64'), encoding: 'base64' },
        headers as Record<string, string>,
      );

      expect(reply.status).toBe(403);
      expect(sessionsService.writeFileToContainer).not.toHaveBeenCalled();
    },
  );

  it('keeps the SessionIdPipe: a session id with an encoded slash is 400 before any write', async () => {
    const reply = await post(
      { path: 'a.png', content: BYTES.toString('base64'), encoding: 'base64' },
      undefined,
      'a%2F..',
    );

    expect(reply.status).toBe(400);
    expect(reply.text).toContain('Invalid session id');
    expect(sessionsService.writeFileToContainer).not.toHaveBeenCalled();
  });
});

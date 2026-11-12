import { INestApplication } from '@nestjs/common';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common/enums/request-method.enum';
import { Test, TestingModule } from '@nestjs/testing';
import axios from 'axios';
import request from 'supertest';
import { SessionCookieGuard } from '../../auth/session-cookie.guard';
import { PreviewController, withPreviewOrigin } from '../preview.controller';
import { PreviewOwnershipGuard } from '../preview-ownership.guard';

jest.mock('axios');

describe('PreviewController endpoint contract', () => {
  let app: INestApplication;
  const mockedAxios = axios as jest.MockedFunction<typeof axios>;
  const originalKey = process.env.INTERNAL_SERVICE_KEY;
  const contractKey = 'cm-auth-01-contract-key';

  beforeEach(async () => {
    // CM-AUTH-01 (D4): read by PreviewController at construction.
    process.env.INTERNAL_SERVICE_KEY = contractKey;
    mockedAxios.mockResolvedValue({
      status: 200,
      headers: {},
      data: { ok: true },
      statusText: 'OK',
      config: {},
    } as never);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PreviewController],
    })
      .overrideGuard(SessionCookieGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PreviewOwnershipGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
    if (originalKey === undefined) {
      delete process.env.INTERNAL_SERVICE_KEY;
    } else {
      process.env.INTERNAL_SERVICE_KEY = originalKey;
    }
  });

  it('keeps @Controller("preview") + @All("*") contract', () => {
    expect(Reflect.getMetadata(PATH_METADATA, PreviewController)).toBe('preview');

    const handler = PreviewController.prototype.proxyToContainerManager;
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe('*');
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(RequestMethod.ALL);
  });

  it('keeps SessionCookieGuard + PreviewOwnershipGuard at controller level', () => {
    const guards = Reflect.getMetadata('__guards__', PreviewController) || [];

    expect(guards).toContain(SessionCookieGuard);
    expect(guards).toContain(PreviewOwnershipGuard);
  });

  it('matches GET /api/preview/:sessionId/status', async () => {
    await request(app.getHttpServer())
      .get('/api/preview/session-123/status')
      .expect(200);

    expect(mockedAxios).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        url: expect.stringContaining('/api/preview/session-123/status'),
      }),
    );
  });

  it('matches POST /api/preview/:sessionId/start', async () => {
    await request(app.getHttpServer())
      .post('/api/preview/session-456/start')
      .send({ trigger: 'manual' })
      .expect(200);

    expect(mockedAxios).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: expect.stringContaining('/api/preview/session-456/start'),
      }),
    );
  });

  it('matches GET /api/preview/:sessionId/proxy*', async () => {
    await request(app.getHttpServer())
      .get('/api/preview/session-789/proxy/assets/main.js')
      .expect(200);

    expect(mockedAxios).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        url: expect.stringContaining(
          '/api/preview/session-789/proxy/assets/main.js',
        ),
      }),
    );
  });

  it('declares an explicit POST :sessionId/stop handler before the catch-all', () => {
    const stopHandler = PreviewController.prototype.stopPreview;
    expect(Reflect.getMetadata(PATH_METADATA, stopHandler)).toBe(':sessionId/stop');
    expect(Reflect.getMetadata(METHOD_METADATA, stopHandler)).toBe(
      RequestMethod.POST,
    );

    const catchAll = PreviewController.prototype.proxyToContainerManager;
    expect(Reflect.getMetadata(PATH_METADATA, catchAll)).toBe('*');
    expect(Reflect.getMetadata(METHOD_METADATA, catchAll)).toBe(
      RequestMethod.ALL,
    );

    const deleteStopHandlers = Object.getOwnPropertyNames(
      PreviewController.prototype,
    )
      .map((name) => PreviewController.prototype[name])
      .filter((fn) => {
        const path = Reflect.getMetadata(PATH_METADATA, fn);
        const method = Reflect.getMetadata(METHOD_METADATA, fn);
        return path === ':sessionId/stop' && method === RequestMethod.DELETE;
      });
    expect(deleteStopHandlers).toHaveLength(0);
  });

  it('returns HTTP 200 JSON when POST /api/preview/:sessionId/stop succeeds', async () => {
    mockedAxios.mockResolvedValue({
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'content-length': '0',
        'transfer-encoding': 'chunked',
      },
      data: { success: true, message: 'Preview stopped successfully' },
      statusText: 'OK',
      config: {},
    } as never);

    const response = await request(app.getHttpServer())
      .post('/api/preview/session-stop-1/stop')
      .expect(200)
      .expect('Content-Type', /application\/json/);

    expect(response.headers['content-type']).not.toMatch(/text\/html/);
    expect(response.body).toEqual({
      success: true,
      message: 'Preview stopped successfully',
    });

    expect(mockedAxios).toHaveBeenCalledTimes(1);
    expect(mockedAxios).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: expect.stringContaining('/api/preview/session-stop-1/stop'),
        responseType: 'json',
      }),
    );

    const axiosConfig = mockedAxios.mock.calls[0][0] as {
      responseType?: string;
      data?: unknown;
      headers?: unknown;
    };
    expect(axiosConfig.responseType).not.toBe('stream');
    expect(axiosConfig.data).toBeUndefined();
    // CM-AUTH-01 (D4): stop sends only the server-side internal key.
    expect(axiosConfig.headers).toEqual({ 'X-Internal-Service-Key': contractKey });
  });

  it('returns HTTP 200 JSON for no active preview / idempotent CM success', async () => {
    mockedAxios.mockResolvedValue({
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
      },
      data: {
        success: true,
        message: 'No active preview for this session',
      },
      statusText: 'OK',
      config: {},
    } as never);

    const response = await request(app.getHttpServer())
      .post('/api/preview/session-stop-idle/stop')
      .expect(200)
      .expect('Content-Type', /application\/json/);

    expect(response.headers['content-type']).not.toMatch(/text\/html/);
    expect(response.status).not.toBe(404);
    expect(response.body).toEqual({
      success: true,
      message: 'No active preview for this session',
    });
  });

  describe('PREVIEW-PICKER-01: previewOrigin on the status answer', () => {
    const savedPreviewBaseUrl = process.env.PREVIEW_BASE_URL;
    const savedAppBaseUrl = process.env.APP_BASE_URL;

    afterEach(() => {
      if (savedPreviewBaseUrl === undefined) delete process.env.PREVIEW_BASE_URL;
      else process.env.PREVIEW_BASE_URL = savedPreviewBaseUrl;
      if (savedAppBaseUrl === undefined) delete process.env.APP_BASE_URL;
      else process.env.APP_BASE_URL = savedAppBaseUrl;
    });

    it('is null when no preview host is configured', async () => {
      delete process.env.PREVIEW_BASE_URL;
      const response = await request(app.getHttpServer()).get('/api/preview/session-123/status').expect(200);
      expect(response.body).toEqual({ ok: true, previewOrigin: null });
    });

    it('is the PREVIEW_BASE_URL origin when the preview host is configured', async () => {
      process.env.PREVIEW_BASE_URL = 'https://preview.staging.ainow.biz/';
      process.env.APP_BASE_URL = 'https://staging.ainow.biz';
      mockedAxios.mockResolvedValue({
        status: 200,
        headers: { 'content-type': 'application/json' },
        data: { running: true, port: 3000, previewOrigin: 'https://evil.example' },
        statusText: 'OK',
        config: {},
      } as never);
      const response = await request(app.getHttpServer()).get('/api/preview/session-123/status').expect(200);
      // The gateway's value replaces any upstream field of that name.
      expect(response.body).toEqual({ running: true, port: 3000, previewOrigin: 'https://preview.staging.ainow.biz' });
    });

    it('leaves start and stop answers unchanged', async () => {
      process.env.PREVIEW_BASE_URL = 'https://preview.staging.ainow.biz';
      const start = await request(app.getHttpServer()).post('/api/preview/session-1/start').expect(200);
      expect(start.body).toEqual({ ok: true });
      const stop = await request(app.getHttpServer()).delete('/api/preview/session-1/stop').expect(200);
      expect(stop.body).toEqual({ ok: true });
      const stopPost = await request(app.getHttpServer()).post('/api/preview/session-1/stop').expect(200);
      expect(stopPost.body).toEqual({ ok: true });
    });

    it('leaves an error status answer unchanged', async () => {
      mockedAxios.mockResolvedValue({
        status: 500,
        headers: {},
        data: { error: 'boom' },
        statusText: 'Error',
        config: {},
      } as never);
      const response = await request(app.getHttpServer()).get('/api/preview/session-123/status').expect(500);
      expect(response.body).toEqual({ error: 'boom' });
    });

    it('withPreviewOrigin changes only a 200 JSON object', () => {
      expect(withPreviewOrigin(200, { running: false }, null)).toEqual({ running: false, previewOrigin: null });
      expect(withPreviewOrigin(200, { a: 1 }, 'https://p.example')).toEqual({ a: 1, previewOrigin: 'https://p.example' });
      expect(withPreviewOrigin(404, { a: 1 }, 'https://p.example')).toEqual({ a: 1 });
      expect(withPreviewOrigin(200, [1, 2], 'https://p.example')).toEqual([1, 2]);
      expect(withPreviewOrigin(200, 'text', 'https://p.example')).toBe('text');
      expect(withPreviewOrigin(200, null, 'https://p.example')).toBeNull();
      const buffer = Buffer.from('x');
      expect(withPreviewOrigin(200, buffer, 'https://p.example')).toBe(buffer);
    });
  });

  it('PREVIEW-PICKER-01: the reserved proxy/__aisb/ prefix is 404 and never reaches container-manager', async () => {
    for (const path of [
      '/api/preview/session-789/proxy/__aisb/bridge.js',
      '/api/preview/session-789/proxy/__aisb/other',
      '/api/preview/session-789/proxy/%5F%5Faisb/bridge.js',
    ]) {
      await request(app.getHttpServer()).get(path).expect(404);
    }
    expect(mockedAxios).not.toHaveBeenCalled();
  });

  it('forwards DELETE /api/preview/:sessionId/stop through the catch-all', async () => {
    await request(app.getHttpServer())
      .delete('/api/preview/session-del-1/stop')
      .expect(200);

    expect(mockedAxios).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'DELETE',
        url: expect.stringContaining('/api/preview/session-del-1/stop'),
      }),
    );
    expect(mockedAxios).not.toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: expect.stringContaining('/api/preview/session-del-1/stop'),
      }),
    );
  });
});

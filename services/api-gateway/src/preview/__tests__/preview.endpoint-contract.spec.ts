import { INestApplication } from '@nestjs/common';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common/enums/request-method.enum';
import { Test, TestingModule } from '@nestjs/testing';
import axios from 'axios';
import request from 'supertest';
import { SessionCookieGuard } from '../../auth/session-cookie.guard';
import { PreviewController } from '../preview.controller';
import { PreviewOwnershipGuard } from '../preview-ownership.guard';

jest.mock('axios');

describe('PreviewController endpoint contract', () => {
  let app: INestApplication;
  const mockedAxios = axios as jest.MockedFunction<typeof axios>;

  beforeEach(async () => {
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
    expect(axiosConfig.headers).toBeUndefined();
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

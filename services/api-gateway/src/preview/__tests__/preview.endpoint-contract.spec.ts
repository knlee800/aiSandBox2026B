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
});

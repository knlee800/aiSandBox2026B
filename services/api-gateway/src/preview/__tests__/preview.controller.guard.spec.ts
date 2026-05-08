import request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PreviewController } from '../preview.controller';
import { SessionCookieGuard } from '../../auth/session-cookie.guard';

describe('PreviewController SessionCookieGuard', () => {
  it('applies SessionCookieGuard at controller level', () => {
    const guards = Reflect.getMetadata('__guards__', PreviewController) || [];
    expect(guards).toContain(SessionCookieGuard);
  });

  it('compiles testing module when SessionCookieGuard is overridden to allow', async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PreviewController],
    })
      .overrideGuard(SessionCookieGuard)
      .useValue({ canActivate: () => true })
      .compile();

    expect(module.get(PreviewController)).toBeDefined();
  });

  it('blocks request when SessionCookieGuard is overridden to deny', async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PreviewController],
    })
      .overrideGuard(SessionCookieGuard)
      .useValue({ canActivate: () => false })
      .compile();

    const app: INestApplication = module.createNestApplication();
    await app.init();

    const response = await request(app.getHttpServer()).get('/preview/test-session/status');
    expect(response.status).toBe(403);

    await app.close();
  });
});

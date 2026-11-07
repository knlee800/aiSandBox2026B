import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AuthService } from '../auth/auth.service';
import { SessionCookieGuard } from '../auth/session-cookie.guard';
import { SystemAgentsController } from './system-agents.controller';
import { systemAgentVersion } from './system-agent-registry';

describe('SystemAgentsController', () => {
  let app: INestApplication | null = null;
  const validateSessionToken = jest.fn();

  afterEach(async () => {
    if (app) {
      await app.close();
      app = null;
    }
    validateSessionToken.mockReset();
  });

  async function boot(overrideGuard: boolean): Promise<void> {
    let builder = Test.createTestingModule({
      controllers: [SystemAgentsController],
      providers: [{ provide: AuthService, useValue: { validateSessionToken } }],
    });
    if (overrideGuard) {
      builder = builder.overrideGuard(SessionCookieGuard).useValue({
        canActivate: () => true,
      });
    }
    const module: TestingModule = await builder.compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  }

  it('uses SessionCookieGuard', () => {
    const guards = Reflect.getMetadata('__guards__', SystemAgentsController);
    expect(guards).toContain(SessionCookieGuard);
  });

  it('returns 401 when the session cookie is missing and does not read the token', async () => {
    await boot(false);
    await request(app!.getHttpServer()).get('/api/system-agents').expect(401);
    expect(validateSessionToken).not.toHaveBeenCalled();
  });

  it('returns 401 for a bearer token without a session cookie', async () => {
    await boot(false);
    await request(app!.getHttpServer())
      .get('/api/system-agents')
      .set('Authorization', 'Bearer not-a-session')
      .expect(401);
    expect(validateSessionToken).not.toHaveBeenCalled();
  });

  it('returns the four public agents and a private no-store cache header', async () => {
    await boot(true);
    const response = await request(app!.getHttpServer()).get('/api/system-agents').expect(200);
    const agents = response.body.agents as Array<{ id: string; version: string; status: string }>;
    expect(agents.map((agent) => agent.id)).toEqual([
      'builder',
      'chief-of-staff',
      'product-strategy',
      'technology-advisor',
    ]);
    expect(agents.find((agent) => agent.id === 'product-strategy')?.status).toBe('active');
    expect(agents.find((agent) => agent.id === 'technology-advisor')?.status).toBe('active');
    expect(agents.map((agent) => agent.id)).not.toContain('advisors-lead');
    for (const agent of agents) {
      expect(agent.version).toBe(systemAgentVersion(agent.id));
      expect(agent.version).toMatch(/^[0-9a-f]{64}$/);
    }
    expect(response.headers['cache-control']).toBe('private, no-store');
    const serialized = JSON.stringify(response.body);
    for (const secret of [
      'instructions',
      'toolProfile',
      'modelChoice',
      'teamRole',
      'modelProfile',
      'toolPermissions',
      "You are the owner's Chief of Staff",
      'ask writer',
      'write_file',
      'search_knowledge',
      'You reply to the Chief of Staff',
      'advisors-lead',
    ]) {
      expect(serialized).not.toContain(secret);
    }
  });

  it('returns 404 for POST /api/system-agents', async () => {
    await boot(true);
    await request(app!.getHttpServer()).post('/api/system-agents').send({}).expect(404);
  });
});

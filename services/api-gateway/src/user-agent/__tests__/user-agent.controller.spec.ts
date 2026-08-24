import { UserAgentController } from '../user-agent.controller';
import { UserAgentService } from '../user-agent.service';
import { SessionCookieGuard } from '../../auth/session-cookie.guard';
import {
  INestApplication,
  NotFoundException,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

describe('UserAgentController', () => {
  let controller: UserAgentController;
  let service: jest.Mocked<UserAgentService>;
  let app: INestApplication | null = null;

  const mockUserA = {
    userId: 'user-a-uuid-111',
    email: 'alice@example.com',
    role: 'user',
    plan: 'free',
  };

  const mockUserB = {
    userId: 'user-b-uuid-222',
    email: 'bob@example.com',
    role: 'user',
    plan: 'free',
  };

  const mockReqA = { user: mockUserA } as any;

  const now = new Date('2026-07-20T10:00:00.000Z');

  const makeAgent = (overrides: Record<string, any> = {}) => ({
    id: 'agent-uuid-001',
    userId: mockUserA.userId,
    name: 'Research Assistant',
    role: 'Gathers and synthesizes information',
    description: 'A specialized agent for research tasks.',
    status: 'active',
    initials: 'RA',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    user: undefined as any,
    ...overrides,
  });

  beforeEach(() => {
    service = {
      create: jest.fn(),
      listByUserId: jest.fn(),
      findOneByIdAndUserId: jest.fn(),
      deleteByIdAndUserId: jest.fn(),
    } as any;

    controller = new UserAgentController(service);
  });

  afterEach(async () => {
    if (app) {
      await app.close();
      app = null;
    }
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Guard metadata
  // ---------------------------------------------------------------------------

  describe('guard metadata', () => {
    it('should use SessionCookieGuard at controller level', () => {
      const guards = Reflect.getMetadata('__guards__', UserAgentController);
      expect(guards).toBeDefined();
      expect(guards).toContain(SessionCookieGuard);
    });

    it('should NOT use ApiKeyAuthGuard or InternalServiceAuthGuard', () => {
      const guards = Reflect.getMetadata('__guards__', UserAgentController);
      const guardNames = (guards || []).map(
        (g: any) => g.name || g.constructor?.name,
      );
      expect(guardNames).not.toContain('ApiKeyAuthGuard');
      expect(guardNames).not.toContain('InternalServiceAuthGuard');
      expect(guardNames).not.toContain('PublicApiKeyGuard');
    });
  });

  // ---------------------------------------------------------------------------
  // POST /api/agents — Create
  // ---------------------------------------------------------------------------

  describe('POST /api/agents — Create', () => {
    it('should create agent with valid input and return response shape', async () => {
      const created = makeAgent();
      service.create.mockResolvedValue(created);

      const result = await controller.create(mockReqA, {
        name: 'Research Assistant',
        role: 'Gathers and synthesizes information',
        description: 'A specialized agent for research tasks.',
      });

      expect(service.create).toHaveBeenCalledWith(mockUserA.userId, {
        name: 'Research Assistant',
        role: 'Gathers and synthesizes information',
        description: 'A specialized agent for research tasks.',
      });

      expect(result).toEqual({
        id: 'agent-uuid-001',
        name: 'Research Assistant',
        role: 'Gathers and synthesizes information',
        description: 'A specialized agent for research tasks.',
        status: 'active',
        initials: 'RA',
        createdAt: '2026-07-20T10:00:00.000Z',
        updatedAt: '2026-07-20T10:00:00.000Z',
      });
    });

    it('should set userId from session, NOT from request body', async () => {
      service.create.mockResolvedValue(makeAgent());

      await controller.create(mockReqA, {
        name: 'Test Agent',
        role: 'Test role',
        description: 'Test description',
      });

      expect(service.create).toHaveBeenCalledWith(
        mockUserA.userId,
        expect.objectContaining({ name: 'Test Agent' }),
      );
    });

    it('should always use session userId regardless of body content', async () => {
      service.create.mockResolvedValue(makeAgent());

      const bodyWithUserId = {
        name: 'Test Agent',
        role: 'Test role',
        description: 'Test description',
        userId: 'attacker-user-id',
      } as any;

      await controller.create(mockReqA, bodyWithUserId);

      expect(service.create).toHaveBeenCalledWith(
        mockUserA.userId,
        expect.anything(),
      );
      expect(service.create.mock.calls[0][0]).toBe(mockUserA.userId);
      expect(service.create.mock.calls[0][0]).not.toBe('attacker-user-id');
    });

    it('should use client-supplied initials when provided', async () => {
      service.create.mockResolvedValue(makeAgent({ initials: 'XY' }));

      await controller.create(mockReqA, {
        name: 'Test Agent',
        role: 'Test role',
        description: 'Test description',
        initials: 'XY',
      });

      expect(service.create).toHaveBeenCalledWith(
        mockUserA.userId,
        expect.objectContaining({ initials: 'XY' }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // GET /api/agents — List
  // ---------------------------------------------------------------------------

  describe('GET /api/agents — List', () => {
    it('should return empty array when user has no agents', async () => {
      service.listByUserId.mockResolvedValue([]);

      const result = await controller.list(mockReqA);

      expect(service.listByUserId).toHaveBeenCalledWith(mockUserA.userId);
      expect(result).toEqual({ agents: [] });
    });

    it('should return only agents belonging to authenticated user', async () => {
      const agents = [makeAgent(), makeAgent({ id: 'agent-uuid-002', name: 'Writer' })];
      service.listByUserId.mockResolvedValue(agents);

      const result = await controller.list(mockReqA);

      expect(service.listByUserId).toHaveBeenCalledWith(mockUserA.userId);
      expect(result.agents).toHaveLength(2);
    });

    it('should return agents with correct response shape (no userId, no deletedAt)', async () => {
      service.listByUserId.mockResolvedValue([makeAgent()]);

      const result = await controller.list(mockReqA);

      const agent = result.agents[0];
      expect(agent).toHaveProperty('id');
      expect(agent).toHaveProperty('name');
      expect(agent).toHaveProperty('role');
      expect(agent).toHaveProperty('description');
      expect(agent).toHaveProperty('status');
      expect(agent).toHaveProperty('initials');
      expect(agent).toHaveProperty('createdAt');
      expect(agent).toHaveProperty('updatedAt');
      expect(agent).not.toHaveProperty('userId');
      expect(agent).not.toHaveProperty('deletedAt');
      expect(agent).not.toHaveProperty('user');
    });
  });

  // ---------------------------------------------------------------------------
  // GET /api/agents/:id — Get One
  // ---------------------------------------------------------------------------

  describe('GET /api/agents/:id — Get One', () => {
    it('should return agent when it exists and belongs to user', async () => {
      const agent = makeAgent();
      service.findOneByIdAndUserId.mockResolvedValue(agent);

      const result = await controller.getOne(mockReqA, 'agent-uuid-001');

      expect(service.findOneByIdAndUserId).toHaveBeenCalledWith(
        'agent-uuid-001',
        mockUserA.userId,
      );
      expect(result.id).toBe('agent-uuid-001');
      expect(result.name).toBe('Research Assistant');
    });

    it('should return 404 when agent does not exist', async () => {
      service.findOneByIdAndUserId.mockResolvedValue(null);

      await expect(
        controller.getOne(mockReqA, 'nonexistent-uuid'),
      ).rejects.toThrow('Not Found');
    });

    it('should return 404 when agent belongs to another user (NOT 403)', async () => {
      service.findOneByIdAndUserId.mockResolvedValue(null);

      const mockReqB = { user: mockUserB } as any;

      await expect(
        controller.getOne(mockReqB, 'agent-uuid-001'),
      ).rejects.toThrow('Not Found');

      expect(service.findOneByIdAndUserId).toHaveBeenCalledWith(
        'agent-uuid-001',
        mockUserB.userId,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // DELETE /api/agents/:id — Soft Delete
  // ---------------------------------------------------------------------------

  describe('DELETE /api/agents/:id — Soft Delete', () => {
    it('should delete owned agent using session userId and agent id', async () => {
      service.deleteByIdAndUserId.mockResolvedValue(undefined);

      const result = await controller.delete(mockReqA, 'agent-uuid-001');

      expect(service.deleteByIdAndUserId).toHaveBeenCalledWith(
        'agent-uuid-001',
        mockUserA.userId,
      );
      expect(result).toBeUndefined();
    });

    it('should return 404 when agent does not exist', async () => {
      service.deleteByIdAndUserId.mockRejectedValue(new NotFoundException());

      await expect(
        controller.delete(mockReqA, 'nonexistent-uuid'),
      ).rejects.toThrow('Not Found');
    });

    it('should return 404 when agent belongs to another user (NOT 403)', async () => {
      service.deleteByIdAndUserId.mockRejectedValue(new NotFoundException());

      const mockReqB = { user: mockUserB } as any;

      await expect(
        controller.delete(mockReqB, 'agent-uuid-001'),
      ).rejects.toThrow('Not Found');

      expect(service.deleteByIdAndUserId).toHaveBeenCalledWith(
        'agent-uuid-001',
        mockUserB.userId,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Cross-User Isolation (Critical Security)
  // ---------------------------------------------------------------------------

  describe('cross-user isolation', () => {
    it('User B list does not return User A agents', async () => {
      const mockReqB = { user: mockUserB } as any;
      service.listByUserId.mockResolvedValue([]);

      const result = await controller.list(mockReqB);

      expect(service.listByUserId).toHaveBeenCalledWith(mockUserB.userId);
      expect(result.agents).toEqual([]);
    });

    it('User B cannot get User A agent by ID', async () => {
      const mockReqB = { user: mockUserB } as any;
      service.findOneByIdAndUserId.mockResolvedValue(null);

      await expect(
        controller.getOne(mockReqB, 'agent-uuid-001'),
      ).rejects.toThrow('Not Found');

      expect(service.findOneByIdAndUserId).toHaveBeenCalledWith(
        'agent-uuid-001',
        mockUserB.userId,
      );
    });

    it('User B cannot delete User A agent by ID', async () => {
      const mockReqB = { user: mockUserB } as any;
      service.deleteByIdAndUserId.mockRejectedValue(new NotFoundException());

      await expect(
        controller.delete(mockReqB, 'agent-uuid-001'),
      ).rejects.toThrow('Not Found');

      expect(service.deleteByIdAndUserId).toHaveBeenCalledWith(
        'agent-uuid-001',
        mockUserB.userId,
      );
      expect(service.deleteByIdAndUserId.mock.calls[0][1]).not.toBe(
        mockUserA.userId,
      );
    });

    it('response does not contain userId or deletedAt fields', async () => {
      service.create.mockResolvedValue(makeAgent());

      const result = await controller.create(mockReqA, {
        name: 'Test',
        role: 'Test role',
        description: 'Test description',
      });

      expect(result).not.toHaveProperty('userId');
      expect(result).not.toHaveProperty('deletedAt');
      expect(result).not.toHaveProperty('user');
    });
  });

  // ---------------------------------------------------------------------------
  // HTTP contract via supertest
  // ---------------------------------------------------------------------------

  describe('HTTP contract', () => {
    const buildApp = async (options: {
      unauthenticated?: boolean;
      user?: typeof mockUserA;
    } = {}) => {
      const module: TestingModule = await Test.createTestingModule({
        controllers: [UserAgentController],
        providers: [{ provide: UserAgentService, useValue: service }],
      })
        .overrideGuard(SessionCookieGuard)
        .useValue({
          canActivate: (context: any) => {
            if (options.unauthenticated) {
              throw new UnauthorizedException('Authentication required');
            }
            const req = context.switchToHttp().getRequest();
            req.user = options.user || mockUserA;
            return true;
          },
        })
        .compile();

      app = module.createNestApplication();
      app.setGlobalPrefix('api');
      app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
      await app.init();
    };

    it('POST /api/agents returns 201 with correct shape', async () => {
      await buildApp();
      service.create.mockResolvedValue(makeAgent());

      const response = await request(app!.getHttpServer())
        .post('/api/agents')
        .send({
          name: 'Research Assistant',
          role: 'Gathers and synthesizes information',
          description: 'A specialized agent for research tasks.',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('createdAt');
      expect(response.body).not.toHaveProperty('userId');
      expect(response.body).not.toHaveProperty('deletedAt');
    });

    it('POST /api/agents returns 400 for missing name', async () => {
      await buildApp();

      await request(app!.getHttpServer())
        .post('/api/agents')
        .send({
          role: 'Some role',
          description: 'Some description',
        })
        .expect(400);
    });

    it('POST /api/agents returns 400 for name exceeding 100 chars', async () => {
      await buildApp();

      await request(app!.getHttpServer())
        .post('/api/agents')
        .send({
          name: 'A'.repeat(101),
          role: 'Some role',
          description: 'Some description',
        })
        .expect(400);
    });

    it('POST /api/agents returns 400 for missing role', async () => {
      await buildApp();

      await request(app!.getHttpServer())
        .post('/api/agents')
        .send({
          name: 'Test Agent',
          description: 'Some description',
        })
        .expect(400);
    });

    it('POST /api/agents returns 400 for missing description', async () => {
      await buildApp();

      await request(app!.getHttpServer())
        .post('/api/agents')
        .send({
          name: 'Test Agent',
          role: 'Some role',
        })
        .expect(400);
    });

    it('POST /api/agents returns 400 for invalid status value', async () => {
      await buildApp();

      await request(app!.getHttpServer())
        .post('/api/agents')
        .send({
          name: 'Test Agent',
          role: 'Some role',
          description: 'Some description',
          status: 'invalid_status',
        })
        .expect(400);
    });

    it('POST /api/agents strips userId from body (whitelist)', async () => {
      await buildApp();
      service.create.mockResolvedValue(makeAgent());

      await request(app!.getHttpServer())
        .post('/api/agents')
        .send({
          name: 'Test Agent',
          role: 'Some role',
          description: 'Some description',
          userId: 'attacker-id',
        })
        .expect(201);

      const passedDto = service.create.mock.calls[0][1];
      expect(passedDto).not.toHaveProperty('userId');
    });

    it('GET /api/agents returns 200 with agents array', async () => {
      await buildApp();
      service.listByUserId.mockResolvedValue([makeAgent()]);

      const response = await request(app!.getHttpServer())
        .get('/api/agents')
        .expect(200);

      expect(response.body).toHaveProperty('agents');
      expect(Array.isArray(response.body.agents)).toBe(true);
      expect(response.body.agents).toHaveLength(1);
    });

    it('GET /api/agents returns empty array when no agents', async () => {
      await buildApp();
      service.listByUserId.mockResolvedValue([]);

      const response = await request(app!.getHttpServer())
        .get('/api/agents')
        .expect(200);

      expect(response.body).toEqual({ agents: [] });
    });

    it('GET /api/agents/:id returns 200 when agent found', async () => {
      await buildApp();
      service.findOneByIdAndUserId.mockResolvedValue(makeAgent());

      const response = await request(app!.getHttpServer())
        .get('/api/agents/agent-uuid-001')
        .expect(200);

      expect(response.body.id).toBe('agent-uuid-001');
      expect(response.body).not.toHaveProperty('userId');
      expect(response.body).not.toHaveProperty('deletedAt');
    });

    it('GET /api/agents/:id returns 404 when agent not found', async () => {
      await buildApp();
      service.findOneByIdAndUserId.mockResolvedValue(null);

      await request(app!.getHttpServer())
        .get('/api/agents/nonexistent-uuid')
        .expect(404);
    });

    it('DELETE /api/agents/:id returns 204 with empty body for owned agent', async () => {
      await buildApp();
      service.deleteByIdAndUserId.mockResolvedValue(undefined);

      const response = await request(app!.getHttpServer())
        .delete('/api/agents/agent-uuid-001')
        .expect(204);

      expect(service.deleteByIdAndUserId).toHaveBeenCalledWith(
        'agent-uuid-001',
        mockUserA.userId,
      );
      expect(response.text).toBe('');
      expect(Object.keys(response.body)).toHaveLength(0);
      expect(response.text).not.toContain('userId');
      expect(response.text).not.toContain('deletedAt');
    });

    it('DELETE /api/agents/:id returns 404 when agent not found', async () => {
      await buildApp();
      service.deleteByIdAndUserId.mockRejectedValue(new NotFoundException());

      const response = await request(app!.getHttpServer())
        .delete('/api/agents/nonexistent-uuid')
        .expect(404);

      expect(response.status).not.toBe(403);
    });

    it('DELETE /api/agents/:id returns 404 when agent belongs to another user', async () => {
      await buildApp({ user: mockUserB });
      service.deleteByIdAndUserId.mockRejectedValue(new NotFoundException());

      const response = await request(app!.getHttpServer())
        .delete('/api/agents/agent-uuid-001')
        .expect(404);

      expect(service.deleteByIdAndUserId).toHaveBeenCalledWith(
        'agent-uuid-001',
        mockUserB.userId,
      );
      expect(response.status).toBe(404);
      expect(response.status).not.toBe(403);
    });

    it('DELETE /api/agents/:id unauthenticated request returns 401', async () => {
      await buildApp({ unauthenticated: true });

      await request(app!.getHttpServer())
        .delete('/api/agents/agent-uuid-001')
        .expect(401);

      expect(service.deleteByIdAndUserId).not.toHaveBeenCalled();
    });

    it('unauthenticated request returns 401', async () => {
      await buildApp({ unauthenticated: true });

      await request(app!.getHttpServer())
        .get('/api/agents')
        .expect(401);
    });

    it('response shape matches documented contract (no extra fields)', async () => {
      await buildApp();
      service.create.mockResolvedValue(makeAgent());

      const response = await request(app!.getHttpServer())
        .post('/api/agents')
        .send({
          name: 'Research Assistant',
          role: 'Gathers information',
          description: 'A research agent.',
        })
        .expect(201);

      const keys = Object.keys(response.body).sort();
      expect(keys).toEqual([
        'createdAt',
        'description',
        'id',
        'initials',
        'name',
        'role',
        'status',
        'updatedAt',
      ]);
    });

    it('response does not contain internal/secret fields', async () => {
      await buildApp();
      service.listByUserId.mockResolvedValue([makeAgent()]);

      const response = await request(app!.getHttpServer())
        .get('/api/agents')
        .expect(200);

      const resultStr = JSON.stringify(response.body);
      expect(resultStr).not.toContain('userId');
      expect(resultStr).not.toContain('deletedAt');
      expect(resultStr).not.toContain('toolPermissions');
      expect(resultStr).not.toContain('knowledgeScopes');
      expect(resultStr).not.toContain('stripe');
      expect(resultStr).not.toContain('secret');
    });
  });

  // ---------------------------------------------------------------------------
  // No provider calls
  // ---------------------------------------------------------------------------

  describe('no provider/billing/AI calls', () => {
    it('create does not invoke any billing, payment, AI, or external service', async () => {
      service.create.mockResolvedValue(makeAgent());

      await controller.create(mockReqA, {
        name: 'Test',
        role: 'Test role',
        description: 'Test description',
      });

      expect(service.create).toHaveBeenCalledTimes(1);
      expect(service.listByUserId).not.toHaveBeenCalled();
      expect(service.findOneByIdAndUserId).not.toHaveBeenCalled();
    });
  });
});

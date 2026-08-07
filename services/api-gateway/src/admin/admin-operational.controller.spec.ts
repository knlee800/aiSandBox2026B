import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  NotFoundException,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import request from 'supertest';
import { AdminOperationalController } from './admin-operational.controller';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminCreditGrantService } from './admin-credit-grant.service';
import { SessionCookieGuard } from '../auth/session-cookie.guard';
import { AdminRoleGuard } from '../guards/admin-role.guard';
import { GUARDS_METADATA } from '@nestjs/common/constants';

describe('AdminOperationalController (CO-03-01)', () => {
  let controller: AdminOperationalController;
  let service: jest.Mocked<AdminDashboardService>;
  let creditGrantService: jest.Mocked<AdminCreditGrantService>;

  beforeEach(async () => {
    const mockService = {
      getAdminUsers: jest.fn(),
      getAdminUserDetail: jest.fn(),
      getAdminSessions: jest.fn(),
      terminateSessionAsAdmin: jest.fn(),
    };
    const mockCreditGrantService = {
      grantCredits: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminOperationalController],
      providers: [
        {
          provide: AdminDashboardService,
          useValue: mockService,
        },
        {
          provide: AdminCreditGrantService,
          useValue: mockCreditGrantService,
        },
      ],
    })
      .overrideGuard(SessionCookieGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AdminOperationalController>(AdminOperationalController);
    service = module.get(AdminDashboardService);
    creditGrantService = module.get(AdminCreditGrantService);
  });

  it('applies SessionCookieGuard and AdminRoleGuard at controller level', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, AdminOperationalController) || [];
    expect(guards).toContain(SessionCookieGuard);
    expect(guards).toContain(AdminRoleGuard);
  });

  it('GET /api/admin/users returns role-guarded admin visibility list', async () => {
    service.getAdminUsers.mockResolvedValue({ users: [] });
    const result = await controller.getUsers('abc', 'OK');

    expect(service.getAdminUsers).toHaveBeenCalledWith({
      search: 'abc',
      quotaStatus: 'OK',
    });
    expect(result).toEqual({ users: [] });
  });

  it('GET /api/admin/users/:userId returns user detail', async () => {
    service.getAdminUserDetail.mockResolvedValue({
      userId: 'user-1',
      email: 'user@example.com',
      role: 'admin',
      planCode: 'free',
      planName: 'Free',
      planType: 'free',
      planStatus: 'active',
      isActive: true,
      activeSessions: 1,
      totalSessions: 3,
      sessionsCreated24h: 2,
      tokensUsed24h: 1200,
      estimatedCost: 0.012,
      quotaStatus: 'OK',
      createdAt: '2026-03-12T10:00:00.000Z',
      quotas: {
        maxActiveSessions: 5,
        maxSessions24h: 20,
        maxTokens24h: 100000,
        currentActiveSessions: 1,
        currentSessions24h: 2,
        currentTokens24h: 1200,
      },
      creditBalance: null,
    });

    const result = await controller.getUserDetail('user-1');
    expect(result.userId).toBe('user-1');
    expect(service.getAdminUserDetail).toHaveBeenCalledWith('user-1');
  });

  it('DELETE /api/admin/sessions/:sessionId uses admin actor from request user', async () => {
    service.terminateSessionAsAdmin.mockResolvedValue({
      message: 'Session terminated successfully',
    });

    const result = await controller.terminateSession('session-1', {
      user: { userId: 'admin-1', email: 'ops@example.com' },
    });

    expect(service.terminateSessionAsAdmin).toHaveBeenCalledWith(
      'session-1',
      'ops@example.com',
    );
    expect(result).toEqual({ message: 'Session terminated successfully' });
  });

  it('POST /api/admin/users/:userId/credits forwards authenticated admin actor and validated DTO', async () => {
    creditGrantService.grantCredits.mockResolvedValue({
      grantId: 'grant-1',
      status: 'granted',
      amount: 100,
      balanceBefore: 300,
      balanceAfter: 400,
    });

    const result = await controller.grantUserCredits(
      'target-user-1',
      {
        amount: 100,
        reason: 'support adjustment',
        idempotencyKey: '11111111-1111-4111-8111-111111111111',
      },
      { user: { userId: 'admin-1', role: 'admin' } },
    );

    expect(creditGrantService.grantCredits).toHaveBeenCalledWith(
      'target-user-1',
      'admin-1',
      {
        amount: 100,
        reason: 'support adjustment',
        idempotencyKey: '11111111-1111-4111-8111-111111111111',
      },
    );
    expect(result.status).toBe('granted');
  });

  it('POST /api/admin/users/:userId/credits rejects missing authenticated actor', async () => {
    await expect(
      controller.grantUserCredits(
        'target-user-1',
        {
          amount: 100,
          reason: 'support adjustment',
          idempotencyKey: '11111111-1111-4111-8111-111111111111',
        },
        { user: {} },
      ),
    ).rejects.toThrow(UnauthorizedException);

    expect(creditGrantService.grantCredits).not.toHaveBeenCalled();
  });
});

describe('AdminOperationalController POST /api/admin/users/:userId/credits HTTP contract', () => {
  let app: INestApplication | null = null;
  let dashboardService: jest.Mocked<AdminDashboardService>;
  let creditGrantService: jest.Mocked<AdminCreditGrantService>;

  const validPayload = {
    amount: 100,
    reason: 'manual support correction',
    idempotencyKey: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  };

  const buildApp = async (
    sessionMode: 'admin' | 'non-admin' | 'unauthenticated' = 'admin',
  ) => {
    dashboardService = {
      getAdminUsers: jest.fn(),
      getAdminUserDetail: jest.fn(),
      getAdminSessions: jest.fn(),
      terminateSessionAsAdmin: jest.fn(),
    } as unknown as jest.Mocked<AdminDashboardService>;

    creditGrantService = {
      grantCredits: jest.fn(),
    } as unknown as jest.Mocked<AdminCreditGrantService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminOperationalController],
      providers: [
        {
          provide: AdminDashboardService,
          useValue: dashboardService,
        },
        {
          provide: AdminCreditGrantService,
          useValue: creditGrantService,
        },
      ],
    })
      .overrideGuard(SessionCookieGuard)
      .useValue({
        canActivate: (context: any) => {
          if (sessionMode === 'unauthenticated') {
            throw new UnauthorizedException('Authentication required');
          }

          const req = context.switchToHttp().getRequest();
          req.user =
            sessionMode === 'non-admin'
              ? {
                  userId: 'non-admin-user',
                  email: 'non-admin@example.com',
                  role: 'user',
                  plan: 'free',
                }
              : {
                  userId: 'admin-user-1',
                  email: 'admin@example.com',
                  role: 'admin',
                  plan: 'free',
                };
          return true;
        },
      })
      .compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    await app.init();
  };

  afterEach(async () => {
    if (app) {
      await app.close();
      app = null;
    }
    jest.clearAllMocks();
  });

  it('returns HTTP 200 granted for valid admin request', async () => {
    await buildApp('admin');
    creditGrantService.grantCredits.mockResolvedValue({
      grantId: 'grant-happy',
      status: 'granted',
      amount: 100,
      balanceBefore: 1000,
      balanceAfter: 1100,
    });

    const response = await request(app!.getHttpServer())
      .post('/api/admin/users/target-user-1/credits')
      .send(validPayload)
      .expect(200);

    expect(response.body).toEqual({
      grantId: 'grant-happy',
      status: 'granted',
      amount: 100,
      balanceBefore: 1000,
      balanceAfter: 1100,
    });
    expect(creditGrantService.grantCredits).toHaveBeenCalledTimes(1);
    expect(creditGrantService.grantCredits).toHaveBeenCalledWith(
      'target-user-1',
      'admin-user-1',
      expect.objectContaining(validPayload),
    );
  });

  it('maps duplicate result to HTTP 200 with status duplicate', async () => {
    await buildApp('admin');
    creditGrantService.grantCredits.mockResolvedValue({
      grantId: 'grant-dup',
      status: 'duplicate',
      amount: 100,
      balanceBefore: 1000,
      balanceAfter: 1100,
    });

    const response = await request(app!.getHttpServer())
      .post('/api/admin/users/target-user-1/credits')
      .send(validPayload)
      .expect(200);

    expect(response.body.status).toBe('duplicate');
  });

  it('maps failed result to HTTP 200 with status failed', async () => {
    await buildApp('admin');
    creditGrantService.grantCredits.mockResolvedValue({
      grantId: 'grant-failed',
      status: 'failed',
      amount: 0,
      balanceBefore: 0,
      balanceAfter: 0,
    });

    const response = await request(app!.getHttpServer())
      .post('/api/admin/users/target-user-1/credits')
      .send(validPayload)
      .expect(200);

    expect(response.body.status).toBe('failed');
  });

  it('returns 404 when target user does not exist', async () => {
    await buildApp('admin');
    creditGrantService.grantCredits.mockRejectedValue(
      new NotFoundException('User with ID target-user-404 not found'),
    );

    await request(app!.getHttpServer())
      .post('/api/admin/users/target-user-404/credits')
      .send(validPayload)
      .expect(404);
  });

  it('returns 403 for authenticated non-admin user', async () => {
    await buildApp('non-admin');

    await request(app!.getHttpServer())
      .post('/api/admin/users/target-user-1/credits')
      .send(validPayload)
      .expect(403);

    expect(creditGrantService.grantCredits).not.toHaveBeenCalled();
  });

  it('returns 401 for unauthenticated request', async () => {
    await buildApp('unauthenticated');

    await request(app!.getHttpServer())
      .post('/api/admin/users/target-user-1/credits')
      .send(validPayload)
      .expect(401);

    expect(creditGrantService.grantCredits).not.toHaveBeenCalled();
  });

  it('accepts positive integer amount and rejects amount=0', async () => {
    await buildApp('admin');
    creditGrantService.grantCredits.mockResolvedValue({
      grantId: 'grant-valid',
      status: 'granted',
      amount: 1,
      balanceBefore: 10,
      balanceAfter: 11,
    });

    await request(app!.getHttpServer())
      .post('/api/admin/users/target-user-1/credits')
      .send({
        ...validPayload,
        amount: 1,
      })
      .expect(200);

    await request(app!.getHttpServer())
      .post('/api/admin/users/target-user-1/credits')
      .send({
        ...validPayload,
        amount: 0,
      })
      .expect(400);
  });

  it('rejects fractional amount', async () => {
    await buildApp('admin');

    await request(app!.getHttpServer())
      .post('/api/admin/users/target-user-1/credits')
      .send({
        ...validPayload,
        amount: 1.25,
      })
      .expect(400);

    expect(creditGrantService.grantCredits).not.toHaveBeenCalled();
  });

  it('rejects missing reason', async () => {
    await buildApp('admin');

    await request(app!.getHttpServer())
      .post('/api/admin/users/target-user-1/credits')
      .send({
        amount: 100,
        idempotencyKey: validPayload.idempotencyKey,
      })
      .expect(400);
  });

  it('rejects blank reason after trim', async () => {
    await buildApp('admin');

    await request(app!.getHttpServer())
      .post('/api/admin/users/target-user-1/credits')
      .send({
        ...validPayload,
        reason: '   ',
      })
      .expect(400);
  });

  it('rejects reason longer than 500 characters', async () => {
    await buildApp('admin');

    await request(app!.getHttpServer())
      .post('/api/admin/users/target-user-1/credits')
      .send({
        ...validPayload,
        reason: 'a'.repeat(501),
      })
      .expect(400);
  });

  it('rejects invalid idempotencyKey UUID', async () => {
    await buildApp('admin');

    await request(app!.getHttpServer())
      .post('/api/admin/users/target-user-1/credits')
      .send({
        ...validPayload,
        idempotencyKey: 'not-a-uuid',
      })
      .expect(400);
  });

  it('ignores caller-controlled actor/source/provider/grantType fields', async () => {
    await buildApp('admin');
    creditGrantService.grantCredits.mockResolvedValue({
      grantId: 'grant-whitelist',
      status: 'granted',
      amount: 10,
      balanceBefore: 40,
      balanceAfter: 50,
    });

    await request(app!.getHttpServer())
      .post('/api/admin/users/target-user-1/credits')
      .send({
        amount: 10,
        reason: '  whitelist-check  ',
        idempotencyKey: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        grantedByUserId: 'caller-actor',
        sourceType: 'caller-source',
        provider: 'caller-provider',
        grantType: 'caller-grant',
      })
      .expect(200);

    expect(creditGrantService.grantCredits).toHaveBeenCalledTimes(1);
    const [targetUserId, adminActor, dto] = creditGrantService.grantCredits.mock.calls[0];
    expect(targetUserId).toBe('target-user-1');
    expect(adminActor).toBe('admin-user-1');
    expect(dto).toEqual({
      amount: 10,
      reason: 'whitelist-check',
      idempotencyKey: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    });
    expect((dto as any).grantedByUserId).toBeUndefined();
    expect((dto as any).sourceType).toBeUndefined();
    expect((dto as any).provider).toBeUndefined();
    expect((dto as any).grantType).toBeUndefined();
  });

  it('keeps SessionCookieGuard and AdminRoleGuard metadata on controller', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, AdminOperationalController) || [];
    expect(guards).toContain(SessionCookieGuard);
    expect(guards).toContain(AdminRoleGuard);
  });
});

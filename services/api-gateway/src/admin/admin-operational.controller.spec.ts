import { Test, TestingModule } from '@nestjs/testing';
import { AdminOperationalController } from './admin-operational.controller';
import { AdminDashboardService } from './admin-dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminRoleGuard } from '../guards/admin-role.guard';
import { GUARDS_METADATA } from '@nestjs/common/constants';

describe('AdminOperationalController (CO-03-01)', () => {
  let controller: AdminOperationalController;
  let service: jest.Mocked<AdminDashboardService>;

  beforeEach(async () => {
    const mockService = {
      getAdminUsers: jest.fn(),
      getAdminUserDetail: jest.fn(),
      getAdminSessions: jest.fn(),
      terminateSessionAsAdmin: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminOperationalController],
      providers: [
        {
          provide: AdminDashboardService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<AdminOperationalController>(AdminOperationalController);
    service = module.get(AdminDashboardService);
  });

  it('applies JwtAuthGuard and AdminRoleGuard at controller level', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, AdminOperationalController) || [];
    expect(guards).toContain(JwtAuthGuard);
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
});
